// Regras puras da importação bancária (sem Deno/Supabase), para poderem
// ser testadas com o Vitest em src/tests/.

export type TransacaoPluggy = {
  id: string
  description?: string | null
  descriptionRaw?: string | null
  amount: number
  date: string
  type?: 'CREDIT' | 'DEBIT' | null
  status?: 'PENDING' | 'POSTED' | null
  category?: string | null
  creditCardMetadata?: {
    installmentNumber?: number | null
    totalInstallments?: number | null
    totalAmount?: number | null
  } | null
}

export type Origem = 'conta' | 'cartao'
export type TipoSugerido = 'receita' | 'despesa' | 'pagamento_fatura'

export type Classificacao = {
  descricao: string
  chave: string
  data: string
  valor: number
  tipo: TipoSugerido
  parcelaNumero: number | null
  parcelasTotal: number | null
  valorTotal: number | null
  // Pagamento da fatura visto pelo lado do cartão: a conta corrente já
  // registra o mesmo pagamento, então este lado é ignorado.
  ignorarMotivo: string | null
}

const RE_PAGAMENTO_FATURA = /pagamento (de |da )?fatura|pgto\.? fatura|fatura (do )?cart[aã]o|pagamento recebido/i

export function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100
}

/** Minúsculas, sem acento e sem pontuação. */
export function simplificar(texto: string): string {
  return texto
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Chave da descrição para as regras de categoria: além de simplificar,
 * tira "parcela 2/6", "2/6" e números soltos (ids, datas), para que
 * compras parecidas caiam na mesma regra.
 */
export function normalizarDescricao(texto: string): string {
  return simplificar(texto)
    .replace(/\bparcela \d+ ?\/ ?\d+/g, ' ')
    .replace(/\b\d+ ?\/ ?\d+\b/g, ' ')
    .replace(/\//g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Data da transação em 'YYYY-MM-DD' no fuso de Brasília.
 * Datas "puras" chegam como meia-noite UTC e são usadas como estão.
 */
export function dataLocal(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso) || /T00:00:00(\.000)?Z$/.test(iso)) return iso.slice(0, 10)
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
}

/** Classifica uma transação do Pluggy; null = não importar (pendente ou valor zero). */
export function classificar(t: TransacaoPluggy, origem: Origem): Classificacao | null {
  if (t.status === 'PENDING') return null
  const valor = arredondar(Math.abs(Number(t.amount) || 0))
  if (valor <= 0) return null

  const descricao = (t.description || t.descriptionRaw || 'Transação').trim()
  const saida = t.type ? t.type === 'DEBIT' : Number(t.amount) < 0
  const pareceFatura = RE_PAGAMENTO_FATURA.test(descricao) || RE_PAGAMENTO_FATURA.test(t.descriptionRaw || '')

  let tipo: TipoSugerido
  let ignorarMotivo: string | null = null
  if (origem === 'conta') {
    tipo = saida && pareceFatura ? 'pagamento_fatura' : saida ? 'despesa' : 'receita'
  } else {
    // No cartão, saída é compra; entrada é pagamento da fatura ou estorno
    if (saida) tipo = 'despesa'
    else if (pareceFatura) { tipo = 'pagamento_fatura'; ignorarMotivo = 'pagamento_no_cartao' }
    else tipo = 'receita'
  }

  const meta = origem === 'cartao' ? t.creditCardMetadata : null
  const parcelasTotal = meta?.totalInstallments && meta.totalInstallments > 1 ? meta.totalInstallments : null
  const parcelaNumero = parcelasTotal ? (meta?.installmentNumber || 1) : null
  const valorTotal = parcelasTotal
    ? arredondar(meta?.totalAmount && meta.totalAmount > 0 ? Math.abs(meta.totalAmount) : valor * parcelasTotal)
    : null

  return {
    descricao,
    chave: normalizarDescricao(descricao) || 'transacao',
    data: dataLocal(t.date),
    valor,
    tipo,
    parcelaNumero,
    parcelasTotal,
    valorTotal,
    ignorarMotivo,
  }
}

type Categoria = { id: string; nome: string; tipo: string }

// Palavras da descrição ou da categoria do Pluggy → nome de categoria do app
const SUGESTOES: Array<{ re: RegExp; nomes: string[] }> = [
  { re: /\bifood\b|rappi|delivery|ze delivery/, nomes: ['Delivery'] },
  { re: /\buber\b|\b99\b|99app|99pop|taxi|ride|transport|combustivel|posto|gasolina|estacionamento|pedagio/, nomes: ['Transporte'] },
  { re: /mercado|supermerc|atacad|assai|carrefour|grocer|hortifruti|padaria/, nomes: ['Mercado'] },
  { re: /\bbet\b|bet365|betano|aposta|gambling|lottery|loteria|blaze/, nomes: ['Aposta'] },
  { re: /farmacia|drogaria|droga raia|pharmac|health|saude|hospital|clinica|medic/, nomes: ['Saúde'] },
  { re: /aluguel|condominio|rent|housing|energia|enel|luz|agua|sabesp|internet|electricity|water|utilities/, nomes: ['Moradia'] },
  { re: /escola|curso|faculdade|education|udemy|alura/, nomes: ['Educação'] },
  { re: /netflix|spotify|cinema|streaming|entertainment|leisure|lazer|show|ingresso/, nomes: ['Lazer'] },
  { re: /salario|salary|folha|pagamento de salario|payroll/, nomes: ['Salário'] },
  { re: /investiment|invest|cdb|tesouro|caixinha|aplicacao|resgate/, nomes: ['Investimento'] },
]

/**
 * Sugere a categoria: primeiro a regra aprendida (mesma descrição
 * normalizada), depois palavras-chave na descrição e na categoria do Pluggy.
 */
export function sugerirCategoria(
  c: Pick<Classificacao, 'chave' | 'tipo' | 'descricao'>,
  categoriaPluggy: string | null | undefined,
  regras: Map<string, string>,
  categorias: Categoria[],
): string | null {
  if (c.tipo === 'pagamento_fatura') return null
  const aprendida = regras.get(c.chave)
  if (aprendida && categorias.some(cat => cat.id === aprendida)) return aprendida

  const texto = ` ${simplificar(c.descricao)} ${simplificar(categoriaPluggy || '')} `
  for (const s of SUGESTOES) {
    if (!s.re.test(texto)) continue
    for (const nome of s.nomes) {
      const alvo = simplificar(nome)
      const cat = categorias.find(x => x.tipo === c.tipo && simplificar(x.nome) === alvo)
      if (cat) return cat.id
    }
  }
  return null
}

type Lancamento = { id: string; valor: number; data_transacao: string }

/** Lançamento manual com o mesmo valor e data até 3 dias de distância (possível duplicado). */
export function acharDuplicada(c: Pick<Classificacao, 'valor' | 'data'>, lancamentos: Lancamento[], jaVinculadas: Set<string>): string | null {
  const alvo = Date.parse(`${c.data}T12:00:00Z`)
  let melhor: { id: string; dist: number } | null = null
  for (const l of lancamentos) {
    if (jaVinculadas.has(l.id)) continue
    if (Math.abs(Number(l.valor) - c.valor) >= 0.005) continue
    const dist = Math.abs(Date.parse(`${l.data_transacao}T12:00:00Z`) - alvo) / 86_400_000
    if (dist > 3) continue
    if (!melhor || dist < melhor.dist) melhor = { id: l.id, dist }
  }
  return melhor?.id ?? null
}
