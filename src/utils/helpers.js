export function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(valor)
}

export function formatarData(data) {
  if (!data) return ''
  return new Date(data).toLocaleDateString('pt-BR')
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
      filtro.setDate(agora.getDate())
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
  
  return transacoes.filter(t => new Date(t.data) >= filtro)
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
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}
