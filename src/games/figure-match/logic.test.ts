import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import {
  buildTrial,
  isConnected,
  isSameShape,
  LEVELS,
  MAX_SPAN,
  mirror,
  mutate,
  randomShape,
  rotate90,
  span,
  type Cell,
} from './logic'

const L_SHAPE: Cell[] = [
  [0, 0],
  [1, 0],
  [2, 0],
  [2, 1],
]

describe('図形の変換', () => {
  it('4回まわすと元に戻る', () => {
    const r = rotate90(rotate90(rotate90(rotate90(L_SHAPE))))
    expect(isSameShape(r, L_SHAPE, false)).toBe(true)
  })

  it('回転を許すときだけ、回した図形を同じとみなす', () => {
    expect(isSameShape(rotate90(L_SHAPE), L_SHAPE, true)).toBe(true)
    expect(isSameShape(rotate90(L_SHAPE), L_SHAPE, false)).toBe(false)
  })

  it('L字の鏡像は回しても重ならない', () => {
    expect(isSameShape(mirror(L_SHAPE), L_SHAPE, true)).toBe(false)
  })
})

describe('randomShape / mutate', () => {
  it('指定のマス数で、つながっていて、表示枠に収まる', () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = seededRng(seed)
      for (const n of [4, 5, 6]) {
        const s = randomShape(n, rng)
        expect(s).toHaveLength(n)
        expect(isConnected(s)).toBe(true)
        expect(span(s).rows).toBeLessThanOrEqual(MAX_SPAN)
        expect(span(s).cols).toBeLessThanOrEqual(MAX_SPAN)

        const m = mutate(s, rng)
        if (m) {
          expect(m).toHaveLength(n)
          expect(isConnected(m)).toBe(true)
        }
      }
    }
  })
})

describe('buildTrial', () => {
  it('正解はちょうど1つで、選択肢どうしも見分けがつく', () => {
    for (const lv of DIFFICULTIES) {
      const cfg = LEVELS[lv]
      for (let seed = 0; seed < 100; seed++) {
        const t = buildTrial(lv, seededRng(seed * 7 + lv))
        expect(t.options).toHaveLength(cfg.optionCount)

        const sameAsSample = t.options.filter((o) => isSameShape(o.shape, t.sample, cfg.rotate))
        expect(sameAsSample).toHaveLength(1)
        expect(sameAsSample[0].isAnswer).toBe(true)

        for (let i = 0; i < t.options.length; i++) {
          for (let j = i + 1; j < t.options.length; j++) {
            expect(isSameShape(t.options[i].shape, t.options[j].shape, cfg.rotate)).toBe(false)
          }
        }
      }
    }
  })

  it('レベル5では見本の鏡像が選択肢に入る(不正解として)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const t = buildTrial(5, seededRng(seed))
      const flipped = mirror(t.sample)
      const hit = t.options.filter((o) => isSameShape(o.shape, flipped, true))
      expect(hit).toHaveLength(1)
      expect(hit[0].isAnswer).toBe(false)
    }
  })

  it('回転しないレベルでは、正解は見本とまったく同じ向き', () => {
    for (const lv of [1, 2] as const) {
      for (let seed = 0; seed < 50; seed++) {
        const t = buildTrial(lv, seededRng(seed))
        const answer = t.options.find((o) => o.isAnswer)!
        expect(isSameShape(answer.shape, t.sample, false)).toBe(true)
      }
    }
  })
})
