export function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(valor)
}

// Converte uma data em 'YYYY-MM-DD' usando o fuso LOCAL do navegador.
// (toISOString() usa UTC: no Brasil, depois das 21h, já devolve o dia seguinte)
export function dataISOLocal(data = new Date()) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export function hojeISO() {
  return dataISOLocal(new Date())
}

// Primeiro e último dia de um mês (mes: 0-11) no formato 'YYYY-MM-DD'
export function intervaloDoMes(ano, mes) {
  return {
    inicio: dataISOLocal(new Date(ano, mes, 1)),
    fim: dataISOLocal(new Date(ano, mes + 1, 0)),
  }
}

// 'YYYY-MM-DD' vira meia-noite LOCAL (new Date('YYYY-MM-DD') seria meia-noite UTC,
// o que mostra o dia anterior no Brasil)
export function parseDataISO(data) {
  if (data instanceof Date) return data
  if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
    const [ano, mes, dia] = data.split('-').map(Number)
    return new Date(ano, mes - 1, dia)
  }
  return new Date(data)
}

export function formatarData(data) {
  if (!data) return ''
  return parseDataISO(data).toLocaleDateString('pt-BR')
}

export function formatarDataCompleta(data) {
  if (!data) return ''
  return new Date(data).toLocaleString('pt-BR')
}

export function formatarPorcentagem(valor) {
  return `${valor.toFixed(1)}%`
}

export function calcularProgresso(atual, total) {
  if (total === 0) return 0
  return Math.min((atual / total) * 100, 100)
}

export function filtrarTransacoesPorPeriodo(transacoes, periodo) {
  const agora = new Date()
  const filtro = new Date()
  
  switch(periodo) {
    case 'hoje':
      filtro.setHours(0, 0, 0, 0)
      break
    case 'semana':
      filtro.setDate(agora.getDate() - 7)
      break
    case 'mes':
      filtro.setMonth(agora.getMonth() - 1)
      break
    case 'ano':
      filtro.setFullYear(agora.getFullYear() - 1)
      break
    default:
      return transacoes
  }
  
  return transacoes.filter(t => parseDataISO(t.data) >= filtro)
}

export function agruparTransacoesPorCategoria(transacoes) {
  return transacoes.reduce((acc, t) => {
    const categoria = t.categoria?.nome || 'Outros'
    if (!acc[categoria]) {
      acc[categoria] = { nome: categoria, valor: 0, cor: t.categoria?.cor || '#6b7280' }
    }
    acc[categoria].valor += Math.abs(Number(t.valor))
    return acc
  }, {})
}

export function obterCorStatus(valor) {
  if (valor > 0) return 'text-green-600 bg-green-50'
  if (valor < 0) return 'text-red-600 bg-red-50'
  return 'text-gray-600 bg-gray-50'
}

export function gerarIDUnico() {
  return crypto.randomUUID()
}
