// Lógica pura da revisão de importações bancárias (Nubank via Open Finance / Meu Pluggy).
// Nenhuma função aqui toca o Supabase — só formatação e regras de negócio do front,
// para poder testar sem mockar rede.
import { moedaParaNumero } from './moeda'

// ─── Datas ──────────────────────────────────────────────────────────────────

function inicioDoDia(data) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate())
}

// "hoje, 07:12" / "ontem, 18:40" / "23/09, 06:00" / "—" quando não há data.
export function formatarDataHoraRelativa(timestamp, agora = new Date()) {
  if (!timestamp) return '—'
  const data = new Date(timestamp)
  if (Number.isNaN(data.getTime())) return '—'

  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const hoje = inicioDoDia(agora)
  const ontem = new Date(hoje)
  ontem.setDate(ontem.getDate() - 1)
  const diaDaData = inicioDoDia(data)

  if (diaDaData.getTime() === hoje.getTime()) return `hoje, ${hora}`
  if (diaDaData.getTime() === ontem.getTime()) return `ontem, ${hora}`
  const diaMes = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return `${diaMes}, ${hora}`
}

// Um timestamp é "de hoje" no fuso local (usado para saber se a importação está atrasada).
export function ehHojeLocal(timestamp, agora = new Date()) {
  if (!timestamp) return false
  const data = new Date(timestamp)
  if (Number.isNaN(data.getTime())) return false
  return inicioDoDia(data).getTime() === inicioDoDia(agora).getTime()
}

// A conexão pede atenção (aviso âmbar) quando a última importação falhou
// ou quando passou mais de um dia sem importar (o job roda todo dia às 12h;
// a folga de 2h cobre o horário da própria execução). Antes da primeira
// importação ainda não há o que cobrar.
const LIMITE_SEM_IMPORTAR_MS = 26 * 60 * 60 * 1000

export function conexaoPrecisaAtencao(conexao, agora = new Date()) {
  if (!conexao) return false
  if (conexao.ultimo_status === 'erro') return true
  if (!conexao.ultima_importacao_em) return false
  const ultima = new Date(conexao.ultima_importacao_em).getTime()
  if (Number.isNaN(ultima)) return false
  return agora.getTime() - ultima > LIMITE_SEM_IMPORTAR_MS
}

// ─── Compras parceladas no cartão ────────────────────────────────────────────

// Primeira parcela de uma compra parcelada: o usuário pode optar por já lançar
// a compra inteira (todas as parcelas de uma vez).
export function deveOferecerParcelamentoCompleto(importacao) {
  return (
    importacao?.origem === 'cartao' &&
    Number(importacao?.parcelas_total) > 1 &&
    importacao?.parcela_numero === 1
  )
}

// Parcela de uma compra que já começou em um mês anterior (não é a 1ª parcela).
export function ehParcelaDeCompraAnterior(importacao) {
  return (
    importacao?.origem === 'cartao' &&
    Number(importacao?.parcelas_total) > 1 &&
    Number(importacao?.parcela_numero) > 1
  )
}

export function formatarBadgeParcela(importacao) {
  if (!importacao?.parcelas_total || importacao.parcelas_total <= 1) return null
  return `Parcela ${importacao.parcela_numero}/${importacao.parcelas_total}`
}

// Calcula o valor e o número de parcelas a enviar para aprovar_importacao().
// `form.valor` pode ser o texto mascarado do CampoMoeda ("1.234,56") ou um número.
export function calcularValorEParcelas(importacao, form) {
  const valorEditado = typeof form.valor === 'number' ? form.valor : moedaParaNumero(form.valor)

  if (deveOferecerParcelamentoCompleto(importacao) && form.lancarParceladoCompleto) {
    const valorTotal = importacao.valor_total != null
      ? Number(importacao.valor_total)
      : Number(importacao.valor) * Number(importacao.parcelas_total)
    return { valor: valorTotal, parcelas: Number(importacao.parcelas_total) }
  }

  // Sem parcelamento completo: lança só o valor informado (a parcela da vez), 1x.
  return { valor: valorEditado, parcelas: 1 }
}

// Monta os parâmetros exatos da RPC aprovar_importacao().
export function montarPayloadAprovacao(importacao, form) {
  const { valor, parcelas } = calcularValorEParcelas(importacao, form)
  return {
    p_importacao_id: importacao.id,
    p_descricao: form.descricao,
    p_valor: valor,
    p_data: form.data,
    p_categoria_id: form.tipo === 'pagamento_fatura' ? null : (form.categoria_id || null),
    p_tipo: form.tipo,
    p_parcelas: parcelas,
  }
}

// ─── "Aprovar todas" ──────────────────────────────────────────────────────────

// Só entra na aprovação em lote quem já tem categoria definida (ou é pagamento de
// fatura, que não usa categoria) e não tem um possível lançamento duplicado a resolver.
export function podeAprovarAutomaticamente(importacao, form) {
  if (importacao?.possivel_duplicada_id) return false
  if (form?.tipo === 'pagamento_fatura') return true
  return Boolean(form?.categoria_id)
}

export function filtrarAprovaveisAutomaticamente(importacoes, formPorId) {
  return importacoes.filter((imp) => podeAprovarAutomaticamente(imp, formPorId[imp.id]))
}

// ─── Agrupamento por data ────────────────────────────────────────────────────

export function agruparImportacoesPorData(importacoes) {
  const grupos = {}
  for (const imp of importacoes) {
    const chave = imp.data || 'Sem data'
    if (!grupos[chave]) grupos[chave] = []
    grupos[chave].push(imp)
  }
  return Object.keys(grupos)
    .sort((a, b) => b.localeCompare(a))
    .map((data) => ({ data, itens: grupos[data] }))
}

// ─── Valores padrão do formulário de edição inline ───────────────────────────

export function valoresPadraoFormulario(importacao) {
  return {
    descricao: importacao.descricao,
    // valor fica como número aqui; a tela converte para o texto mascarado do CampoMoeda
    valor: Number(importacao.valor),
    data: importacao.data,
    tipo: importacao.tipo_sugerido || 'despesa',
    categoria_id: importacao.categoria_sugerida_id || '',
    lancarParceladoCompleto: deveOferecerParcelamentoCompleto(importacao),
  }
}
