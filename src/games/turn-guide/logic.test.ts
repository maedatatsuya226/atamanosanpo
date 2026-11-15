import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import { buildQuestions, checkAnswers, incomingDir, LEVELS, MAP_COLS, MAP_ROWS, questionCount, relOf, turn } from './logic'

describe('向きの計算', () => {
  it('上向きの車が右に曲がると右向き、下向きの車が右に曲がると左向き', () => {
    expect(turn(0, 'right')).toBe(1)
    expect(turn(0, 'left')).toBe(3)
    expect(turn(2, 'right')).toBe(3)
    expect(turn(2, 'left')).toBe(1)
    expect(turn(1, 'straight')).toBe(1)
  })

  it('relOf は turn の逆で、Uターンは null', () => {
    for (const d of [0, 1, 2, 3] as const) {
      for (const r of ['left', 'straight', 'right'] as const) expect(relOf(d, turn(d, r))).toBe(r)
      expect(relOf(d, ((d + 2) % 4) as 0 | 1 | 2 | 3)).toBeNull()
    }
  })
})

describe('buildQuestions', () => {
  it('全レベルで、道は地図の中・となりどうしをつなぎ・同じ所を通らず、答えは道の曲がり方と合う', () => {
    for (const lv of DIFFICULTIES) {
      const cfg = LEVELS[lv]
      for (let seed = 0; seed < 40; seed++) {
        const qs = buildQuestions(lv, 'main', seededRng(seed * 11 + lv))
        expect(qs).toHaveLength(questionCount(lv, 'main'))
        for (const r of qs) {
          expect(cfg.headings).toContain(r.heading)
          expect(r.answers).toHaveLength(cfg.turns)
          expect(r.nodes).toHaveLength(cfg.turns + 2)
          expect(new Set(r.nodes).size).toBe(r.nodes.length)
          for (const n of r.nodes) expect(n >= 0 && n < MAP_COLS * MAP_ROWS).toBe(true)
          // 最初の区間は車の向きに進む
          expect(incomingDir(r, 0)).toBe(r.heading)
          // 曲がり角ごとの答え = 入ってくる向き → 出ていく向き
          for (let k = 0; k < cfg.turns; k++) expect(relOf(incomingDir(r, k), incomingDir(r, k + 1))).toBe(r.answers[k])
          // 全部まっすぐにはならない
          expect(r.answers.some((a) => a !== 'straight')).toBe(true)
          // 曲がり角は地図のふちにない
          for (const n of r.nodes.slice(1, -1)) {
            const c = n % MAP_COLS
            const row = Math.floor(n / MAP_COLS)
            expect(c > 0 && c < MAP_COLS - 1 && row > 0 && row < MAP_ROWS - 1).toBe(true)
          }
        }
      }
    }
  })

  it('レベル2は上向きと下向きの両方が出る(下向きの車では画面の左右と車の左右が逆)', () => {
    const headings = new Set(buildQuestions(2, 'main', seededRng(3)).map((r) => r.heading))
    expect(headings.has(0) || headings.has(2)).toBe(true)
    const all = new Set<number>()
    for (let s = 0; s < 10; s++) for (const r of buildQuestions(2, 'main', seededRng(s))) all.add(r.heading)
    expect([...all].sort()).toEqual([0, 2])
  })
})

describe('checkAnswers', () => {
  it('曲がり角ごとに正誤を返す', () => {
    const r = buildQuestions(5, 'main', seededRng(2))[0]
    expect(checkAnswers(r, r.answers).every(Boolean)).toBe(true)
    const wrong = r.answers.map((a) => (a === 'left' ? 'right' : 'left'))
    expect(checkAnswers(r, wrong).every((x) => !x)).toBe(true)
    expect(checkAnswers(r, [r.answers[0], null, null])).toEqual([true, false, false])
  })
})
