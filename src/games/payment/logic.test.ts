import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import { ALL_MONEY, buildProblems, fewestCoins, judge, LEVELS, payHint, total, type Money } from './logic'

/** すべての組み合わせを調べて最少枚数を求める(答え合わせ用。小さい金額だけ) */
function bruteFewest(price: number, kinds: readonly Money[]): number {
  const best = new Array<number>(price + 1).fill(Infinity)
  best[0] = 0
  for (let p = 1; p <= price; p++) for (const k of kinds) if (k <= p) best[p] = Math.min(best[p], best[p - k] + 1)
  return best[price]
}

describe('fewestCoins', () => {
  it('合計がちょうどで、枚数は全部調べた最少と同じ', () => {
    for (let price = 1; price <= 3000; price += 7) {
      const coins = fewestCoins(price, ALL_MONEY)
      expect(total(coins)).toBe(price)
      expect(coins.length).toBe(bruteFewest(price, ALL_MONEY))
    }
  })

  it('使えるお金が少ないレベルでも正しい', () => {
    const kinds = LEVELS[1].kinds
    for (let price = 10; price <= 100; price += 10) {
      expect(total(fewestCoins(price, kinds))).toBe(price)
      expect(fewestCoins(price, kinds).length).toBe(bruteFewest(price, kinds))
    }
  })

  it('例: 368円は 100×3・50・10・5・1×3 の9枚', () => {
    expect(fewestCoins(368, ALL_MONEY)).toEqual([100, 100, 100, 50, 10, 5, 1, 1, 1])
  })
})

describe('buildProblems', () => {
  it('全レベルで、金額は範囲内・きざみどおり・重ならず、使えるお金で払える', () => {
    for (const lv of DIFFICULTIES) {
      const cfg = LEVELS[lv]
      for (let seed = 0; seed < 50; seed++) {
        const prices = buildProblems(lv, 'main', seededRng(seed * 3 + lv))
        expect(prices).toHaveLength(5)
        expect(new Set(prices).size).toBe(5)
        for (const p of prices) {
          expect(p).toBeGreaterThanOrEqual(cfg.min)
          expect(p).toBeLessThanOrEqual(cfg.max)
          expect(p % cfg.unit).toBe(0)
          expect(cfg.kinds.includes(p as Money)).toBe(false)
          expect(total(fewestCoins(p, cfg.kinds))).toBe(p)
        }
      }
    }
  })
})

describe('judge', () => {
  const lv3 = LEVELS[3]
  const lv5 = LEVELS[5]
  it('足りない・多すぎる・ちょうどを正しく判定する', () => {
    expect(judge(368, [100, 100, 100, 50, 10, 5, 1, 1], lv3)).toBe('short')
    expect(judge(368, [500], lv3)).toBe('over')
    expect(judge(368, [100, 100, 100, 50, 10, 5, 1, 1, 1], lv3)).toBe('ok')
    // 枚数が多くても、ちょうどなら正解(レベル5以外)
    expect(judge(368, [100, 100, 100, 10, 10, 10, 10, 10, 10, 5, 1, 1, 1], lv3)).toBe('ok')
  })

  it('レベル5は、ちょうどでも枚数が多いとやり直し', () => {
    expect(judge(368, [100, 100, 100, 10, 10, 10, 10, 10, 10, 5, 1, 1, 1], lv5)).toBe('not-fewest')
    expect(judge(368, fewestCoins(368, lv5.kinds), lv5)).toBe('ok')
    expect(judge(1500, [1000, 500], lv5)).toBe('ok')
    expect(judge(1500, [500, 500, 500], lv5)).toBe('not-fewest')
  })
})

describe('payHint', () => {
  const lv4 = LEVELS[4]
  const lv5 = LEVELS[5]
  it('ヒントどおりに出し入れすると、必ずちょうどになる', () => {
    for (let seed = 0; seed < 30; seed++) {
      for (const price of buildProblems(5, 'main', seededRng(seed))) {
        // わざと多すぎる状態から始める
        let tray: Money[] = [1000, 1000, 1000, 500]
        for (let guard = 0; guard < 60; guard++) {
          const h = payHint(price, tray, lv5)
          if (h.kind === 'done') break
          if (h.kind === 'add') tray = [...tray, h.money]
          else tray = tray.filter((_, i) => i !== tray.indexOf(h.money))
        }
        expect(judge(price, tray, lv5)).toBe('ok')
      }
    }
  })

  it('足りないときは残りをこえない最大のお金、多すぎるときはいちばん大きいお金を示す', () => {
    expect(payHint(368, [100, 100], lv4)).toEqual({ kind: 'add', money: 100 })
    expect(payHint(368, [100, 100, 100, 50], lv4)).toEqual({ kind: 'add', money: 10 })
    expect(payHint(368, [500, 10], lv4)).toEqual({ kind: 'remove', money: 500 })
    expect(payHint(368, fewestCoins(368, lv4.kinds), lv4)).toEqual({ kind: 'done' })
  })
})

describe('payHint(全レベル・いろいろな出し方から)', () => {
  it('どんな出し方から始めても、ヒントどおりに進めば正解になる', () => {
    for (const lv of DIFFICULTIES) {
      const cfg = LEVELS[lv]
      for (let seed = 0; seed < 20; seed++) {
        const rng = seededRng(seed * 7 + lv)
        for (const price of buildProblems(lv, 'main', rng)) {
          // 使えるお金をランダムに何枚か出した状態から
          let tray: Money[] = Array.from({ length: Math.floor(rng() * 8) }, () => cfg.kinds[Math.floor(rng() * cfg.kinds.length)])
          let steps = 0
          for (; steps < 80; steps++) {
            const h = payHint(price, tray, cfg)
            if (h.kind === 'done') break
            if (h.kind === 'add') {
              expect(cfg.kinds).toContain(h.money)
              tray = [...tray, h.money]
            } else {
              expect(tray).toContain(h.money)
              tray = tray.filter((_, i) => i !== tray.indexOf(h.money))
            }
          }
          expect(steps).toBeLessThan(80)
          expect(judge(price, tray, cfg)).toBe('ok')
        }
      }
    }
  })
})
