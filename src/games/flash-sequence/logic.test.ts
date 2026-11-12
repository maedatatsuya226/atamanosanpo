import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import { buildSequence, expectedOrder, LEVELS, showSteps, TILE_COUNT } from './logic'

describe('buildSequence', () => {
  it('レベルの個数で、同じパネルを2回使わない', () => {
    for (const lv of DIFFICULTIES) {
      for (let seed = 0; seed < 100; seed++) {
        const seq = buildSequence(LEVELS[lv].length, seededRng(seed))
        expect(seq).toHaveLength(LEVELS[lv].length)
        expect(new Set(seq).size).toBe(seq.length)
        for (const t of seq) expect(t >= 0 && t < TILE_COUNT).toBe(true)
      }
    }
  })
})

describe('expectedOrder', () => {
  it('逆順のレベルでは逆に並べる', () => {
    expect(expectedOrder([3, 1, 7], false)).toEqual([3, 1, 7])
    expect(expectedOrder([3, 1, 7], true)).toEqual([7, 1, 3])
  })

  it('元の配列を書き換えない', () => {
    const seq = [1, 2, 3]
    expectedOrder(seq, true)
    expect(seq).toEqual([1, 2, 3])
  })
})

describe('showSteps', () => {
  it('光る→消える を交互に、個数ぶん並べる', () => {
    const steps = showSteps([4, 2], LEVELS[1])
    expect(steps).toEqual([
      { tile: 4, ms: 1000 },
      { tile: null, ms: 500 },
      { tile: 2, ms: 1000 },
      { tile: null, ms: 500 },
    ])
  })
})
