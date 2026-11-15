import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import { buildRound, configFor, ITEMS, LEVELS, scoreRound, studyMs } from './logic'

describe('品物のデータ', () => {
  it('名前も絵も重ならない', () => {
    expect(new Set(ITEMS.map((i) => i.name)).size).toBe(ITEMS.length)
    expect(new Set(ITEMS.map((i) => i.e)).size).toBe(ITEMS.length)
  })
})

describe('buildRound', () => {
  it('全レベルで、メモの品物は棚に全部あり、棚の数どおり・重なりなし', () => {
    for (const lv of DIFFICULTIES) {
      const cfg = LEVELS[lv]
      for (let seed = 0; seed < 60; seed++) {
        const r = buildRound(cfg, seededRng(seed * 13 + lv))
        expect(r.memo).toHaveLength(cfg.count)
        expect(r.shelf).toHaveLength(cfg.shelf)
        expect(new Set(r.shelf.map((i) => i.name)).size).toBe(cfg.shelf)
        for (const m of r.memo) expect(r.shelf).toContain(m)
      }
    }
  })

  it('メモの品物は種類がばらける(6つなら全部ちがう種類)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const r = buildRound(LEVELS[4], seededRng(seed))
      expect(new Set(r.memo.map((m) => m.kind)).size).toBe(6)
    }
  })

  it('レベル5は、棚のほかの品物がメモと同じ種類にかたよる', () => {
    let same5 = 0
    let same4 = 0
    for (let seed = 0; seed < 40; seed++) {
      const count = (lv: 4 | 5) => {
        const r = buildRound(LEVELS[lv], seededRng(seed))
        const kinds = new Set(r.memo.map((m) => m.kind))
        return r.shelf.filter((i) => !r.memo.includes(i) && kinds.has(i.kind)).length
      }
      same5 += count(5)
      same4 += count(4)
    }
    expect(same5).toBeGreaterThan(same4)
  })

  it('練習は3つ・棚は6つ', () => {
    const cfg = configFor(5, 'practice')
    expect(cfg.count).toBe(3)
    expect(cfg.shelf).toBe(6)
    expect(studyMs(cfg)).toBe(10500)
  })
})

describe('scoreRound', () => {
  it('選べた・見落とし・まちがいを数える', () => {
    const r = buildRound(LEVELS[2], seededRng(1))
    const other = r.shelf.find((i) => !r.memo.includes(i))!
    const sel = new Set([r.memo[0].name, r.memo[1].name, other.name])
    expect(scoreRound(r, sel)).toEqual({ total: 4, hits: 2, misses: 2, falseAlarms: 1 })
  })
})
