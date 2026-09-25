// Importação bancária diária (Nubank via Meu Pluggy / Open Finance).
//
// - O job `sincronizar-banco` (pg_cron, 06:00 de Brasília) chama esta função
//   com a service role key: sincroniza todas as conexões ativas.
// - O usuário logado pode chamar para testar a própria conexão
//   (Configurações → "Testar conexão"), no máximo a cada 5 minutos.
//
// Só lê o que o Meu Pluggy já trouxe do banco (itens do Meu Pluggy não
// aceitam pedido de atualização). As transações vão para
// `importacoes_banco` como pendentes; nada vira lançamento sem aprovação.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { acharDuplicada, classificar, sugerirCategoria, type Origem, type TransacaoPluggy } from './classificar.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const pluggyClientId = Deno.env.get('PLUGGY_CLIENT_ID')
const pluggyClientSecret = Deno.env.get('PLUGGY_CLIENT_SECRET')

const PLUGGY_API = 'https://api.pluggy.ai'
const DIAS_MARGEM = 10        // relê os últimos dias para pegar compras que demoraram a "fechar"
const INTERVALO_TESTE_MS = 5 * 60 * 1000
const TAMANHO_PAGINA = 1000   // limite de linhas por consulta do PostgREST

const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Conexao = {
  id: string
  user_id: string
  item_id: string
  cartao_id: string | null
  importar_desde: string
  ultima_tentativa_em: string | null
}

type ContaPluggy = { id: string; type: 'BANK' | 'CREDIT' | string; name?: string }

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

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

// ── Pluggy ───────────────────────────────────────────────────────────

async function pluggyApiKey(): Promise<string> {
  if (!pluggyClientId || !pluggyClientSecret) {
    throw new Error('PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET não configurados nos segredos da Edge Function.')
  }
  const resp = await fetch(`${PLUGGY_API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: pluggyClientId, clientSecret: pluggyClientSecret }),
  })
  if (!resp.ok) throw new Error(`Pluggy recusou as credenciais (HTTP ${resp.status}).`)
  const { apiKey } = await resp.json()
  return apiKey
}

async function pluggyGet<T>(apiKey: string, caminho: string): Promise<T> {
  const resp = await fetch(`${PLUGGY_API}${caminho}`, { headers: { 'X-API-KEY': apiKey } })
  if (!resp.ok) {
    const texto = await resp.text().catch(() => '')
    throw new Error(`Pluggy ${caminho.split('?')[0]}: HTTP ${resp.status} ${texto.slice(0, 200)}`)
  }
  return resp.json()
}

/** Transações de uma conta no período (API v2, paginada por cursor). */
async function transacoesDaConta(apiKey: string, contaId: string, de: string, ate: string) {
  const todas: TransacaoPluggy[] = []
  let proxima: string | null = `?accountId=${encodeURIComponent(contaId)}&dateFrom=${de}&dateTo=${ate}`
  for (let pagina = 0; proxima && pagina < 50; pagina++) {
    const resp: { results?: TransacaoPluggy[]; next?: string | null } = await pluggyGet(apiKey, `/v2/transactions${proxima}`)
    todas.push(...(resp.results || []))
    // `next` vem pronto ("?accountId=…&after=…"); aceita também a URL completa
    const next = resp.next || null
    proxima = next && next.startsWith('http') ? next.slice(next.indexOf('?')) : next
  }
  return todas
}

// ── Sincronização de uma conexão ─────────────────────────────────────

async function sincronizarConexao(apiKey: string, con: Conexao) {
  const item = await pluggyGet<{ status?: string; lastUpdatedAt?: string | null; nextAutoSyncAt?: string | null; error?: { message?: string } | null }>(
    apiKey, `/items/${encodeURIComponent(con.item_id)}`,
  )
  const contas = await pluggyGet<{ results: ContaPluggy[] }>(apiKey, `/accounts?itemId=${encodeURIComponent(con.item_id)}`)

  const hoje = hojeEmBrasilia()
  const desde = [con.importar_desde, somarDias(hoje, -DIAS_MARGEM)].sort().at(-1)!
  let importadas = 0
  let ignoradas = 0

  if (desde <= hoje) {
    // Dados do usuário usados na classificação
    const [{ data: categorias }, { data: regrasLinhas }, jaImportadas, lancamentos] = await Promise.all([
      supabase.from('categorias').select('id, nome, tipo').eq('user_id', con.user_id),
      supabase.from('regras_categoria').select('padrao, categoria_id').eq('user_id', con.user_id),
      buscarTodas<{ externo_id: string; transacao_id: string | null; possivel_duplicada_id: string | null; chave_descricao: string; parcelas_total: number | null; parcela_numero: number | null; status: string }>((i, f) =>
        supabase.from('importacoes_banco')
          .select('externo_id, transacao_id, possivel_duplicada_id, chave_descricao, parcelas_total, parcela_numero, status')
          .eq('user_id', con.user_id).order('id').range(i, f)),
      buscarTodas<{ id: string; valor: number; data_transacao: string }>((i, f) =>
        supabase.from('transacoes').select('id, valor, data_transacao')
          .eq('user_id', con.user_id)
          .gte('data_transacao', somarDias(desde, -5)).lte('data_transacao', somarDias(hoje, 5))
          .order('id').range(i, f)),
    ])
    const regras = new Map((regrasLinhas || []).map(r => [r.padrao, r.categoria_id]))
    const externos = new Set(jaImportadas.map(r => r.externo_id))
    // Lançamentos já ligados a uma importação não contam como duplicado de outra
    const vinculadas = new Set(jaImportadas.flatMap(r => [r.transacao_id, r.possivel_duplicada_id]).filter(Boolean) as string[])
    // Compras parceladas cuja 1ª parcela já foi aprovada (o app criou todas as parcelas)
    const parceladasAprovadas = new Set(jaImportadas
      .filter(r => r.status === 'aprovada' && r.parcela_numero === 1 && (r.parcelas_total || 0) > 1)
      .map(r => `${r.chave_descricao}|${r.parcelas_total}`))

    const novas: Record<string, unknown>[] = []
    for (const conta of contas.results || []) {
      const origem: Origem = conta.type === 'CREDIT' ? 'cartao' : 'conta'
      const transacoes = await transacoesDaConta(apiKey, conta.id, desde, hoje)

      for (const t of transacoes) {
        if (!t?.id || externos.has(t.id)) continue
        const c = classificar(t, origem)
        if (!c || c.data < con.importar_desde) continue

        let status = 'pendente'
        let motivo: string | null = c.ignorarMotivo
        if (motivo) status = 'ignorada'
        else if (c.parcelaNumero && c.parcelaNumero > 1 && parceladasAprovadas.has(`${c.chave}|${c.parcelasTotal}`)) {
          status = 'ignorada'
          motivo = 'parcela_ja_lancada'
        }

        const duplicada = status === 'pendente' ? acharDuplicada(c, lancamentos, vinculadas) : null
        if (duplicada) vinculadas.add(duplicada)

        novas.push({
          user_id: con.user_id,
          conexao_id: con.id,
          externo_id: t.id,
          conta_externa_id: conta.id,
          origem,
          data: c.data,
          descricao: c.descricao,
          chave_descricao: c.chave,
          valor: c.valor,
          tipo_sugerido: c.tipo,
          categoria_sugerida_id: sugerirCategoria(c, t.category, regras, categorias || []),
          parcela_numero: c.parcelaNumero,
          parcelas_total: c.parcelasTotal,
          valor_total: c.valorTotal,
          possivel_duplicada_id: duplicada,
          status,
          motivo,
          revisada_em: status === 'ignorada' ? new Date().toISOString() : null,
          dados: t,
        })
        externos.add(t.id)
        if (status === 'pendente') importadas++
        else ignoradas++
      }
    }

    for (let i = 0; i < novas.length; i += 500) {
      const { error } = await supabase.from('importacoes_banco')
        .upsert(novas.slice(i, i + 500), { onConflict: 'user_id,externo_id', ignoreDuplicates: true })
      if (error) throw error
    }
  }

  const agora = new Date().toISOString()
  await supabase.from('conexoes_bancarias').update({
    dados_atualizados_em: item.lastUpdatedAt ?? null,
    proxima_atualizacao_em: item.nextAutoSyncAt ?? null,
    ultima_importacao_em: agora,
    ultima_tentativa_em: agora,
    ultimo_status: 'ok',
    // O Pluggy pode estar com a conexão do banco em erro (ex.: consentimento vencido)
    ultimo_erro: item.status && !['UPDATED', 'UPDATING'].includes(item.status)
      ? `Conexão no Meu Pluggy com status ${item.status}${item.error?.message ? `: ${item.error.message}` : ''}`
      : null,
  }).eq('id', con.id)

  return { importadas, ignoradas }
}

// ── Entrada ──────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ erro: 'Não autorizado' }, 401)

  // Job agendado (service role) → todas as conexões; usuário → só as dele
  let userId: string | null = null
  if (token !== supabaseServiceKey) {
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) return json({ erro: 'Não autorizado' }, 401)
    userId = data.user.id
  }

  let consulta = supabase.from('conexoes_bancarias')
    .select('id, user_id, item_id, cartao_id, importar_desde, ultima_tentativa_em')
    .eq('ativo', true)
  if (userId) consulta = consulta.eq('user_id', userId)
  const { data: conexoes, error } = await consulta
  if (error) return json({ erro: error.message }, 500)
  if (!conexoes?.length) return json({ importadas: 0, ignoradas: 0, erro: userId ? 'Nenhuma conexão ativa. Salve a conexão antes de testar.' : null })

  if (userId) {
    const recente = conexoes.find(c => c.ultima_tentativa_em && Date.now() - Date.parse(c.ultima_tentativa_em) < INTERVALO_TESTE_MS)
    if (recente) return json({ importadas: 0, ignoradas: 0, erro: 'Aguarde alguns minutos antes de testar de novo.' }, 429)
  }

  let apiKey: string
  try {
    apiKey = await pluggyApiKey()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await supabase.from('conexoes_bancarias')
      .update({ ultima_tentativa_em: new Date().toISOString(), ultimo_status: 'erro', ultimo_erro: msg })
      .in('id', conexoes.map(c => c.id))
    return json({ importadas: 0, ignoradas: 0, erro: msg }, 502)
  }

  let importadas = 0
  let ignoradas = 0
  const erros: string[] = []
  for (const con of conexoes as Conexao[]) {
    try {
      const r = await sincronizarConexao(apiKey, con)
      importadas += r.importadas
      ignoradas += r.ignoradas
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`Conexão ${con.id}:`, msg)
      erros.push(msg)
      await supabase.from('conexoes_bancarias')
        .update({ ultima_tentativa_em: new Date().toISOString(), ultimo_status: 'erro', ultimo_erro: msg.slice(0, 500) })
        .eq('id', con.id)
    }
  }

  return json({ importadas, ignoradas, erro: erros.length ? erros.join(' | ') : null }, erros.length && !importadas ? 502 : 200)
})
