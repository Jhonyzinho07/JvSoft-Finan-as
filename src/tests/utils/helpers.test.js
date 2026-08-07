import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatarMoeda,
  formatarData,
  formatarDataCompleta,
  formatarPorcentagem,
  calcularProgresso,
  filtrarTransacoesPorPeriodo,
  agruparTransacoesPorCategoria,
  obterCorStatus,
  gerarIDUnico
} from '../../../src/utils/helpers';

describe('Helpers', () => {
  describe('formatarMoeda', () => {
    it('deve formatar valor positivo corretamente', () => {
      const resultado = formatarMoeda(1234.56).replace(/\u00A0/g, ' ');
      expect(resultado).toBe('R$ 1.234,56');
    });

    it('deve formatar valor negativo corretamente', () => {
      const resultado = formatarMoeda(-1234.56).replace(/\u00A0/g, ' ');
      expect(resultado).toBe('-R$ 1.234,56');
    });

    it('deve formatar o zero corretamente', () => {
      const resultado = formatarMoeda(0).replace(/\u00A0/g, ' ');
      expect(resultado).toBe('R$ 0,00');
    });
  });

  describe('formatarData', () => {
    it('deve retornar string vazia se nao houver data', () => {
      expect(formatarData(null)).toBe('');
      expect(formatarData(undefined)).toBe('');
    });

    it('deve formatar uma data ISO corretamente', () => {
      const data = new Date(2023, 9, 5).toISOString();
      const resultado = formatarData(data);
      expect(resultado).toMatch(/05\/10\/2023/);
    });
  });

  describe('formatarDataCompleta', () => {
    it('deve retornar string vazia se nao houver data', () => {
      expect(formatarDataCompleta(null)).toBe('');
    });

    it('deve formatar uma data completa corretamente', () => {
      const data = new Date(2023, 9, 5, 14, 30).toISOString();
      const resultado = formatarDataCompleta(data);
      expect(resultado).toContain('05/10/2023');
      expect(resultado).toMatch(/\d{2}:\d{2}/);
    });
  });

  describe('formatarPorcentagem', () => {
    it('deve formatar valores corretamente', () => {
      expect(formatarPorcentagem(12.34)).toBe('12.3%');
      expect(formatarPorcentagem(12)).toBe('12.0%');
      expect(formatarPorcentagem(0)).toBe('0.0%');
    });
  });

  describe('calcularProgresso', () => {
    it('deve retornar 0 quando o total for 0', () => {
      expect(calcularProgresso(10, 0)).toBe(0);
    });

    it('deve calcular a porcentagem corretamente', () => {
      expect(calcularProgresso(50, 100)).toBe(50);
      expect(calcularProgresso(25, 100)).toBe(25);
    });

    it('nao deve ultrapassar 100%', () => {
      expect(calcularProgresso(150, 100)).toBe(100);
    });
  });

  describe('filtrarTransacoesPorPeriodo', () => {
    let mockDate;

    beforeEach(() => {
      mockDate = new Date(2023, 10, 15, 0, 0, 0); // Inicio do dia 15 de Nov, 2023
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const transacoes = [
      { id: 1, data: new Date(2023, 10, 15, 10, 0, 0).toISOString() }, // hoje (mesmo dia, mais tarde)
      { id: 2, data: new Date(2023, 10, 10, 10, 0, 0).toISOString() }, // semana passada
      { id: 3, data: new Date(2023, 9, 20, 10, 0, 0).toISOString() },  // mes passado
      { id: 4, data: new Date(2022, 10, 15, 10, 0, 0).toISOString() }, // ano passado
    ];

    it('deve retornar todas as transacoes no default', () => {
      expect(filtrarTransacoesPorPeriodo(transacoes, 'tudo').length).toBe(4);
    });

    it('deve filtrar para hoje', () => {
      const hoje = filtrarTransacoesPorPeriodo(transacoes, 'hoje');
      expect(hoje.length).toBe(1);
      expect(hoje[0].id).toBe(1);
    });

    it('deve filtrar para semana', () => {
      const semana = filtrarTransacoesPorPeriodo(transacoes, 'semana');
      expect(semana.length).toBe(2);
      expect(semana.map(t => t.id)).toEqual(expect.arrayContaining([1, 2]));
    });

    it('deve filtrar para mes', () => {
      const mes = filtrarTransacoesPorPeriodo(transacoes, 'mes');
      expect(mes.length).toBe(3);
    });

    it('deve filtrar para ano', () => {
      const ano = filtrarTransacoesPorPeriodo(transacoes, 'ano');
      expect(ano.length).toBe(4);
    });
  });

  describe('agruparTransacoesPorCategoria', () => {
    it('deve agrupar corretamente transacoes', () => {
      const transacoes = [
        { valor: -100, categoria: { nome: 'Alimentação', cor: '#ff0000' } },
        { valor: 50, categoria: { nome: 'Alimentação', cor: '#ff0000' } },
        { valor: -200, categoria: null },
      ];

      const resultado = agruparTransacoesPorCategoria(transacoes);

      expect(resultado['Alimentação']).toBeDefined();
      expect(resultado['Alimentação'].valor).toBe(150); // |-100| + |50|
      expect(resultado['Alimentação'].cor).toBe('#ff0000');

      expect(resultado['Outros']).toBeDefined();
      expect(resultado['Outros'].valor).toBe(200); // |-200|
      expect(resultado['Outros'].cor).toBe('#6b7280');
    });
  });

  describe('obterCorStatus', () => {
    it('deve retornar cor verde para valores positivos', () => {
      expect(obterCorStatus(10)).toBe('text-green-600 bg-green-50');
    });

    it('deve retornar cor vermelha para valores negativos', () => {
      expect(obterCorStatus(-10)).toBe('text-red-600 bg-red-50');
    });

    it('deve retornar cor cinza para valor zero', () => {
      expect(obterCorStatus(0)).toBe('text-gray-600 bg-gray-50');
    });
  });

  describe('gerarIDUnico', () => {
    it('deve gerar IDs unicos e ser uma string', () => {
      const id1 = gerarIDUnico();
      const id2 = gerarIDUnico();

      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
      expect(id1).not.toBe(id2);

      // UUID v4 format validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id1).toMatch(uuidRegex);
      expect(id2).toMatch(uuidRegex);
    });
  });
});
