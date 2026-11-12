import { defaultRng, randInt, shuffle, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

/** [行, 列] */
export type Cell = readonly [number, number]
/** マスを組み合わせた図形(ポリオミノ) */
export type Shape = readonly Cell[]

export interface LevelConfig {
  optionCount: number
  /** 図形のマスの数 */
  cells: number
  /** 見本を1マスだけ動かした「似た図」を選択肢に使う */
  similar: boolean
  /** 選択肢を回転して表示する(回転しても同じ図は正解) */
  rotate: boolean
  /** 鏡に映した図(裏返し)を選択肢に1つ混ぜる。裏返しは不正解 */
  mirror: boolean
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { optionCount: 3, cells: 4, similar: false, rotate: false, mirror: false },
  2: { optionCount: 4, cells: 4, similar: true, rotate: false, mirror: false },
  3: { optionCount: 4, cells: 5, similar: true, rotate: true, mirror: false },
  4: { optionCount: 6, cells: 5, similar: true, rotate: true, mirror: false },
  5: { optionCount: 6, cells: 6, similar: true, rotate: true, mirror: true },
}

export const TRIALS: Record<PlayMode, number> = { main: 8, practice: 2 }

/** 図形が収まる大きさの上限(表示用) */
export const MAX_SPAN = 4

const DIRS: Cell[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

/** 左上を(0,0)にそろえ、並び順も一定にする */
export function normalize(shape: Shape): Cell[] {
  const minR = Math.min(...shape.map(([r]) => r))
  const minC = Math.min(...shape.map(([, c]) => c))
  return shape
    .map(([r, c]) => [r - minR, c - minC] as const)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

export function keyOf(shape: Shape): string {
  return normalize(shape)
    .map(([r, c]) => `${r},${c}`)
    .join(';')
}

/** 時計回りに90度 */
export function rotate90(shape: Shape): Cell[] {
  return normalize(shape.map(([r, c]) => [c, -r] as const))
}

export function rotateTimes(shape: Shape, times: number): Cell[] {
  let s = normalize(shape)
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) s = rotate90(s)
  return s
}

/** 左右反転(鏡像) */
export function mirror(shape: Shape): Cell[] {
  return normalize(shape.map(([r, c]) => [r, -c] as const))
}

/** 同じ図形か。allowRotate=true なら回転して重なるものも同じとみなす */
export function isSameShape(a: Shape, b: Shape, allowRotate: boolean): boolean {
  const kb = keyOf(b)
  if (!allowRotate) return keyOf(a) === kb
  return [0, 1, 2, 3].some((t) => keyOf(rotateTimes(a, t)) === kb)
}

export function span(shape: Shape): { rows: number; cols: number } {
  const n = normalize(shape)
  return {
    rows: Math.max(...n.map(([r]) => r)) + 1,
    cols: Math.max(...n.map(([, c]) => c)) + 1,
  }
}

export function isConnected(shape: Shape): boolean {
  if (shape.length === 0) return false
  const keys = new Set(shape.map(([r, c]) => `${r},${c}`))
  const seen = new Set<string>()
  const stack: Cell[] = [shape[0]]
  while (stack.length) {
    const [r, c] = stack.pop()!
    const k = `${r},${c}`
    if (seen.has(k)) continue
    seen.add(k)
    for (const [dr, dc] of DIRS) {
      const nk = `${r + dr},${c + dc}`
      if (keys.has(nk) && !seen.has(nk)) stack.push([r + dr, c + dc])
    }
  }
  return seen.size === keys.size
}

function fitsSpan(shape: Shape): boolean {
  const s = span(shape)
  return s.rows <= MAX_SPAN && s.cols <= MAX_SPAN
}

/** つながった図形をランダムに作る */
export function randomShape(cells: number, rng: Rng = defaultRng): Cell[] {
  for (;;) {
    const shape: Cell[] = [[0, 0]]
    const keys = new Set(['0,0'])
    let guard = 0
    while (shape.length < cells && guard++ < 200) {
      const [r, c] = shape[randInt(0, shape.length - 1, rng)]
      const [dr, dc] = DIRS[randInt(0, 3, rng)]
      const next: Cell = [r + dr, c + dc]
      const k = `${next[0]},${next[1]}`
      if (keys.has(k) || !fitsSpan([...shape, next])) continue
      shape.push(next)
      keys.add(k)
    }
    if (shape.length === cells) return normalize(shape)
  }
}

/** 1マスだけ別の場所へ動かした「似た図」を作る */
export function mutate(shape: Shape, rng: Rng = defaultRng): Cell[] | null {
  const base = normalize(shape)
  for (let attempt = 0; attempt < 50; attempt++) {
    const removeAt = randInt(0, base.length - 1, rng)
    const rest = base.filter((_, i) => i !== removeAt)
    if (!isConnected(rest)) continue
    const keys = new Set(base.map(([r, c]) => `${r},${c}`))
    const candidates: Cell[] = []
    for (const [r, c] of rest) {
      for (const [dr, dc] of DIRS) {
        const k = `${r + dr},${c + dc}`
        if (!keys.has(k)) candidates.push([r + dr, c + dc])
      }
    }
    if (candidates.length === 0) continue
    const added = candidates[randInt(0, candidates.length - 1, rng)]
    const result = [...rest, added]
    if (fitsSpan(result)) return normalize(result)
  }
  return null
}

export interface Option {
  /** 表示する形(回転済み) */
  shape: Cell[]
  isAnswer: boolean
}

export interface Trial {
  sample: Cell[]
  options: Option[]
}

export function buildTrial(level: Difficulty, rng: Rng = defaultRng): Trial {
  const cfg = LEVELS[level]
  for (;;) {
    const target = randomShape(cfg.cells, rng)
    const flipped = mirror(target)
    // 裏返しを混ぜるレベルでは、裏返すと別の形になる(左右非対称な)図形だけを使う
    if (cfg.mirror && isSameShape(flipped, target, true)) continue

    const distractors: Cell[][] = cfg.mirror ? [flipped] : []
    const isDuplicate = (s: Shape) =>
      isSameShape(s, target, cfg.rotate) || distractors.some((d) => isSameShape(s, d, cfg.rotate))

    let guard = 0
    while (distractors.length < cfg.optionCount - 1 && guard++ < 300) {
      const cand = cfg.similar ? mutate(target, rng) : randomShape(cfg.cells, rng)
      if (cand && !isDuplicate(cand)) distractors.push(cand)
    }
    if (distractors.length < cfg.optionCount - 1) continue

    const options = shuffle(
      [{ shape: target, isAnswer: true }, ...distractors.map((shape) => ({ shape, isAnswer: false }))],
      rng,
    ).map((o) => (cfg.rotate ? { ...o, shape: rotateTimes(o.shape, randInt(0, 3, rng)) } : o))
    return { sample: target, options }
  }
}
