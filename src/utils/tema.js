/**
 * Bibliotecas de gráfico (Recharts) recebem cores via props JS (fill, stroke),
 * não via classes CSS — então classes "dark:" do Tailwind não têm efeito nelas.
 * Esta função lê o tema atual direto do <html> e devolve a cor correspondente.
 *
 * Como cada página é uma rota lazy-loaded, ela é remontada ao navegar até ela,
 * então basta ler o tema uma vez na renderização — não precisa de listener.
 */
export function corTema(clara, escura) {
  if (typeof document === 'undefined') return clara
  return document.documentElement.classList.contains('dark') ? escura : clara
}
