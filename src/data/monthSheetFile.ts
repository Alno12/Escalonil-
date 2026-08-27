/**
 * A entrega da folha do mês para a impressora.
 *
 * A folha é SVG (`domain/monthSheetSvg.ts`) justamente para ser entregue de
 * mais de um jeito sem redesenhar nada: para imprimir basta pendurá-la no
 * documento e chamar `print()`.
 */

/** Se o `afterprint` não vier (o Safari às vezes engole), a folha sai daqui. */
const PRINT_CLEANUP_MS = 60_000

/**
 * Pendura a folha no documento e manda imprimir.
 *
 * Quem esconde o app inteiro é o `@media print` de `base.css` — inclusive a
 * folha de opções, que continua aberta por cima dele enquanto o diálogo de
 * impressão está na tela.
 */
export function printMonthSheet(svg: string): void {
  const host = document.createElement('div')
  host.className = 'print-sheet'
  host.innerHTML = svg
  document.body.appendChild(host)

  let done = false
  const cleanup = () => {
    if (done) return
    done = true
    host.remove()
    window.removeEventListener('afterprint', cleanup)
  }

  window.addEventListener('afterprint', cleanup)
  window.setTimeout(cleanup, PRINT_CLEANUP_MS)
  window.print()
}
