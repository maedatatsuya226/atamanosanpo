import { describe, expect, it } from 'vitest'
import { DIFFICULTIES } from '../../core/types'
import {
  classifyTendency,
  describeDiff,
  formatSigned,
  isDisplayVisible,
  isWithinTolerance,
  LEVELS,
  roundTenth,
  summarizeErrors,
  toleranceSec,
  TRIALS,
} from './logic'

describe('toleranceSec / isWithinTolerance', () => {
  it('目標の10%、ただし最低0.5秒', () => {
    expect(toleranceSec(5)).toBe(0.5)
    expect(toleranceSec(3)).toBe(0.5)
    expect(toleranceSec(10)).toBe(1)
    expect(toleranceSec(15)).toBe(1.5)
  })

  it('境界ちょうどは成功、それを超えると失敗', () => {
    expect(isWithinTolerance(5.5, 5)).toBe(true)
    expect(isWithinTolerance(4.5, 5)).toBe(true)
    expect(isWithinTolerance(5.6, 5)).toBe(false)
    expect(isWithinTolerance(4.4, 5)).toBe(false)
    expect(isWithinTolerance(11.0, 10)).toBe(true)
    expect(isWithinTolerance(8.9, 10)).toBe(false)
    expect(isWithinTolerance(16.5, 15)).toBe(true)
    expect(isWithinTolerance(13.4, 15)).toBe(false)
  })

  it('0.1秒に丸めた値で判定すると、表示とずれない', () => {
    expect(roundTenth(5.54)).toBe(5.5)
    expect(isWithinTolerance(roundTenth(5.54), 5)).toBe(true)
    expect(isWithinTolerance(roundTenth(5.56), 5)).toBe(false)
  })
})

describe('表示が消える時刻', () => {
  it('レベルごとの目標と消える時刻', () => {
    expect(DIFFICULTIES.map((lv) => [LEVELS[lv].targetSec, LEVELS[lv].hideAfterSec])).toEqual([
      [5, null],
      [5, 2],
      [10, 3],
      [10, 0],
      [15, 0],
    ])
  })

  it('レベル1はずっと表示', () => {
    for (const t of [0, 1, 5, 30]) expect(isDisplayVisible(LEVELS[1], t)).toBe(true)
  })

  it('レベル2は2秒、レベル3は3秒で消える', () => {
    expect(isDisplayVisible(LEVELS[2], 1.9)).toBe(true)
    expect(isDisplayVisible(LEVELS[2], 2.0)).toBe(false)
    expect(isDisplayVisible(LEVELS[3], 2.9)).toBe(true)
    expect(isDisplayVisible(LEVELS[3], 3.0)).toBe(false)
  })

  it('レベル4・5ははじめから表示なし', () => {
    expect(isDisplayVisible(LEVELS[4], 0)).toBe(false)
    expect(isDisplayVisible(LEVELS[5], 0)).toBe(false)
  })

  it('消える時刻は目標より前', () => {
    for (const lv of DIFFICULTIES) {
      const h = LEVELS[lv].hideAfterSec
      if (h !== null) expect(h).toBeLessThan(LEVELS[lv].targetSec)
    }
  })

  it('本番5回・練習2回', () => {
    expect(TRIALS).toEqual({ main: 5, practice: 2 })
  })
})

describe('summarizeErrors', () => {
  it('符号つきの平均と大きさの平均', () => {
    const s = summarizeErrors([0.4, -0.2, 0.7, -0.1])!
    expect(s.meanSigned).toBeCloseTo(0.2)
    expect(s.meanAbs).toBeCloseTo(0.35)
  })

  it('空なら null', () => {
    expect(summarizeErrors([])).toBeNull()
  })
})

describe('classifyTendency', () => {
  it('一貫して早い・遅い', () => {
    expect(classifyTendency([-0.6, -0.4, -0.8, -0.3, -0.5], 5)).toBe('はやめ')
    expect(classifyTendency([1.2, 0.8, 2.0, 1.5, 0.9], 10)).toBe('おそめ')
  })

  it('早い・遅いが混ざって打ち消し合い、ずれが大きい → ばらつき', () => {
    expect(classifyTendency([2.0, -1.8, 1.5, -2.2, 0.4], 10)).toBe('ばらつき')
  })

  it('おおむね合っている → かたよりなし', () => {
    expect(classifyTendency([0.1, -0.2, 0.0, 0.1, -0.1], 5)).toBe('かたよりなし')
    expect(classifyTendency([], 5)).toBe('かたよりなし')
  })

  it('平均は一方向でも、ばらつきが大きければ方向とはしない', () => {
    // 平均 +0.6 (>= 0.5) だが、大きさの平均 2.2 の半分に満たない
    expect(classifyTendency([3, -2, 3, -2, 1], 10)).toBe('ばらつき')
  })
})

describe('表示用の文字', () => {
  it('formatSigned', () => {
    expect(formatSigned(0.4)).toBe('+0.4')
    expect(formatSigned(-0.34)).toBe('-0.3')
    expect(formatSigned(0.02)).toBe('±0.0')
  })

  it('describeDiff', () => {
    expect(describeDiff(5.4, 5)).toBe('0.4びょう おそい')
    expect(describeDiff(4.7, 5)).toBe('0.3びょう はやい')
    expect(describeDiff(5.0, 5)).toBe('ぴったり')
  })
})
