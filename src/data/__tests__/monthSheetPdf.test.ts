import { describe, expect, it } from 'vitest'
import { buildMonthSheetPdf } from '../monthSheetPdf'

/** Bytes que passam por JPEG e, de propósito, não são texto válido. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0xff, 0xd9])

async function pdf(width = 3357, height = 2358) {
  const blob = buildMonthSheetPdf({ data: JPEG.buffer, width, height })
  const bytes = new Uint8Array(await blob.arrayBuffer())
  // O PDF é lido byte a byte: `latin1` mantém a posição de cada caractere.
  let text = ''
  for (const b of bytes) text += String.fromCharCode(b)
  return { blob, bytes, text }
}

describe('o PDF da folha', () => {
  it('sai como uma página A4 DEITADA — é o que faz o iOS abrir em A4', async () => {
    const { blob, text } = await pdf()
    expect(blob.type).toBe('application/pdf')
    expect(text.startsWith('%PDF-')).toBe(true)
    expect(text).toContain('/MediaBox[0 0 841.89 595.28]')
    expect(text).toContain('/Count 1')
  })

  it('embute o JPEG cru, sem recomprimir', async () => {
    const { bytes, text } = await pdf()
    expect(text).toContain('/Filter/DCTDecode')
    expect(text).toContain(`/Length ${JPEG.length}`)
    const at = text.indexOf('stream\n', text.indexOf('/DCTDecode')) + 'stream\n'.length
    expect([...bytes.slice(at, at + JPEG.length)]).toEqual([...JPEG])
  })

  it('a tabela xref aponta para os bytes certos de cada objeto', async () => {
    // É a parte frágil do formato: um byte a mais em qualquer lugar e o
    // arquivo abre quebrado. Sem este teste, nada garantiria os offsets.
    const { text } = await pdf()
    const inicio = text.indexOf('xref\n')
    const offsets = [...text.slice(inicio).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) =>
      Number(m[1]),
    )
    expect(offsets).toHaveLength(5)
    offsets.forEach((offset, i) => {
      expect(text.slice(offset, offset + 8)).toContain(`${i + 1} 0 obj`)
    })
    expect(text).toContain(`startxref\n${inicio}\n`)
  })

  it('centraliza o desenho na página, com margem', async () => {
    const { text } = await pdf()
    // "largura 0 0 altura x y cm" — a matriz que posiciona a imagem.
    const m = text.match(/q ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm/)
    expect(m).not.toBeNull()
    const [w, h, x, y] = m!.slice(1).map(Number)
    expect(w).toBeLessThanOrEqual(841.89 - 28)
    expect(h).toBeLessThanOrEqual(595.28 - 28)
    // Sobra igual dos dois lados.
    expect(841.89 - (x + w)).toBeCloseTo(x, 1)
    expect(595.28 - (y + h)).toBeCloseTo(y, 1)
  })

  it('mantém a proporção da folha, seja qual for o tamanho da imagem', async () => {
    for (const [iw, ih] of [
      [3357, 2358],
      [1119, 786],
      [2238, 1572],
    ]) {
      const { text } = await pdf(iw, ih)
      const m = text.match(/q ([\d.]+) 0 0 ([\d.]+) /)!
      expect(Number(m[1]) / Number(m[2])).toBeCloseTo(iw / ih, 2)
    }
  })
})
