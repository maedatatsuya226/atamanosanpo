import { defaultRng, randInt, type Rng } from '../../core/random'
import type { Difficulty } from '../../core/types'

export type QuestionKind = 'year' | 'month' | 'day' | 'weekday'
export type AnswerMode = 'choice' | 'input'
export type Era = 'seireki' | 'reiwa'

export interface LevelConfig {
  kinds: QuestionKind[]
  mode: AnswerMode
  /** 選択式のときの選択肢の数(正解を含む) */
  choiceCount: number
  hint: boolean
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { kinds: ['month', 'weekday'], mode: 'choice', choiceCount: 3, hint: true },
  2: { kinds: ['month', 'day', 'weekday'], mode: 'choice', choiceCount: 3, hint: true },
  3: { kinds: ['month', 'day', 'weekday'], mode: 'choice', choiceCount: 5, hint: true },
  4: { kinds: ['month', 'day', 'weekday'], mode: 'input', choiceCount: 0, hint: false },
  5: { kinds: ['year', 'month', 'day', 'weekday'], mode: 'input', choiceCount: 0, hint: false },
}

/** 1回の問題で回答できる回数。使い切ったら正解を示して次へ進む */
export const MAX_ATTEMPTS = 3

export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const

/** 令和元年 = 2019年 */
export const REIWA_OFFSET = 2018

export interface Question {
  kind: QuestionKind
  /** 正解。year=西暦, month=1-12, day=1-31, weekday=0(日)-6(土) */
  answer: number
  /** 選択式の選択肢(表示順)。入力式で曜日以外は空 */
  choices: number[]
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate()
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}

/**
 * 正解を含む「連続した値」を選択肢にする(例: 10日〜14日)。
 * 正解が毎回まん中に来ると位置で当てられてしまうため、正解の位置はランダムにする。
 * circular=true(月・曜日)は端で折り返す(12月の次は1月)。false(日・年)は範囲内にずらす。
 */
function consecutiveChoices(
  answer: number,
  count: number,
  min: number,
  max: number,
  circular: boolean,
  rng: Rng,
): number[] {
  const size = max - min + 1
  if (count >= size) return range(min, max)
  let start = answer - randInt(0, count - 1, rng)
  if (!circular) start = Math.min(Math.max(start, min), max - count + 1)
  return range(start, start + count - 1).map((v) => (circular ? ((((v - min) % size) + size) % size) + min : v))
}

export function buildChoices(kind: QuestionKind, today: Date, count: number, rng: Rng = defaultRng): number[] {
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  switch (kind) {
    case 'month':
      return consecutiveChoices(month, count, 1, 12, true, rng)
    case 'day':
      return consecutiveChoices(today.getDate(), count, 1, daysInMonth(year, month), false, rng)
    case 'weekday':
      return consecutiveChoices(today.getDay(), count, 0, 6, true, rng)
    case 'year':
      return consecutiveChoices(year, count, year - 10, year + 10, false, rng)
  }
}

export function answerOf(kind: QuestionKind, today: Date): number {
  switch (kind) {
    case 'year':
      return today.getFullYear()
    case 'month':
      return today.getMonth() + 1
    case 'day':
      return today.getDate()
    case 'weekday':
      return today.getDay()
  }
}

export function buildQuestions(today: Date, level: Difficulty, rng: Rng = defaultRng): Question[] {
  const cfg = LEVELS[level]
  return cfg.kinds.map((kind) => {
    let choices: number[] = []
    if (cfg.mode === 'choice') choices = buildChoices(kind, today, cfg.choiceCount, rng)
    else if (kind === 'weekday') choices = range(0, 6) // 入力式でも曜日は7つのボタンから選ぶ
    return { kind, answer: answerOf(kind, today), choices }
  })
}

/** 年の回答は西暦・令和のどちらでも正解とする */
export function isYearCorrect(today: Date, era: Era, value: number): boolean {
  const y = today.getFullYear()
  return era === 'seireki' ? value === y : value === y - REIWA_OFFSET
}

export function formatValue(kind: QuestionKind, value: number, era: Era = 'seireki'): string {
  switch (kind) {
    case 'year':
      return era === 'reiwa' ? `令和${value}年` : `${value}年`
    case 'month':
      return `${value}月`
    case 'day':
      return `${value}日`
    case 'weekday':
      return `${WEEKDAY_LABELS[value] ?? '?'}曜日`
  }
}

export function formatAnswer(kind: QuestionKind, today: Date): string {
  if (kind === 'year') {
    const y = today.getFullYear()
    return `${y}年(令和${y - REIWA_OFFSET}年)`
  }
  return formatValue(kind, answerOf(kind, today))
}

export const KIND_LABELS: Record<QuestionKind, string> = {
  year: '年',
  month: '月',
  day: '日',
  weekday: '曜日',
}

export function seasonOf(month1: number): '春' | '夏' | '秋' | '冬' {
  if (month1 >= 3 && month1 <= 5) return '春'
  if (month1 >= 6 && month1 <= 8) return '夏'
  if (month1 >= 9 && month1 <= 11) return '秋'
  return '冬'
}

export function partOfMonth(day: number): 'はじめ' | 'なかごろ' | 'おわり' {
  if (day <= 10) return 'はじめ'
  if (day <= 20) return 'なかごろ'
  return 'おわり'
}

/** その月のカレンダー(週ごとの配列。空欄は null、日曜始まり) */
export function monthGrid(year: number, month1: number): (number | null)[][] {
  const first = new Date(year, month1 - 1, 1).getDay()
  const days = daysInMonth(year, month1)
  const cells: (number | null)[] = [...Array<null>(first).fill(null), ...range(1, days)]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
