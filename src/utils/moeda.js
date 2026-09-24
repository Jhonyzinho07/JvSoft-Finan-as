// Valores em Real (R$) nos campos do app.
// O texto dos campos segue o padrão brasileiro: "1.234,56".
const formato = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const MAX_DIGITOS = 13 // até R$ 99.999.999.999,99

// Máscara de digitação: só os dígitos contam e os 2 últimos são os centavos.
// "1" → "0,01", "123" → "1,23", "123456" → "1.234,56"
export function mascararMoeda(texto) {
  const digitos = String(texto ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MAX_DIGITOS)
  if (!digitos || Number(digitos) === 0) return ''
  return formato.format(Number(digitos) / 100)
}

// Número (como vem do banco) → texto do campo. 12000 → "12.000,00"
// (não use mascararMoeda para isso: ela leria 12000 como 120,00)
export function numeroParaMoeda(valor) {
  if (valor === null || valor === undefined || valor === '') return ''
  const numero = Number(valor)
  return Number.isFinite(numero) ? formato.format(numero) : ''
}

// Texto do campo → número. "1.234,56" → 1234.56; "R$ 80,00" → 80; vazio → NaN
export function moedaParaNumero(texto) {
  const limpo = String(texto ?? '').replace(/[^\d,]/g, '')
  if (!limpo) return NaN
  return Number(limpo.replace(',', '.'))
}
