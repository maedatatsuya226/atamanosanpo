import { defaultRng, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

/**
 * 数字順タップ(TMT に似た訓練課題)。配置は毎回ランダムに作り、既存の検査用紙の配置は使わない。
 */
export interface LevelConfig {
  count: number
  /** 数字とかなを交互にたどる(1→あ→2→い…) */
  alternate: boolean
  /** 丸の半径(下の仮想画面の単位) */
  radius: number
  /** 丸どうしの最小のすき間 */
  gap: number
  /** 画面のどれだけの範囲に置くか(1=全体、0.7=中央の7割に詰めて置く) */
  spread: number
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { count: 10, alternate: false, radius: 46, gap: 60, spread: 1 },
  2: { count: 15, alternate: false, radius: 44, gap: 50, spread: 1 },
  3: { count: 25, alternate: false, radius: 40, gap: 34, spread: 1 },
  4: { count: 25, alternate: false, radius: 32, gap: 12, spread: 0.72 },
  5: { count: 25, alternate: true, radius: 40, gap: 30, spread: 1 },
}

export const PRACTICE_COUNT = 5

export interface Field {
  width: number
  height: number
}

/** 仮想画面の大きさ。表示時に実際の画面へ拡大縮小する。iPadの向きに合わせて選ぶ */
export const FIELD_LANDSCAPE: Field = { width: 1000, height: 620 }
export const FIELD_PORTRAIT: Field = { width: 620, height: 1000 }

export function fieldFor(width: number, height: number): Field {
  return height > width ? FIELD_PORTRAIT : FIELD_LANDSCAPE
}

export const KANA = ['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ', 'さ', 'し'] as const

/** 押す順番のラベル */
export function labelsFor(level: Difficulty, mode: PlayMode): string[] {
  const cfg = LEVELS[level]
  const count = mode === 'practice' ? PRACTICE_COUNT : cfg.count
  if (!cfg.alternate) return Array.from({ length: count }, (_, i) => String(i + 1))
  const out: string[] = []
  for (let i = 0; out.length < count; i++) {
    out.push(String(i + 1))
    if (out.length < count && i < KANA.length) out.push(KANA[i])
  }
  return out
}

export interface Target {
  label: string
  x: number
  y: number
}

/**
 * 丸を重ならないようにランダムに置く。
 * 置けなかったら最初からやり直す。
 */
export function layoutTargets(
  labels: readonly string[],
  cfg: LevelConfig,
  field: Field = FIELD_LANDSCAPE,
  rng: Rng = defaultRng,
): Target[] {
  const FIELD = field
  const { radius, gap, spread } = cfg
  const marginX = radius + 6 + (FIELD.width * (1 - spread)) / 2
  const marginY = radius + 6 + (FIELD.height * (1 - spread)) / 2
  const minDist = radius * 2 + gap
  for (let attempt = 0; attempt < 500; attempt++) {
    const placed: Target[] = []
    let failed = false
    for (const label of labels) {
      let ok = false
      for (let tries = 0; tries < 400; tries++) {
        const x = marginX + rng() * (FIELD.width - marginX * 2)
        const y = marginY + rng() * (FIELD.height - marginY * 2)
        if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= minDist)) {
          placed.push({ label, x, y })
          ok = true
          break
        }
      }
      if (!ok) {
        failed = true
        break
      }
    }
    if (!failed) return placed
  }
  throw new Error('配置できませんでした')
}

/**
 * ます目にそろえて置く(ばらつきの少ない配置)。
 * 画面の縦横比に合わせて行と列を決め、どのます目に置くかはランダム。少しだけ位置をずらす。
 */
export function gridLayout(labels: readonly string[], radius: number, field: Field, rng: Rng = defaultRng): Target[] {
  const n = labels.length
  const aspect = field.width / field.height
  let cols = Math.max(1, Math.round(Math.sqrt(n * aspect)))
  let rows = Math.ceil(n / cols)
  // 空きます目を少し作って、毎回同じ並びにならないようにする
  if (cols * rows === n) cols += 1
  rows = Math.ceil(n / cols)
  const cellW = field.width / cols
  const cellH = field.height / rows
  const jitterX = Math.max(0, (cellW - radius * 2) / 2 - 8)
  const jitterY = Math.max(0, (cellH - radius * 2) / 2 - 8)
  const cells = Array.from({ length: cols * rows }, (_, i) => i)
  // シャッフルして先頭 n 個のます目を使う
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[cells[i], cells[j]] = [cells[j], cells[i]]
  }
  return labels.map((label, k) => {
    const cell = cells[k]
    const cx = (cell % cols) * cellW + cellW / 2
    const cy = Math.floor(cell / cols) * cellH + cellH / 2
    return {
      label,
      x: cx + (rng() * 2 - 1) * jitterX * 0.5,
      y: cy + (rng() * 2 - 1) * jitterY * 0.5,
    }
  })
}

/** 画面の左半分にあるか(左右別の反応時間を出すため) */
export function sideOf(t: Target, field: Field): 'left' | 'right' {
  return t.x < field.width / 2 ? 'left' : 'right'
}
