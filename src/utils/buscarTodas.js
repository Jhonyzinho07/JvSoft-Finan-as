// Busca paginada genérica: o PostgREST (Supabase) devolve no máximo 1000 linhas
// por consulta, e o app cortava os dados sem avisar quando esse limite era passado.
// `montarQuery` recebe (inicio, fim) e deve devolver uma query do Supabase já com
// `.range(inicio, fim)` aplicado (ex.: `(i, f) => supabase.from('t').select('*').range(i, f)`).
// A query passada precisa ter uma ordenação estável (ex.: `.order('id')` como desempate),
// senão o `.range()` pode devolver linhas repetidas ou pular linhas entre páginas.
const TAMANHO_PAGINA = 1000

export async function buscarTodas(montarQuery, tamanhoPagina = TAMANHO_PAGINA) {
  const linhas = []
  for (let inicio = 0; ; inicio += tamanhoPagina) {
    const { data, error } = await montarQuery(inicio, inicio + tamanhoPagina - 1)
    if (error) throw error
    linhas.push(...data)
    if (data.length < tamanhoPagina) break
  }
  return linhas
}
