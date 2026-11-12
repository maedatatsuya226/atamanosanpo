import { defaultRng, randInt, shuffle, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

export const COLORS = ['red', 'blue', 'yellow', 'green'] as const
export type ColorId = (typeof COLORS)[number]

/** 画面に出す文字(ひらがな) */
export const COLOR_WORD: Record<ColorId, string> = {
  red: 'あか',
  blue: 'あお',
  yellow: 'きいろ',
  green: 'みどり',
}

/** 暗いカード(CARD_BG)の上で見分けやすい、明るいインクの色 */
export const INK: Record<ColorId, string> = {
  red: '#ff5a5a',
  blue: '#4a9eff',
  yellow: '#ffe03a',
  green: '#3fcf6a',
}
export const CARD_BG = '#2f3437'

export type Speed = 'slow' | 'normal' | 'fast'
/** 1問の制限時間(ミリ秒)。null = 制限なし */
export const SPEED_LIMIT_MS: Record<Speed, number | null> = { slow: null, normal: 3000, fast: 2000 }

/** match = 「あっている/ちがう」で答える / ink = インクの色を4択で答える */
export type AnswerMode = 'match' | 'ink'

export interface LevelConfig {
  speed: Speed
  /** 不一致(文字の意味とインクの色がちがう)問題の割合 */
  mismatchRatio: number
  answerMode: AnswerMode
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { speed: 'slow', mismatchRatio: 0.2, answerMode: 'match' },
  2: { speed: 'slow', mismatchRatio: 0.4, answerMode: 'match' },
  3: { speed: 'normal', mismatchRatio: 0.5, answerMode: 'match' },
  4: { speed: 'fast', mismatchRatio: 0.5, answerMode: 'match' },
  5: { speed: 'fast', mismatchRatio: 0.5, answerMode: 'ink' },
}

export const ITEMS: Record<PlayMode, number> = { main: 20, practice: 6 }

/** 同じ正解が続いてよい最大の回数(インクの色で答えるレベル) */
export const MAX_SAME_ANSWER_RUN = 3

/** 練習はいつも「ゆっくり」 */
export function configFor(level: Difficulty, mode: PlayMode): LevelConfig {
  const cfg = LEVELS[level]
  return mode === 'practice' ? { ...cfg, speed: 'slow' } : cfg
}

export function mismatchCount(itemCount: number, ratio: number): number {
  return Math.round(itemCount * ratio)
}

export interface Item {
  /** 文字の意味 */
  word: ColorId
  /** インクの色 */
  ink: ColorId
}

export function isMismatch(item: Item): boolean {
  return item.word !== item.ink
}

export type Answer = 'same' | 'different' | ColorId

export function correctAnswer(item: Item, answerMode: AnswerMode): Answer {
  if (answerMode === 'ink') return item.ink
  return isMismatch(item) ? 'different' : 'same'
}

export function isCorrect(item: Item, answerMode: AnswerMode, answer: Answer): boolean {
  return correctAnswer(item, answerMode) === answer
}

/** 同じ値が続く最長の長さ */
export function maxRunLength<T>(values: readonly T[]): number {
  let best = 0
  let run = 0
  for (let i = 0; i < values.length; i++) {
    run = i > 0 && values[i] === values[i - 1] ? run + 1 : 1
    if (run > best) best = run
  }
  return best
}

function tryBuild(types: readonly boolean[], answerMode: AnswerMode, rng: Rng): Item[] | null {
  const items: Item[] = []
  for (const mismatch of types) {
    const prev = items[items.length - 1]
    const candidates: Item[] = []
    for (const word of COLORS) {
      for (const ink of COLORS) {
        if ((word !== ink) !== mismatch) continue
        // 直前とまったく同じ組み合わせは出さない
        if (prev && prev.word === word && prev.ink === ink) continue
        // インクの色で答えるときは、同じ正解が MAX_SAME_ANSWER_RUN 回を超えて続かないようにする
        if (answerMode === 'ink') {
          const tail = items.slice(-MAX_SAME_ANSWER_RUN)
          if (tail.length === MAX_SAME_ANSWER_RUN && tail.every((t) => t.ink === ink)) continue
        }
        candidates.push({ word, ink })
      }
    }
    if (candidates.length === 0) return null
    items.push(candidates[randInt(0, candidates.length - 1, rng)])
  }
  return items
}

/** 問題の並びを作る。不一致の数はちょうど round(問題数 × 割合) */
export function buildItems(cfg: LevelConfig, count: number, rng: Rng = defaultRng): Item[] {
  const m = mismatchCount(count, cfg.mismatchRatio)
  const base = Array.from({ length: count }, (_, i) => i < m)
  for (;;) {
    const items = tryBuild(shuffle(base, rng), cfg.answerMode, rng)
    if (items) return items
  }
}

/** 反応時間の表示(差を見たいので0.01秒まで)。例: 0.85秒 */
export function formatRt(ms: number): string {
  return `${(ms / 1000).toFixed(2)}秒`
}
