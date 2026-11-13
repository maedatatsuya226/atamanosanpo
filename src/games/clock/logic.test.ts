import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import { buildProblems, clockHint, DAY, handAngles, LEVELS, PROBLEMS, speak, speakDuration, toHM, wrap } from './logic'

describe('時刻の表し方', () => {
  it('分と時の変換、読み方', () => {
    expect(toHM(0)).toEqual({ h: 12, m: 0 })
    expect(toHM(3 * 60 + 30)).toEqual({ h: 3, m: 30 })
    expect(toHM(DAY + 75)).toEqual({ h: 1, m: 15 })
    expect(wrap(-10)).toBe(DAY - 10)
    expect(speak(3 * 60)).toBe('3じ')
    expect(speak(3 * 60 + 30)).toBe('3じ 30ぷん')
    expect(speak(10 * 60 + 15)).toBe('10じ 15ふん')
    expect(speak(7 * 60 + 5)).toBe('7じ 5ふん')
    expect(speak(12 * 60 + 40)).toBe('12じ 40ぷん')
    expect(speakDuration(40)).toBe('40ぷん')
    expect(speakDuration(45)).toBe('45ふん')
    expect(speakDuration(60)).toBe('1じかん')
    expect(speakDuration(90)).toBe('1じかん 30ぷん')
  })

  it('針の角度: 3じ 30ぷん なら短い針は3と4のまんなか、長い針は真下', () => {
    expect(handAngles(3 * 60 + 30)).toEqual({ hour: 105, minute: 180 })
    expect(handAngles(0)).toEqual({ hour: 0, minute: 0 })
  })
})

describe('buildProblems', () => {
  it('全レベルで、答えの時刻が針のきざみで合わせられ、最初の位置と同じでなく、重ならない', () => {
    for (const lv of DIFFICULTIES) {
      const cfg = LEVELS[lv]
      for (let seed = 0; seed < 60; seed++) {
        const ps = buildProblems(lv, 'main', seededRng(seed * 5 + lv))
        expect(ps).toHaveLength(PROBLEMS.main)
        expect(new Set(ps.map((p) => p.target)).size).toBe(ps.length)
        for (const p of ps) {
          expect(p.target).not.toBe(p.start)
          const unit = cfg.minuteStep === 0 ? 60 : cfg.minuteStep
          // 長い針は unit 分ずつ、短い針は1時間ずつ動くので、最初の位置から合わせられる
          expect(wrap(p.target - p.start) % unit).toBe(0)
          if (cfg.after) {
            expect(p.after).not.toBeNull()
            expect(wrap(p.start + p.after!)).toBe(p.target)
          } else {
            expect(p.after).toBeNull()
            expect(p.start).toBe(0)
          }
        }
      }
    }
  })
})

describe('clockHint', () => {
  it('長い針がずれていれば長い針、合っていれば短い針、両方合えば null', () => {
    expect(clockHint(3 * 60 + 30, 3 * 60)).toEqual({ hand: 'minute' })
    expect(clockHint(3 * 60 + 30, 5 * 60 + 30)).toEqual({ hand: 'hour' })
    expect(clockHint(3 * 60 + 30, 3 * 60 + 30)).toBeNull()
  })
})
