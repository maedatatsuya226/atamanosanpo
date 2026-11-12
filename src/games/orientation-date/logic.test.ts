import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import {
  buildChoices,
  buildQuestions,
  daysInMonth,
  formatAnswer,
  isYearCorrect,
  LEVELS,
  monthGrid,
  partOfMonth,
  seasonOf,
} from './logic'

// 2026-11-12 は木曜日
const TODAY = new Date(2026, 10, 12)

const SAMPLE_DATES = [
  new Date(2026, 0, 1), // 1月1日(月の端・年の端)
  new Date(2026, 11, 31), // 12月31日
  new Date(2024, 1, 29), // うるう日
  new Date(2026, 1, 28), // 2月末
  new Date(2026, 10, 12),
  new Date(2026, 6, 15),
]

describe('buildChoices', () => {
  it('正解を必ず含み、重複がなく、指定数ちょうどになる', () => {
    for (const date of SAMPLE_DATES) {
      for (const kind of ['month', 'day', 'weekday', 'year'] as const) {
        for (const count of [3, 5]) {
          for (let seed = 0; seed < 50; seed++) {
            const choices = buildChoices(kind, date, count, seededRng(seed))
            const answer =
              kind === 'month'
                ? date.getMonth() + 1
                : kind === 'day'
                  ? date.getDate()
                  : kind === 'weekday'
                    ? date.getDay()
                    : date.getFullYear()
            expect(choices).toHaveLength(count)
            expect(new Set(choices).size).toBe(count)
            expect(choices).toContain(answer)
          }
        }
      }
    }
  })

  it('値が有効な範囲に収まる(日はその月の日数以内)', () => {
    for (const date of SAMPLE_DATES) {
      for (let seed = 0; seed < 50; seed++) {
        const rng = seededRng(seed)
        const dim = daysInMonth(date.getFullYear(), date.getMonth() + 1)
        for (const d of buildChoices('day', date, 5, rng)) expect(d).toBeGreaterThanOrEqual(1)
        for (const d of buildChoices('day', date, 5, rng)) expect(d).toBeLessThanOrEqual(dim)
        for (const m of buildChoices('month', date, 5, rng)) expect(m >= 1 && m <= 12).toBe(true)
        for (const w of buildChoices('weekday', date, 5, rng)) expect(w >= 0 && w <= 6).toBe(true)
      }
    }
  })

  it('月の選択肢は正解の近く(±2か月以内)から選ばれ、年をまたいで順に並ぶ', () => {
    // 12月が正解なら 10,11,12,1,2 の中から選ばれ、例えば [11, 12, 1] の順になる
    const order = [10, 11, 12, 1, 2]
    for (let seed = 0; seed < 50; seed++) {
      const choices = buildChoices('month', new Date(2026, 11, 31), 3, seededRng(seed))
      const positions = choices.map((m) => order.indexOf(m))
      expect(positions.every((p) => p >= 0)).toBe(true)
      expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    }
  })

  it('正解の位置が偏らない(どの位置にも現れる)', () => {
    for (const date of SAMPLE_DATES) {
      for (const kind of ['month', 'weekday'] as const) {
        const answer = kind === 'month' ? date.getMonth() + 1 : date.getDay()
        const positions = new Set<number>()
        for (let seed = 0; seed < 100; seed++) {
          positions.add(buildChoices(kind, date, 5, seededRng(seed)).indexOf(answer))
        }
        expect([...positions].sort()).toEqual([0, 1, 2, 3, 4])
      }
    }
  })

  it('日は月の範囲内で連続し、月初・月末でもはみ出さない', () => {
    expect(buildChoices('day', new Date(2026, 0, 1), 5, seededRng(1))).toEqual([1, 2, 3, 4, 5])
    expect(buildChoices('day', new Date(2026, 1, 28), 5, seededRng(1))).toEqual([24, 25, 26, 27, 28])
  })

  it('曜日を7つ以上求めたら全曜日を日曜から返す', () => {
    expect(buildChoices('weekday', TODAY, 7)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
})

describe('buildQuestions', () => {
  it('レベルごとの問題の種類と選択肢数が設定どおり', () => {
    for (const lv of DIFFICULTIES) {
      const cfg = LEVELS[lv]
      const qs = buildQuestions(TODAY, lv, seededRng(lv))
      expect(qs.map((q) => q.kind)).toEqual(cfg.kinds)
      for (const q of qs) {
        if (cfg.mode === 'choice') expect(q.choices).toHaveLength(cfg.choiceCount)
        else if (q.kind === 'weekday') expect(q.choices).toHaveLength(7)
        else expect(q.choices).toHaveLength(0)
      }
    }
  })

  it('正解は端末の日付と一致する', () => {
    const qs = buildQuestions(TODAY, 5)
    expect(qs.find((q) => q.kind === 'year')?.answer).toBe(2026)
    expect(qs.find((q) => q.kind === 'month')?.answer).toBe(11)
    expect(qs.find((q) => q.kind === 'day')?.answer).toBe(12)
    expect(qs.find((q) => q.kind === 'weekday')?.answer).toBe(4) // 木
  })
})

describe('isYearCorrect', () => {
  it('西暦でも令和でも正解になる', () => {
    expect(isYearCorrect(TODAY, 'seireki', 2026)).toBe(true)
    expect(isYearCorrect(TODAY, 'reiwa', 8)).toBe(true)
    expect(isYearCorrect(TODAY, 'reiwa', 2026)).toBe(false)
    expect(isYearCorrect(TODAY, 'seireki', 2025)).toBe(false)
  })
})

describe('表示用の関数', () => {
  it('正解の表示', () => {
    expect(formatAnswer('year', TODAY)).toBe('2026年(令和8年)')
    expect(formatAnswer('weekday', TODAY)).toBe('木曜日')
  })

  it('季節と月内の時期', () => {
    expect([1, 3, 6, 9, 12].map(seasonOf)).toEqual(['冬', '春', '夏', '秋', '冬'])
    expect([1, 10, 11, 20, 21, 31].map(partOfMonth)).toEqual([
      'はじめ',
      'はじめ',
      'なかごろ',
      'なかごろ',
      'おわり',
      'おわり',
    ])
  })

  it('カレンダーは日曜始まりで全日を含む', () => {
    const grid = monthGrid(2026, 11) // 2026年11月1日は日曜
    expect(grid[0][0]).toBe(1)
    expect(grid.flat().filter((d) => d !== null)).toHaveLength(30)
    for (const week of grid) expect(week).toHaveLength(7)
  })
})
