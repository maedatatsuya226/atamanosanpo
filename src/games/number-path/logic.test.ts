import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import {
  buildBoard,
  decoyBranchCount,
  isAdjacent,
  LEVELS,
  nextMoves,
  randomPath,
  reachableFrom,
  validateBoard,
} from './logic'

describe('randomPath', () => {
  it('となり合うマスだけでつながり、同じマスを通らない', () => {
    for (let seed = 0; seed < 100; seed++) {
      const p = randomPath(5, 14, seededRng(seed))
      if (!p) continue
      expect(new Set(p).size).toBe(14)
      for (let i = 1; i < p.length; i++) expect(isAdjacent(p[i - 1], p[i], 5)).toBe(true)
    }
  })
})

describe('buildBoard', () => {
  it('全レベルで正しい盤面ができる(道は1本、おとりは行き止まり)', () => {
    for (const lv of DIFFICULTIES) {
      const cfg = LEVELS[lv]
      for (let seed = 0; seed < 60; seed++) {
        const b = buildBoard(lv, seededRng(seed * 13 + lv))
        expect(b.values).toHaveLength(cfg.size * cfg.size)
        expect(b.path).toHaveLength(cfg.length)
        b.path.forEach((cell, i) => expect(b.values[cell]).toBe(i + 1))
        expect(validateBoard(b)).toBe(true)
        expect(decoyBranchCount(b.values, b.size, b.path, b.decoyCells)).toBeGreaterThanOrEqual(cfg.decoys)
      }
    }
  })

  it('おとりのあるマスでは、次の数字がとなりに2つある', () => {
    const b = buildBoard(5, seededRng(3))
    const branchPoints = b.path.filter((c) => nextMoves(b.values, b.size, c).length >= 2)
    expect(branchPoints.length).toBeGreaterThanOrEqual(LEVELS[5].decoys)
  })

  it('うめ草のマスにはスタートからたどり着けない', () => {
    for (let seed = 0; seed < 30; seed++) {
      const b = buildBoard(4, seededRng(seed))
      const fwd = reachableFrom(b.values, b.size, b.path[0])
      const allowed = new Set([...b.path, ...b.decoyCells])
      for (const c of fwd) expect(allowed.has(c)).toBe(true)
    }
  })
})
