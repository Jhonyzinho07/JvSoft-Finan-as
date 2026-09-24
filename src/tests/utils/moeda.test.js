import { describe, it, expect } from 'vitest'
import { mascararMoeda, numeroParaMoeda, moedaParaNumero } from '../../../src/utils/moeda'

describe('mascararMoeda (digitação)', () => {
  it('trata os 2 últimos dígitos como centavos', () => {
    expect(mascararMoeda('1')).toBe('0,01')
    expect(mascararMoeda('123')).toBe('1,23')
    expect(mascararMoeda('123456')).toBe('1.234,56')
  })
  it('ignora o que não é dígito (colar "R$ 1.234,56" funciona)', () => {
    expect(mascararMoeda('R$ 1.234,56')).toBe('1.234,56')
  })
  it('campo vazio ou zerado fica vazio', () => {
    expect(mascararMoeda('')).toBe('')
    expect(mascararMoeda('000')).toBe('')
  })
})

describe('numeroParaMoeda (valor do banco → campo)', () => {
  it('não divide por 100 (bug antigo do Editar Meta: 12000 virava 120,00)', () => {
    expect(numeroParaMoeda(12000)).toBe('12.000,00')
    expect(numeroParaMoeda('12000.00')).toBe('12.000,00')
    expect(numeroParaMoeda(1500.5)).toBe('1.500,50')
    expect(numeroParaMoeda(0.1)).toBe('0,10')
  })
  it('valores ausentes viram campo vazio', () => {
    expect(numeroParaMoeda(null)).toBe('')
    expect(numeroParaMoeda(undefined)).toBe('')
    expect(numeroParaMoeda('abc')).toBe('')
  })
})

describe('moedaParaNumero (campo → número)', () => {
  it('entende o formato brasileiro', () => {
    expect(moedaParaNumero('1.234,56')).toBe(1234.56)
    expect(moedaParaNumero('12.000,00')).toBe(12000)
    expect(moedaParaNumero('R$ 80,00')).toBe(80)
    expect(moedaParaNumero('0,01')).toBe(0.01)
  })
  it('vazio vira NaN (o formulário recusa)', () => {
    expect(moedaParaNumero('')).toBeNaN()
  })
  it('ida e volta mantém o valor', () => {
    for (const v of [0.01, 9.9, 237.8, 1653.2, 12000, 1234567.89]) {
      expect(moedaParaNumero(numeroParaMoeda(v))).toBe(v)
    }
  })
})
