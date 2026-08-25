/**
 * Gera os ícones PNG da PWA sem dependências externas.
 * Rode com: node scripts/generate-icons.mjs
 *
 * Desenho: fundo com gradiente índigo + traçado de ECG branco.
 * A rasterização usa campo de distância (anti-aliasing analítico).
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ---------- PNG ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filtro "None"
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- geometria ----------
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const mix = (a, b, t) => a + (b - a) * t

function sdRoundedBox(px, py, halfW, halfH, r) {
  const qx = Math.abs(px) - halfW + r
  const qy = Math.abs(py) - halfH + r
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  return outside + Math.min(Math.max(qx, qy), 0) - r
}

function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax
  const pay = py - ay
  const bax = bx - ax
  const bay = by - ay
  const h = clamp01((pax * bax + pay * bay) / (bax * bax + bay * bay))
  return Math.hypot(pax - bax * h, pay - bay * h)
}

function sdPolyline(px, py, pts) {
  let d = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    d = Math.min(d, sdSegment(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]))
  }
  return d
}

// Traçado de ECG em coordenadas normalizadas (0..1, y para baixo).
const ECG = [
  [0.06, 0.53],
  [0.26, 0.53],
  [0.345, 0.70],
  [0.47, 0.22],
  [0.585, 0.63],
  [0.65, 0.53],
  [0.94, 0.53],
]

const INK = [11, 15, 20]
const GRAD_A = [124, 108, 255] // #7C6CFF
const GRAD_B = [59, 43, 201] //  #3B2BC9

/**
 * @param {number} size lado do PNG em px
 * @param {'rounded'|'square'} shape recorte externo
 * @param {number} glyphScale fração do lado ocupada pelo traçado
 */
function drawIcon(size, shape, glyphScale) {
  const buf = Buffer.alloc(size * size * 4)
  const half = size / 2
  const radius = size * 0.2237 // squircle aproximado do iOS
  const strokeHalf = (size * glyphScale * 0.088) / 2
  const glyphOffset = (size - size * glyphScale) / 2
  const pts = ECG.map(([x, y]) => [glyphOffset + x * size * glyphScale, glyphOffset + y * size * glyphScale])

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = x + 0.5
      const cy = y + 0.5

      // Gradiente diagonal do fundo.
      const t = clamp01((cx / size) * 0.45 + (cy / size) * 0.55)
      let r = mix(GRAD_A[0], GRAD_B[0], t)
      let g = mix(GRAD_A[1], GRAD_B[1], t)
      let b = mix(GRAD_A[2], GRAD_B[2], t)

      // Brilho radial suave no canto superior esquerdo.
      const gl = clamp01(1 - Math.hypot(cx - size * 0.28, cy - size * 0.22) / (size * 0.72))
      const glow = gl * gl * 0.28
      r = mix(r, 255, glow)
      g = mix(g, 255, glow)
      b = mix(b, 255, glow)

      // Traçado branco.
      const stroke = clamp01(strokeHalf + 0.5 - sdPolyline(cx, cy, pts))
      r = mix(r, 255, stroke)
      g = mix(g, 255, stroke)
      b = mix(b, 255, stroke)

      // Sombra sutil sob o traçado dá profundidade sem poluir.
      const shadow = clamp01(strokeHalf + size * 0.012 + 0.5 - sdPolyline(cx, cy - size * 0.012, pts)) * (1 - stroke)
      r = mix(r, INK[0], shadow * 0.18)
      g = mix(g, INK[1], shadow * 0.18)
      b = mix(b, INK[2], shadow * 0.18)

      const alpha =
        shape === 'rounded'
          ? clamp01(0.5 - sdRoundedBox(cx - half, cy - half, half, half, radius))
          : 1

      const i = (y * size + x) * 4
      buf[i] = Math.round(r)
      buf[i + 1] = Math.round(g)
      buf[i + 2] = Math.round(b)
      buf[i + 3] = Math.round(alpha * 255)
    }
  }
  return encodePng(size, size, buf)
}

const targets = [
  ['public/icons/icon-192.png', 192, 'rounded', 0.9],
  ['public/icons/icon-512.png', 512, 'rounded', 0.9],
  // Maskable: conteúdo dentro da zona segura de 80%.
  ['public/icons/maskable-192.png', 192, 'square', 0.62],
  ['public/icons/maskable-512.png', 512, 'square', 0.62],
  // iOS aplica a própria máscara: entregar quadrado cheio e opaco.
  ['public/apple-touch-icon.png', 180, 'square', 0.82],
]

mkdirSync(resolve(root, 'public/icons'), { recursive: true })
for (const [file, size, shape, scale] of targets) {
  writeFileSync(resolve(root, file), drawIcon(size, shape, scale))
  console.log('gerado', file, `${size}x${size}`)
}
