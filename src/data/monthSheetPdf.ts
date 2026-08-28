/**
 * A folha do mês empacotada como PDF de uma página, em A4 deitada.
 *
 * Existe por um motivo só, e ele foi descoberto testando no aparelho: o iOS
 * escolhe o papel padrão pelo TIPO do que recebe. Imagem ele trata como foto e
 * abre a caixa de impressão em 4×6 polegadas; PDF ele trata como documento, e
 * aí o papel é A4 e a orientação vem do próprio arquivo. Imprimir a página do
 * app não é opção no iPhone (invariante 20).
 *
 * O DESENHO continua sendo um só. Este arquivo não redesenha nada: ele recebe
 * a mesma imagem que o compartilhamento gera e a coloca dentro de um PDF. Dois
 * desenhos obrigados a concordar para sempre é justamente o que o invariante 20
 * proíbe.
 *
 * O PDF é escrito à mão, sem dependência nenhuma, porque é um arquivo de cinco
 * objetos: catálogo, árvore de páginas, a página, a imagem e o conteúdo. O JPEG
 * entra CRU, via `/DCTDecode` — é o único formato que o PDF embute sem
 * recompressão, e por isso a imagem daqui é JPEG e não o PNG do WhatsApp.
 */

/** Um pedaço do arquivo: estrutura em texto, ou os bytes crus do JPEG. */
type Part = string | ArrayBuffer

/** A4 deitada em pontos (1 pt = 1/72"), que é a unidade do PDF. */
const PAGE_WIDTH = 841.89
const PAGE_HEIGHT = 595.28

/** Margem de segurança: nenhuma impressora imprime até a borda. */
const MARGIN = 14

export interface SheetImage {
  /** O JPEG cru, como veio do canvas. */
  data: ArrayBuffer
  width: number
  height: number
}

/**
 * Monta o PDF de uma página com a imagem centralizada.
 *
 * A folha tem 1,42 de largura para cada 1 de altura e a A4 deitada tem 1,41 —
 * quase a mesma proporção, então ela ocupa praticamente a página inteira.
 */
export function buildMonthSheetPdf({ data, width, height }: SheetImage): Blob {
  const box = fit(width / height, PAGE_WIDTH - MARGIN * 2, PAGE_HEIGHT - MARGIN * 2)
  const x = (PAGE_WIDTH - box.width) / 2
  const y = (PAGE_HEIGHT - box.height) / 2

  const objects: Part[][] = [
    ['<</Type/Catalog/Pages 2 0 R>>'],
    ['<</Type/Pages/Kids[3 0 R]/Count 1>>'],
    [
      `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${r(PAGE_WIDTH)} ${r(PAGE_HEIGHT)}]` +
        '/Resources<</XObject<</Im0 4 0 R>>>>/Contents 5 0 R>>',
    ],
    [
      `<</Type/XObject/Subtype/Image/Width ${width}/Height ${height}` +
        `/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${data.byteLength}>>\n`,
      'stream\n',
      data,
      '\nendstream',
    ],
    [stream(`q ${r(box.width)} 0 0 ${r(box.height)} ${r(x)} ${r(y)} cm /Im0 Do Q`)],
  ]

  return assemble(objects)
}

/** A maior caixa com a proporção pedida que cabe no espaço disponível. */
function fit(ratio: number, maxWidth: number, maxHeight: number) {
  const width = Math.min(maxWidth, maxHeight * ratio)
  return { width, height: width / ratio }
}

function stream(content: string): string {
  return `<</Length ${content.length}>>\nstream\n${content}\nendstream`
}

/**
 * Junta os objetos com a tabela `xref`, que é o índice de BYTES de cada um.
 *
 * É por causa dela que o arquivo é montado em pedaços medidos, e não numa
 * string só: o JPEG no meio tem bytes que não sobrevivem a `String`.
 */
function assemble(objects: Part[][]): Blob {
  const parts: Part[] = ['%PDF-1.4\n']
  const offsets: number[] = []
  let at = 9 // o cabeçalho acima

  const push = (part: Part) => {
    parts.push(part)
    at += typeof part === 'string' ? part.length : part.byteLength
  }

  objects.forEach((body, i) => {
    offsets.push(at)
    push(`${i + 1} 0 obj\n`)
    body.forEach(push)
    push('\nendobj\n')
  })

  const xref = at
  const table = [
    `xref\n0 ${objects.length + 1}\n`,
    '0000000000 65535 f \n',
    ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`),
    `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`,
  ].join('')
  push(table)

  return new Blob(
    parts.map((p) => (typeof p === 'string' ? latin1(p) : p)),
    { type: 'application/pdf' },
  )
}

/**
 * O PDF é um formato de BYTES, não de texto: cada caractere da estrutura vale
 * um byte. Sem isto, um acento em qualquer lugar deslocaria todos os offsets
 * da `xref` e o arquivo abriria quebrado.
 */
function latin1(value: string): ArrayBuffer {
  const out = new Uint8Array(value.length)
  for (let i = 0; i < value.length; i += 1) out[i] = value.charCodeAt(i) & 0xff
  return out.buffer
}

const r = (n: number) => Math.round(n * 100) / 100
