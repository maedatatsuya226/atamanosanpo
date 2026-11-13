import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import { buildProblems, checkSlots, LEVELS, pickSteps, PROBLEMS, slotHint } from './logic'
import { SCENES } from './scenes'

describe('場面のデータ', () => {
  it('場面ごとに手順の文と絵が重ならず、4つ以上ある', () => {
    const ids = new Set<string>()
    for (const s of SCENES) {
      expect(ids.has(s.id)).toBe(false)
      ids.add(s.id)
      expect(s.steps.length).toBeGreaterThanOrEqual(4)
      expect(new Set(s.steps.map((x) => x.t)).size).toBe(s.steps.length)
    }
  })

  it('どのレベルでも、本番の問題数ぶん場面が足りる', () => {
    for (const lv of DIFFICULTIES) {
      const n = SCENES.filter((s) => s.steps.length >= LEVELS[lv].steps).length
      expect(n).toBeGreaterThanOrEqual(PROBLEMS.main)
    }
  })
})

describe('pickSteps', () => {
  it('順番を保ち、最初と最後を必ず含む', () => {
    for (let seed = 0; seed < 50; seed++) {
      const picked = pickSteps(SCENES[5].steps, 4, seededRng(seed))
      expect(picked).toHaveLength(4)
      expect(picked[0]).toBe(0)
      expect(picked[3]).toBe(SCENES[5].steps.length - 1)
      expect([...picked].sort((a, b) => a - b)).toEqual(picked)
      expect(new Set(picked).size).toBe(4)
    }
  })
})

describe('buildProblems', () => {
  it('全レベルで、手順とおとりの数が決めたとおりで、場面は重ならない', () => {
    for (const lv of DIFFICULTIES) {
      const cfg = LEVELS[lv]
      for (let seed = 0; seed < 40; seed++) {
        const ps = buildProblems(lv, 'main', seededRng(seed * 11 + lv))
        expect(ps).toHaveLength(PROBLEMS.main)
        expect(new Set(ps.map((p) => p.scene.id)).size).toBe(ps.length)
        for (const p of ps) {
          expect(p.answer).toHaveLength(cfg.steps)
          expect(p.cards).toHaveLength(cfg.steps + cfg.decoys)
          expect(p.cards.filter((c) => c.decoy)).toHaveLength(cfg.decoys)
          // 正しいカードはすべて置いてある
          for (const a of p.answer) expect(p.cards.some((c) => c.id === a.id)).toBe(true)
          // おとりはこの場面の手順と文も絵も重ならない
          const texts = new Set(p.scene.steps.map((s) => s.t))
          const icons = new Set(p.answer.map((c) => c.step.e))
          for (const d of p.cards.filter((c) => c.decoy)) {
            expect(texts.has(d.step.t)).toBe(false)
            expect(icons.has(d.step.e)).toBe(false)
          }
          // カードの id は重ならない
          expect(new Set(p.cards.map((c) => c.id)).size).toBe(p.cards.length)
        }
      }
    }
  })

  it('練習は3枚・おとりなし・1問', () => {
    const ps = buildProblems(5, 'practice', seededRng(1))
    expect(ps).toHaveLength(1)
    expect(ps[0].answer).toHaveLength(3)
    expect(ps[0].cards).toHaveLength(3)
  })
})

describe('判定とヒント', () => {
  it('正しく並べたときだけ全部 true、ヒントは最初の空き・まちがいの枠を指す', () => {
    const p = buildProblems(3, 'main', seededRng(4))[0]
    const right = p.answer.map((c) => c.id)
    expect(checkSlots(p, right).every(Boolean)).toBe(true)
    expect(slotHint(p, right)).toBeNull()

    const swapped = [right[1], right[0], ...right.slice(2)]
    expect(checkSlots(p, swapped)).toEqual([false, false, ...right.slice(2).map(() => true)])
    expect(slotHint(p, swapped)).toEqual({ slot: 0, cardId: right[0] })

    const partial = [right[0], null, null, null, null]
    expect(slotHint(p, partial)).toEqual({ slot: 1, cardId: right[1] })
  })
})
