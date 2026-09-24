import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import webpush from 'https://esm.sh/web-push@3.6.7'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!

const DIAS_ANTECEDENCIA = 2 // mesma janela do app ("vence em breve")
const TAMANHO_PAGINA = 1000 // limite de linhas por consulta do PostgREST

webpush.setVapidDetails(
  'mailto:suporte@jvsoft.com.br',
  vapidPublicKey,
  vapidPrivateKey
)

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)

// A função roda em UTC: calcula "hoje" no fuso de Brasília ('YYYY-MM-DD')
function hojeEmBrasilia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function somarDias(dataISO: string, dias: number): string {
  const d = new Date(`${dataISO}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

async function buscarTodas<T>(consulta: (inicio: number, fim: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const linhas: T[] = []
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data, error } = await consulta(inicio, inicio + TAMANHO_PAGINA - 1)
    if (error) throw error
    linhas.push(...(data || []))
    if (!data || data.length < TAMANHO_PAGINA) return linhas
  }
}

type Conta = { user_id: string; valor: number; data_vencimento: string }
type Inscricao = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }

serve(async (req) => {
  // Configuração básica do CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  // Só o job agendado (pg_cron), que envia a service role key, pode disparar
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || authHeader !== `Bearer ${supabaseServiceKey}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const hoje = hojeEmBrasilia()
    const dataLimite = somarDias(hoje, DIAS_ANTECEDENCIA)

    // 1. Contas não pagas vencidas ou que vencem nos próximos dias
    const contas = await buscarTodas<Conta>((inicio, fim) => supabase
      .from('contas')
      .select('user_id, valor, data_vencimento')
      .eq('status_pago', false)
      .lte('data_vencimento', dataLimite)
      .order('id')
      .range(inicio, fim))

    if (contas.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhuma conta a notificar hoje.' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 2. Agrupa por usuário
    const contasPorUsuario: Record<string, Conta[]> = {}
    for (const conta of contas) {
      (contasPorUsuario[conta.user_id] ||= []).push(conta)
    }

    // 3. Inscrições de push dos usuários afetados
    const inscricoes = await buscarTodas<Inscricao>((inicio, fim) => supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .in('user_id', Object.keys(contasPorUsuario))
      .order('id')
      .range(inicio, fim))

    // 4. Envia as notificações
    let enviadas = 0
    const envios = inscricoes.map(async (sub) => {
      const contasDoUsuario = contasPorUsuario[sub.user_id]
      if (!contasDoUsuario) return

      const vencidas = contasDoUsuario.filter(c => c.data_vencimento < hoje)
      const totalAberto = contasDoUsuario.reduce((acc, c) => acc + Number(c.valor), 0)
      const plural = (n: number) => (n > 1 ? 's' : '')

      const titulo = vencidas.length > 0 ? '🔴 Resumo de Pendências' : '🔔 Atualização de Vencimentos'
      const corpo = vencidas.length > 0
        ? `Você possui ${vencidas.length} conta${plural(vencidas.length)} com prazo expirado. Total em aberto: ${formatarMoeda(totalAberto)}.`
        : `Você possui ${contasDoUsuario.length} conta${plural(contasDoUsuario.length)} com vencimento próximo. Total a pagar: ${formatarMoeda(totalAberto)}.`

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
          JSON.stringify({ title: titulo, body: corpo, icon: '/logo.png', data: { url: '/contas' } })
        )
        enviadas++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 410 || status === 404) {
          // Permissão revogada ou endpoint expirado: remove a inscrição
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          console.error('Erro no Push:', e)
        }
      }
    })

    await Promise.allSettled(envios)

    return new Response(JSON.stringify({ success: true, enviadas }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Falha ao enviar notificações:', error)
    return new Response(JSON.stringify({ error: 'Falha ao enviar notificações' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
