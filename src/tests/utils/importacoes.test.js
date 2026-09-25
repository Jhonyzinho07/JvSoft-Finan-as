import { describe, it, expect } from 'vitest'
import {
  formatarDataHoraRelativa,
  ehHojeLocal,
  conexaoPrecisaAtencao,
  deveOferecerParcelamentoCompleto,
  ehParcelaDeCompraAnterior,
  formatarBadgeParcela,
  calcularValorEParcelas,
  montarPayloadAprovacao,
  podeAprovarAutomaticamente,
  filtrarAprovaveisAutomaticamente,
  agruparImportacoesPorData,
  valoresPadraoFormulario,
} from '../../../src/utils/importacoes'

// Fixo para os testes não dependerem do dia em que rodam.
// 25/09/2026, 10:00 no fuso local (os testes rodam com TZ=America/Sao_Paulo).
const AGORA = new Date(2026, 8, 25, 10, 0, 0)

describe('formatarDataHoraRelativa', () => {
  it('retorna "—" quando não há data', () => {
    expect(formatarDataHoraRelativa(null, AGORA)).toBe('—')
    expect(formatarDataHoraRelativa(undefined, AGORA)).toBe('—')
  })

  it('retorna "—" para uma data inválida', () => {
    expect(formatarDataHoraRelativa('não é uma data', AGORA)).toBe('—')
  })

  it('formata "hoje, HH:mm" para o mesmo dia', () => {
    const hoje = new Date(2026, 8, 25, 7, 12, 0)
    expect(formatarDataHoraRelativa(hoje, AGORA)).toBe('hoje, 07:12')
  })

  it('formata "ontem, HH:mm" para o dia anterior', () => {
    const ontem = new Date(2026, 8, 24, 18, 40, 0)
    expect(formatarDataHoraRelativa(ontem, AGORA)).toBe('ontem, 18:40')
  })

  it('formata "dd/MM, HH:mm" para datas mais antigas', () => {
    const antiga = new Date(2026, 8, 23, 6, 0, 0)
    expect(formatarDataHoraRelativa(antiga, AGORA)).toBe('23/09, 06:00')
  })

  it('aceita string ISO também', () => {
    expect(formatarDataHoraRelativa('2026-09-25T07:12:00', AGORA)).toBe('hoje, 07:12')
  })
})

describe('ehHojeLocal', () => {
  it('true para um timestamp de hoje', () => {
    expect(ehHojeLocal(new Date(2026, 8, 25, 23, 59), AGORA)).toBe(true)
  })
  it('false para ontem ou nulo', () => {
    expect(ehHojeLocal(new Date(2026, 8, 24, 23, 59), AGORA)).toBe(false)
    expect(ehHojeLocal(null, AGORA)).toBe(false)
  })
})

describe('conexaoPrecisaAtencao', () => {
  it('false quando não há conexão', () => {
    expect(conexaoPrecisaAtencao(null, AGORA)).toBe(false)
  })

  it('true quando o último status foi erro', () => {
    const conexao = { ultimo_status: 'erro', ultima_importacao_em: new Date(2026, 8, 25, 6, 0) }
    expect(conexaoPrecisaAtencao(conexao, AGORA)).toBe(true)
  })

  it('true quando passou mais de 26h sem importar', () => {
    const conexao = { ultimo_status: 'ok', ultima_importacao_em: new Date(2026, 8, 23, 6, 0) }
    expect(conexaoPrecisaAtencao(conexao, AGORA)).toBe(true)
  })

  it('false antes do job do dia (importou ontem no mesmo horário)', () => {
    const conexao = { ultimo_status: 'ok', ultima_importacao_em: new Date(2026, 8, 24, 6, 0) }
    expect(conexaoPrecisaAtencao(conexao, new Date(2026, 8, 25, 5, 30))).toBe(false)
  })

  it('false antes da primeira importação (ultima_importacao_em nulo)', () => {
    const conexao = { ultimo_status: null, ultima_importacao_em: null }
    expect(conexaoPrecisaAtencao(conexao, AGORA)).toBe(false)
  })

  it('false quando está tudo ok e importou hoje', () => {
    const conexao = { ultimo_status: 'ok', ultima_importacao_em: new Date(2026, 8, 25, 6, 0) }
    expect(conexaoPrecisaAtencao(conexao, AGORA)).toBe(false)
  })
})

describe('deveOferecerParcelamentoCompleto / ehParcelaDeCompraAnterior', () => {
  it('oferece parcelamento completo só na 1ª parcela de compra no cartão', () => {
    expect(deveOferecerParcelamentoCompleto({ origem: 'cartao', parcelas_total: 6, parcela_numero: 1 })).toBe(true)
    expect(deveOferecerParcelamentoCompleto({ origem: 'cartao', parcelas_total: 6, parcela_numero: 2 })).toBe(false)
    expect(deveOferecerParcelamentoCompleto({ origem: 'conta', parcelas_total: 6, parcela_numero: 1 })).toBe(false)
    expect(deveOferecerParcelamentoCompleto({ origem: 'cartao', parcelas_total: 1, parcela_numero: 1 })).toBe(false)
    expect(deveOferecerParcelamentoCompleto({ origem: 'cartao', parcelas_total: null, parcela_numero: 1 })).toBe(false)
  })

  it('identifica parcela de compra anterior (parcela > 1)', () => {
    expect(ehParcelaDeCompraAnterior({ origem: 'cartao', parcelas_total: 6, parcela_numero: 3 })).toBe(true)
    expect(ehParcelaDeCompraAnterior({ origem: 'cartao', parcelas_total: 6, parcela_numero: 1 })).toBe(false)
    expect(ehParcelaDeCompraAnterior({ origem: 'conta', parcelas_total: 6, parcela_numero: 3 })).toBe(false)
  })
})

describe('formatarBadgeParcela', () => {
  it('retorna null quando não é parcelado', () => {
    expect(formatarBadgeParcela({ parcelas_total: 1, parcela_numero: 1 })).toBeNull()
    expect(formatarBadgeParcela({ parcelas_total: null, parcela_numero: null })).toBeNull()
  })
  it('formata "Parcela N/T"', () => {
    expect(formatarBadgeParcela({ parcelas_total: 6, parcela_numero: 2 })).toBe('Parcela 2/6')
  })
})

describe('calcularValorEParcelas', () => {
  const compraParcelada = {
    origem: 'cartao', parcela_numero: 1, parcelas_total: 3, valor: 100, valor_total: 300,
  }

  it('usa o valor total e todas as parcelas quando o usuário marca "lançar completo"', () => {
    const resultado = calcularValorEParcelas(compraParcelada, { valor: '100,00', lancarParceladoCompleto: true })
    expect(resultado).toEqual({ valor: 300, parcelas: 3 })
  })

  it('cai para valor_total = valor * parcelas_total quando valor_total é nulo', () => {
    const semTotal = { ...compraParcelada, valor_total: null }
    const resultado = calcularValorEParcelas(semTotal, { valor: '100,00', lancarParceladoCompleto: true })
    expect(resultado).toEqual({ valor: 300, parcelas: 3 })
  })

  it('lança só a parcela da vez (1x) quando o usuário desmarca', () => {
    const resultado = calcularValorEParcelas(compraParcelada, { valor: '100,00', lancarParceladoCompleto: false })
    expect(resultado).toEqual({ valor: 100, parcelas: 1 })
  })

  it('parcela de compra anterior sempre entra como 1x, mesmo com a flag marcada', () => {
    const parcelaAnterior = { origem: 'cartao', parcela_numero: 2, parcelas_total: 3, valor: 100, valor_total: 300 }
    const resultado = calcularValorEParcelas(parcelaAnterior, { valor: '100,00', lancarParceladoCompleto: true })
    expect(resultado).toEqual({ valor: 100, parcelas: 1 })
  })

  it('transação normal (sem parcelamento) usa o valor editado, 1x', () => {
    const normal = { origem: 'conta', parcela_numero: null, parcelas_total: null, valor: 50 }
    const resultado = calcularValorEParcelas(normal, { valor: '75,50', lancarParceladoCompleto: false })
    expect(resultado).toEqual({ valor: 75.5, parcelas: 1 })
  })

  it('aceita valor já numérico no formulário', () => {
    const normal = { origem: 'conta', parcela_numero: null, parcelas_total: null, valor: 50 }
    const resultado = calcularValorEParcelas(normal, { valor: 75.5, lancarParceladoCompleto: false })
    expect(resultado).toEqual({ valor: 75.5, parcelas: 1 })
  })
})

describe('montarPayloadAprovacao', () => {
  it('monta os parâmetros da RPC para uma despesa comum', () => {
    const importacao = { id: 'imp-1', origem: 'conta', parcela_numero: null, parcelas_total: null, valor: 120 }
    const form = { descricao: 'Supermercado', valor: '120,00', data: '2026-09-24', tipo: 'despesa', categoria_id: 'cat-1' }
    expect(montarPayloadAprovacao(importacao, form)).toEqual({
      p_importacao_id: 'imp-1',
      p_descricao: 'Supermercado',
      p_valor: 120,
      p_data: '2026-09-24',
      p_categoria_id: 'cat-1',
      p_tipo: 'despesa',
      p_parcelas: 1,
    })
  })

  it('zera a categoria quando o tipo é pagamento de fatura', () => {
    const importacao = { id: 'imp-2', origem: 'conta', valor: 500 }
    const form = { descricao: 'Pagamento fatura Nubank', valor: '500,00', data: '2026-09-24', tipo: 'pagamento_fatura', categoria_id: 'cat-x' }
    const payload = montarPayloadAprovacao(importacao, form)
    expect(payload.p_categoria_id).toBeNull()
    expect(payload.p_tipo).toBe('pagamento_fatura')
  })

  it('envia valor total e parcelas quando lançando a compra completa', () => {
    const importacao = { id: 'imp-3', origem: 'cartao', parcela_numero: 1, parcelas_total: 4, valor: 50, valor_total: 200 }
    const form = { descricao: 'Loja X', valor: '50,00', data: '2026-09-24', tipo: 'despesa', categoria_id: 'cat-2', lancarParceladoCompleto: true }
    const payload = montarPayloadAprovacao(importacao, form)
    expect(payload.p_valor).toBe(200)
    expect(payload.p_parcelas).toBe(4)
  })

  it('sem categoria selecionada envia null (não string vazia)', () => {
    const importacao = { id: 'imp-4', origem: 'conta', valor: 10 }
    const form = { descricao: 'X', valor: '10,00', data: '2026-09-24', tipo: 'despesa', categoria_id: '' }
    expect(montarPayloadAprovacao(importacao, form).p_categoria_id).toBeNull()
  })
})

describe('podeAprovarAutomaticamente / filtrarAprovaveisAutomaticamente', () => {
  it('não aprova automaticamente quem tem possível duplicada', () => {
    const importacao = { possivel_duplicada_id: 'trans-1' }
    expect(podeAprovarAutomaticamente(importacao, { tipo: 'despesa', categoria_id: 'cat-1' })).toBe(false)
  })

  it('aprova pagamento de fatura mesmo sem categoria', () => {
    const importacao = { possivel_duplicada_id: null }
    expect(podeAprovarAutomaticamente(importacao, { tipo: 'pagamento_fatura', categoria_id: '' })).toBe(true)
  })

  it('exige categoria para despesa/receita', () => {
    const importacao = { possivel_duplicada_id: null }
    expect(podeAprovarAutomaticamente(importacao, { tipo: 'despesa', categoria_id: '' })).toBe(false)
    expect(podeAprovarAutomaticamente(importacao, { tipo: 'despesa', categoria_id: 'cat-1' })).toBe(true)
  })

  it('filtra só as aprováveis automaticamente da lista', () => {
    const importacoes = [
      { id: 'a', possivel_duplicada_id: null },
      { id: 'b', possivel_duplicada_id: 'trans-1' },
      { id: 'c', possivel_duplicada_id: null },
    ]
    const formPorId = {
      a: { tipo: 'despesa', categoria_id: 'cat-1' },
      b: { tipo: 'despesa', categoria_id: 'cat-1' },
      c: { tipo: 'despesa', categoria_id: '' },
    }
    expect(filtrarAprovaveisAutomaticamente(importacoes, formPorId).map((i) => i.id)).toEqual(['a'])
  })
})

describe('agruparImportacoesPorData', () => {
  it('agrupa por data e ordena do mais recente para o mais antigo', () => {
    const importacoes = [
      { id: '1', data: '2026-09-23' },
      { id: '2', data: '2026-09-25' },
      { id: '3', data: '2026-09-25' },
      { id: '4', data: '2026-09-24' },
    ]
    const grupos = agruparImportacoesPorData(importacoes)
    expect(grupos.map((g) => g.data)).toEqual(['2026-09-25', '2026-09-24', '2026-09-23'])
    expect(grupos[0].itens.map((i) => i.id)).toEqual(['2', '3'])
  })

  it('lista vazia gera lista de grupos vazia', () => {
    expect(agruparImportacoesPorData([])).toEqual([])
  })
})

describe('valoresPadraoFormulario', () => {
  it('parte da sugestão do banco', () => {
    const importacao = {
      descricao: 'Uber', valor: 32.5, data: '2026-09-24',
      tipo_sugerido: 'despesa', categoria_sugerida_id: 'cat-transporte',
      origem: 'cartao', parcela_numero: null, parcelas_total: null,
    }
    expect(valoresPadraoFormulario(importacao)).toEqual({
      descricao: 'Uber', valor: 32.5, data: '2026-09-24',
      tipo: 'despesa', categoria_id: 'cat-transporte', lancarParceladoCompleto: false,
    })
  })

  it('marca lançarParceladoCompleto=true na 1ª parcela de compra no cartão', () => {
    const importacao = {
      descricao: 'Loja', valor: 100, data: '2026-09-24', tipo_sugerido: 'despesa',
      categoria_sugerida_id: null, origem: 'cartao', parcela_numero: 1, parcelas_total: 5,
    }
    expect(valoresPadraoFormulario(importacao).lancarParceladoCompleto).toBe(true)
    expect(valoresPadraoFormulario(importacao).categoria_id).toBe('')
  })
})
