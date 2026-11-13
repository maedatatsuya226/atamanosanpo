import { defaultRng, randInt, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

/**
 * Nバック
 * 絵が1枚ずつ出る。いまの絵が「N枚まえ」と同じなら「おなじ！」を押す。
 * ワーキングメモリ(覚えておきながら、新しいものと比べる)を使う。
 */
export interface LevelConfig {
  /** 何枚まえと比べるか */
  n: 1 | 2 | 3
  /** 出す絵の数 */
  items: number
  /** 絵を出している時間(ミリ秒) */
  showMs: number
  /** 絵と絵のあいだ(ミリ秒) */
  gapMs: number
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { n: 1, items: 16, showMs: 2500, gapMs: 600 },
  2: { n: 1, items: 20, showMs: 1800, gapMs: 500 },
  3: { n: 2, items: 20, showMs: 2500, gapMs: 600 },
  4: { n: 2, items: 24, showMs: 1800, gapMs: 500 },
  5: { n: 3, items: 24, showMs: 2500, gapMs: 600 },
}

/** 練習は絵の数を減らし、少しゆっくりにする */
export function configFor(level: Difficulty, mode: PlayMode): LevelConfig {
  const cfg = LEVELS[level]
  return mode === 'practice' ? { ...cfg, items: cfg.n + 7, showMs: cfg.showMs + 500 } : cfg
}

/** 使う絵(見分けやすい身近なもの) */
export const PICTURES = ['🍎', '🍌', '🍇', '🐶', '🐱', '🐟', '🚗', '⭐'] as const

/** 同じ絵(当たり)の割合のめやす */
const TARGET_RATE = 0.3

export function isTarget(seq: readonly string[], i: number, n: number): boolean {
  return i >= n && seq[i] === seq[i - n]
}

export function countTargets(seq: readonly string[], n: number): number {
  return seq.filter((_, i) => isTarget(seq, i, n)).length
}

/**
 * 絵の並びを作る。当たりは全体の約3割(比べられる絵の 25〜35%)。
 * 当たりでない所では、N枚まえと同じ絵にはしない(偶然の当たりを作らない)。
 */
export function buildSequence(n: number, length: number, rng: Rng = defaultRng): string[] {
  const comparable = length - n
  const lo = Math.round(comparable * 0.25)
  const hi = Math.round(comparable * 0.35)
  for (let attempt = 0; attempt < 500; attempt++) {
    const seq: string[] = []
    for (let i = 0; i < length; i++) {
      if (i >= n && rng() < TARGET_RATE) {
        seq.push(seq[i - n])
        continue
      }
      const options = PICTURES.filter((p) => i < n || p !== seq[i - n])
      seq.push(options[randInt(0, options.length - 1, rng)])
    }
    const t = countTargets(seq, n)
    if (t >= lo && t <= hi) return seq
  }
  throw new Error('絵の並びを作れませんでした')
}

export interface Response {
  /** 押したか */
  pressed: boolean
  /** 押すまでの時間(押していなければ null) */
  rtMs: number | null
}

export interface Score {
  /** 当たりで押せた */
  hits: number
  /** 当たりなのに押さなかった */
  misses: number
  /** 当たりでないのに押した */
  falseAlarms: number
  targets: number
}

export function score(seq: readonly string[], n: number, responses: readonly Response[]): Score {
  let hits = 0
  let misses = 0
  let falseAlarms = 0
  seq.forEach((_, i) => {
    const t = isTarget(seq, i, n)
    const p = responses[i]?.pressed ?? false
    if (t && p) hits++
    else if (t) misses++
    else if (p) falseAlarms++
  })
  return { hits, misses, falseAlarms, targets: countTargets(seq, n) }
}
