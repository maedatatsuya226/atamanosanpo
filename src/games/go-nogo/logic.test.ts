import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import { buildItems, configFor, LEVELS, score } from './logic'

describe('きまり', () => {
  it('押す絵と押さない絵は重ならない', () => {
    for (const lv of DIFFICULTIES) {
      const { go, nogo } = LEVELS[lv]
      for (const g of go) expect(nogo).not.toContain(g)
    }
  })
})

describe('buildItems', () => {
  it('全レベルで、Go の割合どおり・最初の2枚は Go・No-Go は3枚続かない・絵はきまりどおり', () => {
    for (const lv of DIFFICULTIES) {
      const cfg = LEVELS[lv]
      for (let seed = 0; seed < 80; seed++) {
        const items = buildItems(cfg, seededRng(seed * 17 + lv))
        expect(items).toHaveLength(cfg.items)
        expect(items.filter((it) => !it.go)).toHaveLength(Math.round(cfg.items * (1 - cfg.goRate)))
        expect(items[0].go && items[1].go).toBe(true)
        for (let i = 2; i < items.length; i++) expect(!items[i].go && !items[i - 1].go && !items[i - 2].go).toBe(false)
        for (const it of items) expect((it.go ? cfg.go : cfg.nogo).includes(it.picture)).toBe(true)
      }
    }
  })

  it('練習は10枚', () => {
    expect(buildItems(configFor(4, 'practice'), seededRng(1))).toHaveLength(10)
  })
})

describe('score', () => {
  it('押せた・見のがし・押してしまった・がまんできた を数える', () => {
    const items = [
      { picture: '🍎', go: true },
      { picture: '🍎', go: true },
      { picture: '🐝', go: false },
      { picture: '🐝', go: false },
    ]
    const r = (pressed: boolean) => ({ pressed, rtMs: pressed ? 400 : null })
    expect(score(items, [r(true), r(false), r(true), r(false)])).toEqual({
      hits: 1,
      omissions: 1,
      commissions: 1,
      correctRejections: 1,
    })
  })
})
