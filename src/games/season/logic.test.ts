import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import { answerOf, buildQuestions, choiceToRemove, LEVELS, QUESTIONS, seasonOfMonth, THINGS, type Question } from './logic'

describe('データ', () => {
  it('名前は重ならず、月は季節と合っている', () => {
    expect(new Set(THINGS.map((t) => t.name)).size).toBe(THINGS.length)
    for (const t of THINGS) if (t.month !== null) expect(seasonOfMonth(t.month)).toBe(t.season)
  })

  it('どの季節も4つ以上あり、月の決まった行事は本番の問題数以上ある', () => {
    for (const s of ['spring', 'summer', 'autumn', 'winter'] as const) {
      expect(THINGS.filter((t) => t.season === s).length).toBeGreaterThanOrEqual(4)
    }
    expect(THINGS.filter((t) => t.month !== null).length).toBeGreaterThanOrEqual(QUESTIONS.main)
  })
})

describe('seasonOfMonth', () => {
  it('3〜5月=はる、6〜8月=なつ、9〜11月=あき、12〜2月=ふゆ', () => {
    expect([1, 2, 3, 5, 6, 8, 9, 11, 12].map(seasonOfMonth)).toEqual([
      'winter',
      'winter',
      'spring',
      'spring',
      'summer',
      'summer',
      'autumn',
      'autumn',
      'winter',
    ])
  })
})

describe('buildQuestions', () => {
  it('全レベルで、問題数・選択肢・正解がそろっている', () => {
    for (const lv of DIFFICULTIES) {
      const cfg = LEVELS[lv]
      for (let seed = 0; seed < 50; seed++) {
        const qs = buildQuestions(lv, 'main', seededRng(seed * 7 + lv))
        expect(qs).toHaveLength(QUESTIONS.main + (cfg.askNow ? 1 : 0))
        const names = qs.flatMap((q) => (q.kind === 'now' ? [] : [q.thing.name]))
        // 同じ絵は出ない
        expect(new Set(names).size).toBe(names.length)
        for (const q of qs) {
          const ans = answerOf(q, new Date(2026, 10, 15))
          expect((q.choices as (string | number)[]).includes(ans)).toBe(true)
          if (q.kind === 'season') expect(q.choices).toHaveLength(cfg.choices)
          if (q.kind === 'month') {
            expect(q.choices).toHaveLength(cfg.choices)
            expect(new Set(q.choices).size).toBe(cfg.choices)
          }
        }
        // 「いまの季節は？」は最後
        if (cfg.askNow) expect(qs[qs.length - 1].kind).toBe('now')
      }
    }
  })

  it('季節の問題は、季節がかたよらない(6問なら各季節1〜2問)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const qs = buildQuestions(2, 'main', seededRng(seed))
      const count = { spring: 0, summer: 0, autumn: 0, winter: 0 }
      for (const q of qs) if (q.kind === 'season') count[q.thing.season]++
      for (const n of Object.values(count)) {
        expect(n).toBeGreaterThanOrEqual(1)
        expect(n).toBeLessThanOrEqual(2)
      }
    }
  })

  it('「いまの季節」は端末の日付で決まる', () => {
    const now: Question = { kind: 'now', choices: ['spring', 'summer', 'autumn', 'winter'] }
    expect(answerOf(now, new Date(2026, 3, 10))).toBe('spring')
    expect(answerOf(now, new Date(2026, 10, 15))).toBe('autumn')
    expect(answerOf(now, new Date(2027, 0, 5))).toBe('winter')
  })

  it('練習は2問で、「いまの季節は？」は出さない', () => {
    expect(buildQuestions(4, 'practice', seededRng(1))).toHaveLength(2)
  })
})

describe('choiceToRemove', () => {
  it('まちがいだけを消し、最後は答えとまちがい1つを残す', () => {
    const choices = [1, 2, 3, 4]
    const removed: number[] = []
    for (let k = 0; k < 5; k++) {
      const r = choiceToRemove(choices, 3, removed, seededRng(k))
      if (r === null) break
      expect(r).not.toBe(3)
      removed.push(r)
    }
    expect(removed).toHaveLength(2)
    expect(choiceToRemove([1, 2], 1, [], seededRng(1))).toBeNull()
  })
})
