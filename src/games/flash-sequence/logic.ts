import { defaultRng, sample, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

export interface LevelConfig {
  /** 光る個数 */
  length: number
  /** 逆の順番で答える */
  reverse: boolean
  /** 1つが光っている時間 */
  onMs: number
  /** 次が光るまでの間 */
  offMs: number
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { length: 3, reverse: false, onMs: 1000, offMs: 500 },
  2: { length: 4, reverse: false, onMs: 1000, offMs: 500 },
  3: { length: 5, reverse: false, onMs: 700, offMs: 350 },
  4: { length: 6, reverse: false, onMs: 700, offMs: 350 },
  5: { length: 5, reverse: true, onMs: 1000, offMs: 500 },
}

export const TRIALS: Record<PlayMode, number> = { main: 5, practice: 2 }

/** 3×3 のパネル */
export const TILE_COUNT = 9

/** 光らせる順番(同じパネルは1回だけ) */
export function buildSequence(length: number, rng: Rng = defaultRng): number[] {
  const tiles = Array.from({ length: TILE_COUNT }, (_, i) => i)
  return sample(tiles, length, rng)
}

/** 答える順番 */
export function expectedOrder(sequence: readonly number[], reverse: boolean): number[] {
  return reverse ? [...sequence].reverse() : [...sequence]
}

/**
 * 見せる段階を時間の列に直す。偶数番目は「パネルが光る」、奇数番目は「消えている間」。
 * 戻り値の各要素: 光っているパネル(消えている間は null)と、その長さ。
 */
export function showSteps(sequence: readonly number[], cfg: LevelConfig): { tile: number | null; ms: number }[] {
  return sequence.flatMap((tile) => [
    { tile, ms: cfg.onMs },
    { tile: null, ms: cfg.offMs },
  ])
}
