/**
 * Os dois destinos da folha do mês: a impressora e o compartilhamento.
 *
 * O DESENHO é o mesmo nos dois (`domain/monthSheetSvg.ts`) — aqui só muda o
 * jeito de entregar, e é justamente para isso que a folha é SVG: para imprimir
 * basta pendurá-la no documento e chamar `print()`; para virar imagem basta
 * carregá-la num `<img>` e pintar num canvas.
 *
 * São dois destinos, mas TRÊS caminhos: no iPhone, imprimir também sai pela
 * imagem, porque a impressão da página lá não obedece ao papel escolhido. Veja
 * `printsViaShareSheet`.
 */
import { SHEET_HEIGHT, SHEET_WIDTH } from '@/domain/monthSheetSvg'
import { shareOrDownload } from './backup'

/** Dobro do tamanho da folha: quem recebe no WhatsApp vai dar pinça. */
const SCALE = 2

/** Se o `afterprint` não vier (o Safari às vezes engole), a folha sai daqui. */
const PRINT_CLEANUP_MS = 60_000

/**
 * No iPhone, IMPRIMIR NÃO PASSA PELA PÁGINA — passa pela imagem.
 *
 * A impressão da página web não obedece ao papel lá: medido no aparelho, a
 * consulta de mídia responde pela JANELA DO TELEFONE nas duas orientações da
 * caixa do iOS, e com o papel deitado a folha sai EM BRANCO (invariante 20).
 * Quatro tentativas de contornar isso pelo CSS falharam.
 *
 * Imagem, o iOS encaixa em qualquer papel — nenhuma das regras que quebraram
 * participa desse caminho. Então lá o Imprimir entrega a IMAGEM ao sistema, e
 * quem toca em "Imprimir" na lista é o usuário. Em todo o resto (computador,
 * Android) a impressão da página funciona e está calibrada, e continua igual.
 */
export function printsViaShareSheet(): boolean {
  const ua = navigator.userAgent
  // O iPad moderno se apresenta como Mac; o toque é o que o denuncia.
  return (
    /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  )
}

/** Manda a folha para a impressora, pelo caminho que o aparelho aceita. */
export async function printMonthSheet(svg: string, month: string): Promise<void> {
  if (printsViaShareSheet()) {
    await shareMonthSheet(svg, month)
    return
  }
  printPage(svg)
}

/**
 * Pendura a folha no documento e manda imprimir.
 *
 * Quem esconde o app inteiro é o `@media print` de `base.css` — inclusive a
 * folha de opções, que continua aberta por cima dele enquanto o diálogo de
 * impressão está na tela.
 */
function printPage(svg: string): void {
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

/**
 * A folha como PNG.
 *
 * O `<img>` carrega o SVG num documento à parte, sem acesso ao CSS nem às
 * fontes da página — é por isso que `monthSheetSvg.ts` escreve as cores em
 * hexadecimal e usa a pilha de fontes do sistema.
 */
export async function monthSheetToPng(svg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = SHEET_WIDTH * SCALE
    canvas.height = SHEET_HEIGHT * SCALE

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Não foi possível gerar a imagem da folha.')
    // O PNG guarda transparência, e fundo transparente vira PRETO na conversa
    // de quem recebe no tema escuro.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível gerar a imagem.'))),
        'image/png',
      )
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Manda a folha para o share sheet como "escala-2026-08.png". */
export async function shareMonthSheet(svg: string, month: string): Promise<void> {
  const png = await monthSheetToPng(svg)
  await shareOrDownload(new File([png], `escala-${month}.png`, { type: 'image/png' }))
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Não foi possível desenhar a folha.'))
    image.src = src
  })
}
