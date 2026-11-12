import { describe, expect, it } from 'vitest'
import { sample, seededRng, shuffle } from './random'
import { formatDuration, Stopwatch } from './stopwatch'

describe('Stopwatch', () => {
  it('一時停止中の時間を含めない', () => {
    let t = 0
    const sw = new Stopwatch(() => t)
    sw.start()
    t = 1000
    sw.pause()
    t = 5000 // 一時停止中
    sw.start()
    t = 6500
    expect(sw.elapsedMs()).toBe(2500)
  })

  it('start を2回呼んでも二重に数えない', () => {
    let t = 0
    const sw = new Stopwatch(() => t)
    sw.start()
    t = 500
    sw.start()
    t = 1000
    expect(sw.elapsedMs()).toBe(1000)
  })
})

describe('formatDuration', () => {
  it('60秒未満は小数1桁、以上は分秒', () => {
    expect(formatDuration(8400)).toBe('8.4秒')
    expect(formatDuration(65_000)).toBe('1分05秒')
  })
})

describe('random', () => {
  it('shuffle は要素を失わない', () => {
    const items = [1, 2, 3, 4, 5, 6]
    expect([...shuffle(items, seededRng(3))].sort()).toEqual(items)
  })

  it('sample は重複なし', () => {
    const s = sample([1, 2, 3, 4, 5, 6], 4, seededRng(9))
    expect(new Set(s).size).toBe(4)
  })

  it('seededRng は同じ種で同じ列になる', () => {
    const a = seededRng(42)
    const b = seededRng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})
