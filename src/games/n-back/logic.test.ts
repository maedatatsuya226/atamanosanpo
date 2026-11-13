import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import { buildSequence, configFor, countTargets, isTarget, LEVELS, PICTURES, score } from './logic'

describe('buildSequence', () => {
  it('全レベルで、長さどおり・当たりは比べられる絵の25〜35%', () => {
    for (const lv of DIFFICULTIES) {
      const { n, items } = LEVELS[lv]
      for (let seed = 0; seed < 80; seed++) {
        const seq = buildSequence(n, items, seededRng(seed * 13 + lv))
        expect(seq).toHaveLength(items)
        for (const p of seq) expect(PICTURES).toContain(p)
        const t = countTargets(seq, n)
        expect(t).toBeGreaterThanOrEqual(Math.round((items - n) * 0.25))
        expect(t).toBeLessThanOrEqual(Math.round((items - n) * 0.35))
        // 最初の n 枚は比べる相手がないので当たりにならない
        for (let i = 0; i < n; i++) expect(isTarget(seq, i, n)).toBe(false)
      }
    }
  })

  it('練習は短く、ゆっくり', () => {
    const p = configFor(3, 'practice')
    expect(p.items).toBe(9)
    expect(p.showMs).toBeGreaterThan(LEVELS[3].showMs)
  })
})

describe('score', () => {
  it('当たりで押す・見のがし・まちがって押す を数える', () => {
    const seq = ['🍎', '🍎', '🍌', '🍎', '🍎']
    // 1バック: 当たりは 2枚目と5枚目
    expect(countTargets(seq, 1)).toBe(2)
    const r = (pressed: boolean) => ({ pressed, rtMs: pressed ? 500 : null })
    expect(score(seq, 1, [r(false), r(true), r(true), r(false), r(false)])).toEqual({
      hits: 1,
      misses: 1,
      falseAlarms: 1,
      targets: 2,
    })
    // 2バック: 当たりは 4枚目(🍎=2枚まえの🍎)だけ
    expect(countTargets(seq, 2)).toBe(1)
  })
})
