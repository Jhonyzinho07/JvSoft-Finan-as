import { describe, it, expect, vi } from 'vitest';
import { buscarTodas } from '../../../src/utils/buscarTodas';

// "Query builder" falso: simula o .range(inicio, fim) do Supabase sobre um array em memória.
function criarQueryFalsa(total) {
  const linhas = Array.from({ length: total }, (_, i) => ({ id: i + 1 }));
  return (inicio, fim) =>
    Promise.resolve({ data: linhas.slice(inicio, fim + 1), error: null });
}

describe('buscarTodas', () => {
  it('busca todas as linhas em várias páginas (2.345 linhas → 3 páginas)', async () => {
    const montarQuery = vi.fn(criarQueryFalsa(2345));

    const resultado = await buscarTodas(montarQuery);

    expect(resultado).toHaveLength(2345);
    expect(resultado[0]).toEqual({ id: 1 });
    expect(resultado[2344]).toEqual({ id: 2345 });
    expect(montarQuery).toHaveBeenCalledTimes(3);
    expect(montarQuery).toHaveBeenNthCalledWith(1, 0, 999);
    expect(montarQuery).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(montarQuery).toHaveBeenNthCalledWith(3, 2000, 2999);
  });

  it('para na primeira página quando ela já vem vazia', async () => {
    const montarQuery = vi.fn(() => Promise.resolve({ data: [], error: null }));

    const resultado = await buscarTodas(montarQuery);

    expect(resultado).toEqual([]);
    expect(montarQuery).toHaveBeenCalledTimes(1);
  });

  it('quando o total é múltiplo do tamanho, busca uma página extra vazia para confirmar o fim', async () => {
    const montarQuery = vi.fn(criarQueryFalsa(2000));

    const resultado = await buscarTodas(montarQuery);

    expect(resultado).toHaveLength(2000);
    // 2000 linhas em páginas de 1000: a segunda página já vem com 1000 (não < 1000),
    // então o laço buscaria uma terceira página vazia para confirmar o fim.
    expect(montarQuery).toHaveBeenCalledTimes(3);
  });

  it('propaga o erro devolvido pela query e para de buscar', async () => {
    const erro = new Error('falha de rede');
    const montarQuery = vi.fn()
      .mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, i) => ({ id: i })), error: null })
      .mockResolvedValueOnce({ data: null, error: erro });

    await expect(buscarTodas(montarQuery)).rejects.toThrow('falha de rede');
    expect(montarQuery).toHaveBeenCalledTimes(2);
  });

  it('respeita um tamanho de página customizado', async () => {
    const montarQuery = vi.fn(criarQueryFalsa(25));

    const resultado = await buscarTodas(montarQuery, 10);

    expect(resultado).toHaveLength(25);
    expect(montarQuery).toHaveBeenCalledTimes(3);
    expect(montarQuery).toHaveBeenNthCalledWith(3, 20, 29);
  });
});
