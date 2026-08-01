import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import webpush from 'https://esm.sh/web-push@3.6.7'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!

webpush.setVapidDetails(
  'mailto:suporte@jvsoft.com.br',
  vapidPublicKey,
  vapidPrivateKey
)

const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

  // Verifica Token da requisição (Segurança)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || authHeader !== `Bearer ${supabaseServiceKey}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const dataAtual = new Date()
    dataAtual.setHours(0, 0, 0, 0)
    const limite = new Date(dataAtual)
    limite.setDate(dataAtual.getDate() + 2) // Dias de antecedência

    const hoje = dataAtual.toISOString().split('T')[0]
    const dataLimite = limite.toISOString().split('T')[0]

    // 1. Busca todas as contas a vencer ou vencidas (que ainda não foram pagas)
    const { data: contas, error: contasError } = await supabase
      .from('contas')
      .select('user_id, descricao, valor, data_vencimento')
      .eq('status_pago', false)
      .lte('data_vencimento', dataLimite)

    if (contasError) throw contasError
    if (!contas || contas.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhuma conta a notificar hoje.' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 2. Agrupa por usuário
    const contasPorUsuario = contas.reduce((acc, conta) => {
      if (!acc[conta.user_id]) acc[conta.user_id] = []
      acc[conta.user_id].push(conta)
      return acc
    }, {} as Record<string, any[]>)

    const usuariosIds = Object.keys(contasPorUsuario)

    // 3. Busca as inscrições de push dos usuários afetados
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', usuariosIds)

    if (subError) throw subError

    // 4. Envia as notificações
    const promessas = []
    let enviadas = 0

    for (const sub of (subscriptions || [])) {
      const contasDoUsuario = contasPorUsuario[sub.user_id]
      if (!contasDoUsuario) continue

      const vencidas = contasDoUsuario.filter(c => new Date(c.data_vencimento + 'T00:00:00') < dataAtual)
      const totalAberto = contasDoUsuario.reduce((acc, c) => acc + Number(c.valor), 0)

      const titulo = vencidas.length > 0
        ? '🔴 Resumo de Pendências'
        : '🔔 Atualização de Vencimentos'

      const corpo = vencidas.length > 0
        ? `Você possui ${vencidas.length} conta(s) expirada(s). Total em aberto: R$ ${totalAberto.toFixed(2)}.`
        : `Você possui ${contasDoUsuario.length} conta(s) com vencimento próximo. Total a pagar: R$ ${totalAberto.toFixed(2)}.`

      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          auth: sub.auth,
          p256dh: sub.p256dh
        }
      }

      const p = webpush.sendNotification(pushSubscription, JSON.stringify({
        title: titulo,
        body: corpo,
        icon: '/logo.png',
        data: { url: '/' }
      })).then(() => {
        enviadas++
      }).catch(async (e) => {
        if (e.statusCode === 410 || e.statusCode === 404) {
          // O usuário revogou a permissão ou o endpoint não existe mais, limpa do banco
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          console.error('Erro no Push:', e)
        }
      })
      promessas.push(p)
    }

    await Promise.allSettled(promessas)

    return new Response(JSON.stringify({ success: true, enviadas }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
