import { describe, it, expect } from 'vitest'
import {
  classificar, normalizarDescricao, dataLocal, sugerirCategoria, acharDuplicada,
} from '../../../supabase/functions/sincronizar-banco/classificar.ts'

const base = { id: 't1', description: 'Uber *Trip', amount: -23.5, date: '2026-10-02T15:30:00.000Z', type: 'DEBIT', status: 'POSTED' }

describe('normalizarDescricao', () => {
  it('tira acento, pontuação, parcela e números soltos', () => {
    expect(normalizarDescricao('Mercado São João - Parcela 2/6')).toBe('mercado sao joao')
    expect(normalizarDescricao('PIX 12345 Fulano')).toBe('pix fulano')
    expect(normalizarDescricao('Loja X 3/10')).toBe('loja x')
  })
})

describe('dataLocal', () => {
  it('usa a data pura quando vem à meia-noite UTC', () => {
    expect(dataLocal('2026-10-01T00:00:00.000Z')).toBe('2026-10-01')
    expect(dataLocal('2026-10-01')).toBe('2026-10-01')
  })
  it('converte horário para o fuso de Brasília', () => {
    // 01:30 UTC do dia 2 = 22:30 do dia 1 em Brasília
    expect(dataLocal('2026-10-02T01:30:00.000Z')).toBe('2026-10-01')
  })
})

describe('classificar', () => {
  it('ignora transação pendente ou de valor zero', () => {
    expect(classificar({ ...base, status: 'PENDING' }, 'conta')).toBeNull()
    expect(classificar({ ...base, amount: 0 }, 'conta')).toBeNull()
  })

  it('conta: saída é despesa e entrada é receita, com valor positivo', () => {
    expect(classificar(base, 'conta')).toMatchObject({ tipo: 'despesa', valor: 23.5, data: '2026-10-02' })
    expect(classificar({ ...base, amount: 3000, type: 'CREDIT', description: 'Salário' }, 'conta'))
      .toMatchObject({ tipo: 'receita', valor: 3000 })
  })

  it('usa o sinal do valor quando não vem o tipo', () => {
    expect(classificar({ ...base, type: null, amount: -10 }, 'conta').tipo).toBe('despesa')
    expect(classificar({ ...base, type: null, amount: 10 }, 'conta').tipo).toBe('receita')
  })

  it('conta: pagamento de fatura não é gasto', () => {
    expect(classificar({ ...base, description: 'Pagamento de fatura' }, 'conta').tipo).toBe('pagamento_fatura')
  })

  it('cartão: o pagamento recebido é ignorado (a conta já registra)', () => {
    const c = classificar({ ...base, amount: 500, type: 'CREDIT', description: 'Pagamento recebido' }, 'cartao')
    expect(c).toMatchObject({ tipo: 'pagamento_fatura', ignorarMotivo: 'pagamento_no_cartao' })
  })

  it('cartão: estorno vira receita para revisão', () => {
    expect(classificar({ ...base, amount: 40, type: 'CREDIT', description: 'Estorno Loja' }, 'cartao').tipo).toBe('receita')
  })

  it('cartão: compra parcelada traz parcela e valor total', () => {
    const c = classificar({
      ...base, description: 'Loja Y', amount: 50,
      creditCardMetadata: { installmentNumber: 2, totalInstallments: 6, totalAmount: 300 },
    }, 'cartao')
    expect(c).toMatchObject({ tipo: 'despesa', valor: 50, parcelaNumero: 2, parcelasTotal: 6, valorTotal: 300 })
  })

  it('cartão: sem valor total, calcula pelas parcelas', () => {
    const c = classificar({ ...base, amount: 33.33, creditCardMetadata: { installmentNumber: 1, totalInstallments: 3 } }, 'cartao')
    expect(c.valorTotal).toBe(99.99)
  })

  it('conta corrente não usa dados de parcela', () => {
    const c = classificar({ ...base, creditCardMetadata: { installmentNumber: 1, totalInstallments: 3 } }, 'conta')
    expect(c.parcelasTotal).toBeNull()
  })
})

describe('sugerirCategoria', () => {
  const categorias = [
    { id: 'transp', nome: 'Transporte', tipo: 'despesa' },
    { id: 'merc', nome: 'Mercado', tipo: 'despesa' },
    { id: 'sal', nome: 'Salário', tipo: 'receita' },
    { id: 'deliv', nome: 'Delivery', tipo: 'despesa' },
  ]

  it('prefere a regra aprendida', () => {
    const c = classificar(base, 'conta')
    expect(sugerirCategoria(c, null, new Map([[c.chave, 'merc']]), categorias)).toBe('merc')
  })

  it('usa palavras-chave da descrição e da categoria do Pluggy', () => {
    expect(sugerirCategoria(classificar(base, 'conta'), null, new Map(), categorias)).toBe('transp')
    expect(sugerirCategoria(classificar({ ...base, description: 'IFOOD *Rest' }, 'conta'), null, new Map(), categorias)).toBe('deliv')
    expect(sugerirCategoria(classificar({ ...base, description: 'Compra XYZ' }, 'conta'), 'Groceries', new Map(), categorias)).toBe('merc')
    expect(sugerirCategoria(classificar({ ...base, description: '99 Pop' }, 'conta'), null, new Map(), categorias)).toBe('transp')
  })

  it('respeita o tipo (receita não recebe categoria de despesa)', () => {
    const c = classificar({ ...base, amount: 5000, type: 'CREDIT', description: 'Salario empresa' }, 'conta')
    expect(sugerirCategoria(c, null, new Map(), categorias)).toBe('sal')
  })

  it('sem pista, não sugere', () => {
    expect(sugerirCategoria(classificar({ ...base, description: 'Compra XYZ' }, 'conta'), null, new Map(), categorias)).toBeNull()
  })

  it('pagamento de fatura não recebe categoria', () => {
    expect(sugerirCategoria(classificar({ ...base, description: 'Pagamento de fatura' }, 'conta'), null, new Map(), categorias)).toBeNull()
  })
})

describe('acharDuplicada', () => {
  const lancamentos = [
    { id: 'a', valor: 23.5, data_transacao: '2026-09-30' },
    { id: 'b', valor: 23.5, data_transacao: '2026-10-03' },
    { id: 'c', valor: 99, data_transacao: '2026-10-02' },
  ]

  it('acha o lançamento de mesmo valor com a data mais próxima (até 3 dias)', () => {
    expect(acharDuplicada({ valor: 23.5, data: '2026-10-02' }, lancamentos, new Set())).toBe('b')
  })

  it('pula os já vinculados e respeita a janela de 3 dias', () => {
    expect(acharDuplicada({ valor: 23.5, data: '2026-10-02' }, lancamentos, new Set(['b']))).toBe('a')
    expect(acharDuplicada({ valor: 23.5, data: '2026-10-10' }, lancamentos, new Set())).toBeNull()
  })
})
