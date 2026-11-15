import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import { buildProblems, cellHint, checkCells, LEVELS, PROBLEMS } from './logic'

describe('buildProblems', () => {
  it('全レベルで、大きさ・塗るマスの数・色の数がきまりどおりで、同じ模様は出ない', () => {
    for (const lv of DIFFICULTIES) {
      const cfg = LEVELS[lv]
      for (let seed = 0; seed < 60; seed++) {
        const ps = buildProblems(lv, 'main', seededRng(seed * 7 + lv))
        expect(ps).toHaveLength(PROBLEMS.main)
        expect(new Set(ps.map((p) => p.join())).size).toBe(ps.length)
        for (const p of ps) {
          expect(p).toHaveLength(cfg.size * cfg.size)
          const filled = p.filter((v) => v !== 0).length
          expect(filled).toBeGreaterThanOrEqual(cfg.minFill)
          expect(filled).toBeLessThanOrEqual(cfg.maxFill)
          for (const v of p) expect(v >= 0 && v <= cfg.colors).toBe(true)
          // どの色も使われている
          for (let c = 1; c <= cfg.colors; c++) expect(p).toContain(c)
        }
      }
    }
  })
})

describe('判定とヒント', () => {
  it('同じなら全部 true でヒントなし、ちがうマスは上から順にヒントになる', () => {
    const model = [1, 0, 2, 0, 1, 0, 2, 0, 1]
    expect(checkCells(model, [...model]).every(Boolean)).toBe(true)
    expect(cellHint(model, [...model])).toBeNull()
    const work = [1, 0, 0, 0, 2, 0, 2, 0, 1]
    expect(checkCells(model, work)).toEqual([true, true, false, true, false, true, true, true, true])
    expect(cellHint(model, work)).toEqual({ cell: 2, color: 2 })
    // 塗りすぎたマスは白(0)に戻すヒント
    expect(cellHint([0, 1], [2, 1])).toEqual({ cell: 0, color: 0 })
  })

  it('ヒントのとおりに塗れば見本と同じになる', () => {
    for (let seed = 0; seed < 20; seed++) {
      const model = buildProblems(5, 'main', seededRng(seed))[0]
      let work = new Array(model.length).fill(0)
      for (let k = 0; k < model.length + 1; k++) {
        const h = cellHint(model, work)
        if (!h) break
        work = work.map((v, i) => (i === h.cell ? h.color : v))
      }
      expect(work).toEqual(model)
    }
  })
})
