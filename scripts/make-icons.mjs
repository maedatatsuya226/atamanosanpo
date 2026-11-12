// アプリアイコン(PNG)を生成する。外部ライブラリなし。
// 実行: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [0x2f, 0x6f, 0x5e]
const RING = [0xff, 0xff, 0xff]
// 5領域の色(styles.css と同じ)
const DOTS = [
  [0x2b, 0x6c, 0xb0],
  [0xa8, 0x65, 0x12],
  [0x70, 0x48, 0xb8],
  [0x2f, 0x7d, 0x4f],
  [0xb8, 0x37, 0x37],
]

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** 単位正方形(0..1)上の点の色を返す。4x4 のスーパーサンプリングで縁を滑らかにする */
function colorAt(u, v) {
  const cx = 0.5
  const cy = 0.5
  const dx = u - cx
  const dy = v - cy
  const r = Math.hypot(dx, dy)
  // 5つの点(五角形の頂点)
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    const px = cx + 0.26 * Math.cos(a)
    const py = cy + 0.26 * Math.sin(a)
    const d = Math.hypot(u - px, v - py)
    if (d < 0.085) return DOTS[i]
    if (d < 0.105) return RING
  }
  // 中央の円
  if (r < 0.1) return RING
  return BG
}

function render(size) {
  const buf = Buffer.alloc(size * size * 4)
  const ss = 4
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rr = 0
      let gg = 0
      let bb = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = colorAt((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size)
          rr += c[0]
          gg += c[1]
          bb += c[2]
        }
      }
      const n = ss * ss
      const o = (y * size + x) * 4
      buf[o] = Math.round(rr / n)
      buf[o + 1] = Math.round(gg / n)
      buf[o + 2] = Math.round(bb / n)
      buf[o + 3] = 255
    }
  }
  return encodePng(size, buf)
}

mkdirSync('public', { recursive: true })
writeFileSync('public/icon-192.png', render(192))
writeFileSync('public/icon-512.png', render(512))
writeFileSync('public/apple-touch-icon.png', render(180))
console.log('icons written')
