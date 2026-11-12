import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import {
  buildItems,
  COLORS,
  configFor,
  correctAnswer,
  isCorrect,
  isMismatch,
  ITEMS,
  LEVELS,
  MAX_SAME_ANSWER_RUN,
  maxRunLength,
  mismatchCount,
  SPEED_LIMIT_MS,
} from './logic'

describe('レベル設定', () => {
  it('速さと不一致の割合', () => {
    expect(DIFFICULTIES.map((lv) => [LEVELS[lv].speed, LEVELS[lv].mismatchRatio, LEVELS[lv].answerMode])).toEqual([
      ['slow', 0.2, 'match'],
      ['slow', 0.4, 'match'],
      ['normal', 0.5, 'match'],
      ['fast', 0.5, 'match'],
      ['fast', 0.5, 'ink'],
    ])
    expect(SPEED_LIMIT_MS).toEqual({ slow: null, normal: 3000, fast: 2000 })
  })

  it('練習はいつも「ゆっくり」で、答え方はレベルのまま', () => {
    for (const lv of DIFFICULTIES) {
      expect(configFor(lv, 'practice').speed).toBe('slow')
      expect(configFor(lv, 'practice').answerMode).toBe(LEVELS[lv].answerMode)
      expect(configFor(lv, 'main')).toBe(LEVELS[lv])
    }
  })
})

describe('buildItems', () => {
  it('不一致の数がちょうど割合どおり', () => {
    const expected = { 1: 4, 2: 8, 3: 10, 4: 10, 5: 10 } as const
    for (const lv of DIFFICULTIES) {
      expect(mismatchCount(ITEMS.main, LEVELS[lv].mismatchRatio)).toBe(expected[lv])
      for (let seed = 0; seed < 100; seed++) {
        for (const mode of ['main', 'practice'] as const) {
          const cfg = configFor(lv, mode)
          const items = buildItems(cfg, ITEMS[mode], seededRng(seed * 11 + lv))
          expect(items).toHaveLength(ITEMS[mode])
          expect(items.filter(isMismatch)).toHaveLength(mismatchCount(ITEMS[mode], cfg.mismatchRatio))
        }
      }
    }
  })

  it('同じ文字とインクの組み合わせが続けて出ない', () => {
    for (const lv of DIFFICULTIES) {
      for (let seed = 0; seed < 200; seed++) {
        const items = buildItems(LEVELS[lv], ITEMS.main, seededRng(seed + lv * 1000))
        for (let i = 1; i < items.length; i++) {
          const same = items[i].word === items[i - 1].word && items[i].ink === items[i - 1].ink
          expect(same).toBe(false)
        }
        for (const item of items) {
          expect(COLORS).toContain(item.word)
          expect(COLORS).toContain(item.ink)
        }
      }
    }
  })

  it('レベル5では同じ正解(インクの色)が3回を超えて続かない', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const mode of ['main', 'practice'] as const) {
        const items = buildItems(configFor(5, mode), ITEMS[mode], seededRng(seed))
        expect(maxRunLength(items.map((i) => correctAnswer(i, 'ink')))).toBeLessThanOrEqual(MAX_SAME_ANSWER_RUN)
      }
    }
  })
})

describe('maxRunLength', () => {
  it('同じ値が続く最長の長さ', () => {
    expect(maxRunLength([])).toBe(0)
    expect(maxRunLength(['a'])).toBe(1)
    expect(maxRunLength(['a', 'a', 'b', 'b', 'b', 'a'])).toBe(3)
  })
})

describe('答え合わせ', () => {
  const match = { word: 'red', ink: 'red' } as const
  const mismatch = { word: 'blue', ink: 'yellow' } as const

  it('「あっている/ちがう」で答えるとき', () => {
    expect(isCorrect(match, 'match', 'same')).toBe(true)
    expect(isCorrect(match, 'match', 'different')).toBe(false)
    expect(isCorrect(mismatch, 'match', 'different')).toBe(true)
    expect(isCorrect(mismatch, 'match', 'same')).toBe(false)
  })

  it('インクの色で答えるとき(文字の意味ではない)', () => {
    expect(isCorrect(mismatch, 'ink', 'yellow')).toBe(true)
    expect(isCorrect(mismatch, 'ink', 'blue')).toBe(false)
    expect(isCorrect(match, 'ink', 'red')).toBe(true)
    expect(isCorrect(match, 'ink', 'green')).toBe(false)
  })
})
