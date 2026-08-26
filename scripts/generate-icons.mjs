/**
 * Gera os ícones da PWA a partir de `assets/icon-source.png`, sem dependências.
 * Rode com: node scripts/generate-icons.mjs
 *
 * O PNG é lido, redimensionado e reescrito só com o que vem no Node: `zlib`
 * para inflar e deflacionar, e o resto na mão. É umas cem linhas a mais do que
 * usar uma biblioteca, e em troca o projeto continua com zero dependências
 * para uma tarefa que roda uma vez a cada troca de ícone.
 */
import { deflateSync, inflateSync } from 'node:zlib'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = resolve(root, 'assets/icon-source.png')

/**
 * Quanto do quadrado o desenho ocupa num ícone "maskable".
 *
 * O Android recorta o ícone num círculo, num squircle ou numa gota, conforme o
 * aparelho, e só garante o círculo central de 80% do lado. Encolher para 80% e
 * completar com o fundo é o que impede o topo da cabeça de ser cortado.
 */
const MASKABLE_SCALE = 0.8

const paeth = (a, b, c) => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

// ---------- PNG: escrita ----------
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

function applyFilter(type, line, previous, bpp, out) {
  for (let i = 0; i < line.length; i++) {
    const a = i >= bpp ? line[i - bpp] : 0
    const b = previous[i]
    const c = i >= bpp ? previous[i - bpp] : 0
    const value =
      type === 0
        ? line[i]
        : type === 1
          ? line[i] - a
          : type === 2
            ? line[i] - b
            : type === 3
              ? line[i] - ((a + b) >> 1)
              : line[i] - paeth(a, b, c)
    out[i] = value & 0xff
  }
}

/** Soma dos resíduos como inteiros com sinal — a heurística da própria spec. */
function residual(buf) {
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] < 128 ? buf[i] : 256 - buf[i]
  return sum
}

/**
 * Escreve o PNG escolhendo o melhor filtro linha a linha, e sem canal alfa
 * quando a imagem é opaca.
 *
 * Sem isso o ícone de 512 saía com 496 KB — mais pesado que a própria imagem
 * de origem — e os seis arquivos juntos dobravam o tamanho do precache da
 * PWA, que é o que o aparelho baixa antes de funcionar offline.
 */
function encodePng(width, height, rgba) {
  let opaque = true
  for (let i = 3; i < rgba.length && opaque; i += 4) if (rgba[i] !== 255) opaque = false

  const bpp = opaque ? 3 : 4
  const stride = width * bpp
  const raw = Buffer.alloc((stride + 1) * height)
  const line = Buffer.alloc(stride)
  const candidate = Buffer.alloc(stride)
  let previous = Buffer.alloc(stride)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4
      const to = x * bpp
      line[to] = rgba[from]
      line[to + 1] = rgba[from + 1]
      line[to + 2] = rgba[from + 2]
      if (!opaque) line[to + 3] = rgba[from + 3]
    }

    let bestType = 0
    let bestScore = Infinity
    const chosen = Buffer.alloc(stride)
    for (const type of [0, 1, 2, 3, 4]) {
      applyFilter(type, line, previous, bpp, candidate)
      const score = residual(candidate)
      if (score < bestScore) {
        bestScore = score
        bestType = type
        candidate.copy(chosen)
      }
    }

    raw[y * (stride + 1)] = bestType
    chosen.copy(raw, y * (stride + 1) + 1)
    previous = Buffer.from(line)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = opaque ? 2 : 6 // RGB ou RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- PNG: leitura ----------
/** Devolve sempre RGBA, seja a origem RGB ou RGBA. */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Não é um PNG.')

  let width = 0
  let height = 0
  let channels = 0
  const idat = []

  for (let off = 8; off < buf.length; ) {
    const len = buf.readUInt32BE(off)
    const type = buf.slice(off + 4, off + 8).toString('latin1')
    const data = buf.slice(off + 8, off + 8 + len)

    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      const depth = data[8]
      const colorType = data[9]
      const interlace = data[12]
      if (depth !== 8) throw new Error('Só sei ler PNG de 8 bits por canal.')
      if (interlace !== 0) throw new Error('Só sei ler PNG sem entrelaçamento.')
      if (colorType !== 2 && colorType !== 6) {
        throw new Error('Só sei ler PNG RGB ou RGBA (tipo de cor 2 ou 6).')
      }
      channels = colorType === 2 ? 3 : 4
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    off += 12 + len
  }

  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = Buffer.alloc(width * height * 4)
  let previous = Buffer.alloc(stride)

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = Buffer.from(raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1)))

    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0
      const b = previous[i]
      const c = i >= channels ? previous[i - channels] : 0
      if (filter === 1) line[i] = (line[i] + a) & 0xff
      else if (filter === 2) line[i] = (line[i] + b) & 0xff
      else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 0xff
      else if (filter === 4) line[i] = (line[i] + paeth(a, b, c)) & 0xff
      else if (filter !== 0) throw new Error(`Filtro PNG desconhecido: ${filter}`)
    }

    for (let x = 0; x < width; x++) {
      const from = x * channels
      const to = (y * width + x) * 4
      out[to] = line[from]
      out[to + 1] = line[from + 1]
      out[to + 2] = line[from + 2]
      out[to + 3] = channels === 4 ? line[from + 3] : 255
    }
    previous = line
  }

  return { width, height, rgba: out }
}

// ---------- redimensionamento ----------
/**
 * Média por área: cada pixel de destino é a média exata do retângulo de origem
 * que ele cobre. Para reduzir 512 → 192 isso é bem melhor que pegar o pixel
 * mais próximo, que serrilharia a barba e o crachá.
 */
function resize(image, width, height) {
  const out = Buffer.alloc(width * height * 4)
  const scaleX = image.width / width
  const scaleY = image.height / height

  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * scaleY)
    const y1 = Math.max(y0 + 1, Math.ceil((y + 1) * scaleY))

    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * scaleX)
      const x1 = Math.max(x0 + 1, Math.ceil((x + 1) * scaleX))

      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      for (let sy = y0; sy < y1 && sy < image.height; sy++) {
        for (let sx = x0; sx < x1 && sx < image.width; sx++) {
          const i = (sy * image.width + sx) * 4
          r += image.rgba[i]
          g += image.rgba[i + 1]
          b += image.rgba[i + 2]
          a += image.rgba[i + 3]
          n++
        }
      }
      const to = (y * width + x) * 4
      out[to] = Math.round(r / n)
      out[to + 1] = Math.round(g / n)
      out[to + 2] = Math.round(b / n)
      out[to + 3] = Math.round(a / n)
    }
  }

  return { width, height, rgba: out }
}

function solid(width, height, [r, g, b]) {
  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = r
    rgba[i + 1] = g
    rgba[i + 2] = b
    rgba[i + 3] = 255
  }
  return { width, height, rgba }
}

function drawInto(base, layer, x, y) {
  for (let sy = 0; sy < layer.height; sy++) {
    const ty = y + sy
    if (ty < 0 || ty >= base.height) continue
    for (let sx = 0; sx < layer.width; sx++) {
      const tx = x + sx
      if (tx < 0 || tx >= base.width) continue
      layer.rgba.copy(base.rgba, (ty * base.width + tx) * 4, (sy * layer.width + sx) * 4, (sy * layer.width + sx) * 4 + 4)
    }
  }
  return base
}

/** Cor mais frequente da borda — o fundo que completa o ícone "maskable". */
function edgeColor(image) {
  const counts = new Map()
  const sample = (x, y) => {
    const i = (y * image.width + x) * 4
    const key = `${image.rgba[i]},${image.rgba[i + 1]},${image.rgba[i + 2]}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  for (let x = 0; x < image.width; x++) {
    sample(x, 0)
    sample(x, image.height - 1)
  }
  for (let y = 0; y < image.height; y++) {
    sample(0, y)
    sample(image.width - 1, y)
  }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  return best.split(',').map(Number)
}

// ---------- geração ----------
const source = decodePng(readFileSync(SOURCE))
const background = edgeColor(source)
const hex = `#${background.map((c) => c.toString(16).padStart(2, '0')).join('')}`

mkdirSync(resolve(root, 'public/icons'), { recursive: true })

const save = (path, image) => {
  writeFileSync(resolve(root, path), encodePng(image.width, image.height, image.rgba))
  console.log(`${path.padEnd(34)} ${image.width}×${image.height}`)
}

/** Ícone comum: o desenho ocupa o quadrado inteiro. */
const plain = (size) => resize(source, size, size)

/** Ícone "maskable": o desenho encolhe e o fundo completa as bordas. */
const maskable = (size) => {
  const inner = Math.round(size * MASKABLE_SCALE)
  const offset = Math.round((size - inner) / 2)
  return drawInto(solid(size, size, background), resize(source, inner, inner), offset, offset)
}

console.log(`fonte: assets/icon-source.png (${source.width}×${source.height})`)
console.log(`fundo das bordas: ${hex}\n`)

save('public/icons/icon-192.png', plain(192))
save('public/icons/icon-512.png', plain(512))
save('public/icons/maskable-192.png', maskable(192))
save('public/icons/maskable-512.png', maskable(512))
save('public/apple-touch-icon.png', plain(180))
save('public/favicon-32.png', plain(32))
