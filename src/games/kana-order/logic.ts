import type { Difficulty, PlayMode } from '../../core/types'

/** 五十音の順(あ〜の) */
export const GOJUON = [
  'あ', 'い', 'う', 'え', 'お',
  'か', 'き', 'く', 'け', 'こ',
  'さ', 'し', 'す', 'せ', 'そ',
  'た', 'ち', 'つ', 'て', 'と',
  'な', 'に', 'ぬ', 'ね', 'の',
] as const

export interface LevelConfig {
  count: number
  radius: number
  /** true: 画面全体にばらばらに置く / false: ます目にそろえて置く */
  scatter: boolean
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { count: 5, radius: 50, scatter: false },
  2: { count: 10, radius: 46, scatter: false },
  3: { count: 15, radius: 44, scatter: false },
  4: { count: 20, radius: 42, scatter: false },
  5: { count: 25, radius: 40, scatter: true },
}

export const PRACTICE_COUNT = 5

export function labelsFor(level: Difficulty, mode: PlayMode): string[] {
  const count = mode === 'practice' ? PRACTICE_COUNT : LEVELS[level].count
  return GOJUON.slice(0, count)
}

/** 最後の文字(指示文に使う) */
export function lastLabel(level: Difficulty, mode: PlayMode): string {
  const labels = labelsFor(level, mode)
  return labels[labels.length - 1]
}
