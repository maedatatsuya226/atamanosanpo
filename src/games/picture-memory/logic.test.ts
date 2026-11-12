import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import {
  buildRound,
  CATEGORIES,
  fitGrid,
  LEVELS,
  levelConfig,
  PICTURES,
  PRACTICE_LEVEL,
  roundMark,
  scoreRound,
  studyMs,
} from './logic'

describe('PICTURES', () => {
  it('名前も絵も重複しない', () => {
    expect(new Set(PICTURES.map((p) => p.name)).size).toBe(PICTURES.length)
    expect(new Set(PICTURES.map((p) => p.emoji)).size).toBe(PICTURES.length)
  })

  it('名前はひらがなで、カードに収まる長さ', () => {
    for (const p of PICTURES) {
      expect(p.name).toMatch(/^[ぁ-ゖー]+$/)
      expect(p.name.length).toBeLessThanOrEqual(6)
    }
  })

  it('どの仲間も、似た絵のレベルに使えるだけの枚数がある', () => {
    for (const c of CATEGORIES) {
      expect(PICTURES.filter((p) => p.category === c).length).toBeGreaterThanOrEqual(4)
    }
    expect(PICTURES.length).toBeGreaterThanOrEqual(60)
  })
})

describe('buildRound', () => {
  it('覚える絵と同じ数のまちがいの絵が混ざり、重複しない', () => {
    for (const lv of DIFFICULTIES) {
      const cfg = LEVELS[lv]
      for (let seed = 0; seed < 100; seed++) {
        const r = buildRound(cfg, seededRng(seed * 13 + lv))
        expect(r.targets).toHaveLength(cfg.count)
        expect(r.choices).toHaveLength(cfg.count * 2)
        expect(new Set(r.choices.map((p) => p.name)).size).toBe(cfg.count * 2)
        for (const t of r.targets) expect(r.choices).toContain(t)
      }
    }
  })

  it('似た絵なしのレベルでは、まちがいの絵は覚える絵と別の仲間', () => {
    for (const lv of [1, 2, 3, 4] as const) {
      for (let seed = 0; seed < 100; seed++) {
        const r = buildRound(LEVELS[lv], seededRng(seed))
        const cats = new Set(r.targets.map((t) => t.category))
        expect(cats.size).toBe(r.targets.length)
        const distractors = r.choices.filter((c) => !r.targets.includes(c))
        for (const d of distractors) expect(cats.has(d.category)).toBe(false)
      }
    }
  })

  it('レベル5では、まちがいの絵はすべて覚える絵と同じ仲間', () => {
    for (let seed = 0; seed < 100; seed++) {
      const r = buildRound(LEVELS[5], seededRng(seed))
      const cats = new Set(r.targets.map((t) => t.category))
      const distractors = r.choices.filter((c) => !r.targets.includes(c))
      expect(distractors).toHaveLength(8)
      for (const d of distractors) expect(cats.has(d.category)).toBe(true)
    }
  })

  it('同じ seed なら同じ問題になる', () => {
    expect(buildRound(LEVELS[3], seededRng(42))).toEqual(buildRound(LEVELS[3], seededRng(42)))
  })
})

describe('レベル設定', () => {
  it('練習は3枚・すぐ回答', () => {
    expect(levelConfig(5, 'practice')).toEqual(PRACTICE_LEVEL)
    expect(PRACTICE_LEVEL).toEqual({ count: 3, delaySec: 0, similar: false })
    expect(levelConfig(4, 'main')).toBe(LEVELS[4])
  })

  it('提示時間は1枚2.5秒', () => {
    expect(studyMs(LEVELS[1])).toBe(7500)
    expect(studyMs(LEVELS[5])).toBe(20000)
  })
})

describe('scoreRound / roundMark', () => {
  const round = buildRound(LEVELS[2], seededRng(1))
  const t = round.targets.map((p) => p.name)
  const d = round.choices.filter((c) => !round.targets.includes(c)).map((p) => p.name)

  it('あたり・見落とし・まちがいを数える', () => {
    const s = scoreRound(round, new Set([t[0], t[1], t[2], d[0]]))
    expect(s).toEqual({ hits: 3, misses: 1, falseAlarms: 1, total: 4 })
    expect(roundMark(s)).toBe('partial')
  })

  it('全部正解なら○、少しまちがえたら△、半分以下なら×', () => {
    expect(roundMark(scoreRound(round, new Set(t)))).toBe('correct')
    expect(roundMark(scoreRound(round, new Set([t[0], t[1], t[2]])))).toBe('partial')
    expect(roundMark(scoreRound(round, new Set([t[0], t[1]])))).toBe('wrong')
    expect(roundMark(scoreRound(round, new Set([...t, ...d])))).toBe('wrong')
    expect(roundMark(scoreRound(round, new Set()))).toBe('wrong')
  })
})

describe('fitGrid', () => {
  it('16枚を横長・縦長の画面に収める', () => {
    for (const [w, h] of [
      [976, 480],
      [1132, 540],
      [772, 860],
    ]) {
      const g = fitGrid(16, w, h, 12, 1.25)
      expect(g.cols * g.rows).toBeGreaterThanOrEqual(16)
      expect(g.cols * g.card + (g.cols - 1) * 12).toBeLessThanOrEqual(w)
      expect(g.rows * g.card * 1.25 + (g.rows - 1) * 12).toBeLessThanOrEqual(h)
      expect(g.card).toBeGreaterThanOrEqual(100)
    }
  })

  it('最大の大きさを超えない', () => {
    expect(fitGrid(3, 1000, 600, 12, 1.25, 200).card).toBe(200)
  })
})
