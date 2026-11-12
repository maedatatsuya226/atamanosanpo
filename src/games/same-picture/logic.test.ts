import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import {
  buildRound,
  countBySide,
  GROUPS,
  groupOf,
  itemCountFor,
  layoutSlots,
  LEVELS,
  PRACTICE_COUNT,
  sideOf,
  targetCount,
  type Field,
} from './logic'

/** iPad の画面で、課題の絵を並べる範囲のおおよその大きさ(見出し・上部バーを除く) */
const LANDSCAPE_1024: Field = { width: 960, height: 560 }
const LANDSCAPE_1180: Field = { width: 1130, height: 610 }
const PORTRAIT_820: Field = { width: 760, height: 960 }
const FIELDS = [LANDSCAPE_1024, LANDSCAPE_1180, PORTRAIT_820]

describe('絵文字のグループ', () => {
  it('同じ絵文字が2つのグループに入っていない', () => {
    const all = GROUPS.flatMap((g) => g.items)
    expect(new Set(all).size).toBe(all.length)
  })
  it('どのグループも3種類以上ある', () => {
    for (const g of GROUPS) expect(g.items.length).toBeGreaterThanOrEqual(3)
  })
  it('旗・肌の色・合成(ZWJ)・異体字セレクタを含まない', () => {
    for (const e of GROUPS.flatMap((g) => g.items)) {
      expect(e).not.toMatch(/[‍️]/u)
      expect(e).not.toMatch(/[\u{1f3fb}-\u{1f3ff}]/u)
      expect(e).not.toMatch(/[\u{1f1e6}-\u{1f1ff}]/u)
    }
  })
})

describe('targetCount', () => {
  it('約2割・最低4個', () => {
    expect(targetCount(12)).toBe(4)
    expect(targetCount(20)).toBe(4)
    expect(targetCount(30)).toBe(6)
    expect(targetCount(40)).toBe(8)
    expect(targetCount(50)).toBe(10)
    expect(targetCount(60)).toBe(12)
  })
})

describe('buildRound', () => {
  it('全レベル・本番/練習で、絵の数と正解の数が合い、正解は見本と同じ絵', () => {
    for (const lv of DIFFICULTIES) {
      for (const mode of ['main', 'practice'] as const) {
        for (let seed = 0; seed < 40; seed++) {
          const r = buildRound(lv, mode, FIELDS[seed % 3], seededRng(seed * 17 + lv))
          const count = itemCountFor(lv, mode)
          expect(count).toBe(mode === 'practice' ? PRACTICE_COUNT : LEVELS[lv].count)
          expect(r.items).toHaveLength(count)
          const targets = r.items.filter((it) => it.isTarget)
          expect(targets).toHaveLength(targetCount(count))
          expect(targets.length / count).toBeGreaterThanOrEqual(0.19)
          for (const it of r.items) expect(it.isTarget).toBe(it.emoji === r.sample)
        }
      }
    }
  })

  it('正解は左右の両方にあり、ほぼ半分ずつ', () => {
    for (const lv of DIFFICULTIES) {
      for (let seed = 0; seed < 40; seed++) {
        const r = buildRound(lv, seed % 2 ? 'main' : 'practice', FIELDS[seed % 3], seededRng(seed + 100 * lv))
        const sides = countBySide(r, new Set())
        expect(sides.left.total).toBeGreaterThan(0)
        expect(sides.right.total).toBeGreaterThan(0)
        expect(Math.abs(sides.left.total - sides.right.total)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('似た絵なしのレベルには、見本と同じグループ・同じ分類の絵が出ない', () => {
    for (const lv of [1, 2] as const) {
      for (let seed = 0; seed < 80; seed++) {
        const r = buildRound(lv, 'main', LANDSCAPE_1024, seededRng(seed))
        const g = groupOf(r.sample)!
        for (const it of r.items) {
          if (it.isTarget) continue
          expect(g.items.includes(it.emoji)).toBe(false)
          expect(groupOf(it.emoji)!.category).not.toBe(g.category)
          expect(it.similar).toBe(false)
        }
      }
    }
  })

  it('似た絵ありのレベルには、見本と同じグループの絵が混ざる(上のレベルほど多い)', () => {
    const avgSimilar = (lv: 3 | 4 | 5) => {
      let sum = 0
      for (let seed = 0; seed < 40; seed++) {
        const r = buildRound(lv, 'main', LANDSCAPE_1024, seededRng(seed))
        const g = groupOf(r.sample)!
        const sim = r.items.filter((it) => !it.isTarget && g.items.includes(it.emoji))
        expect(sim.length).toBeGreaterThan(0)
        for (const it of r.items) expect(it.similar).toBe(!it.isTarget && g.items.includes(it.emoji))
        sum += sim.length / (r.items.length - targetCount(r.items.length))
      }
      return sum / 40
    }
    const s3 = avgSimilar(3)
    const s4 = avgSimilar(4)
    const s5 = avgSimilar(5)
    expect(s3).toBeLessThan(s4)
    expect(s4).toBeLessThan(s5)
  })
})

describe('layoutSlots', () => {
  it('画面の中に収まり、○どうし・当たり判定どうしが重ならない', () => {
    for (const field of FIELDS) {
      for (const count of [12, 20, 30, 40, 50, 60]) {
        const { slots, ringR } = layoutSlots(count, field, seededRng(count))
        expect(slots).toHaveLength(count)
        for (const s of slots) {
          expect(s.x - ringR).toBeGreaterThanOrEqual(0)
          expect(s.y - ringR).toBeGreaterThanOrEqual(0)
          expect(s.x + ringR).toBeLessThanOrEqual(field.width)
          expect(s.y + ringR).toBeLessThanOrEqual(field.height)
          // ○は自分のマスの中に収まる
          expect(s.x - ringR).toBeGreaterThanOrEqual(s.cell.x)
          expect(s.x + ringR).toBeLessThanOrEqual(s.cell.x + s.cell.width)
          expect(s.y - ringR).toBeGreaterThanOrEqual(s.cell.y)
          expect(s.y + ringR).toBeLessThanOrEqual(s.cell.y + s.cell.height)
        }
        for (let i = 0; i < slots.length; i++) {
          for (let j = i + 1; j < slots.length; j++) {
            const a = slots[i]
            const b = slots[j]
            expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(ringR * 2)
            const overlapX = Math.min(a.cell.x + a.cell.width, b.cell.x + b.cell.width) - Math.max(a.cell.x, b.cell.x)
            const overlapY = Math.min(a.cell.y + a.cell.height, b.cell.y + b.cell.height) - Math.max(a.cell.y, b.cell.y)
            expect(overlapX <= 1e-6 || overlapY <= 1e-6).toBe(true)
          }
        }
      }
    }
  })

  it('レベル5(60個)でも iPad の横向き・縦向きで絵が 56px 以上', () => {
    for (const field of FIELDS) {
      const { fontSize, slots } = layoutSlots(60, field, seededRng(1))
      expect(fontSize).toBeGreaterThanOrEqual(56)
      expect(Math.min(slots[0].cell.width, slots[0].cell.height)).toBeGreaterThanOrEqual(64)
    }
  })

  it('横長の画面では横に、縦長の画面では縦に多く並ぶ(画面いっぱいに使う)', () => {
    const wide = layoutSlots(60, LANDSCAPE_1024, seededRng(1)).slots
    const tall = layoutSlots(60, PORTRAIT_820, seededRng(1)).slots
    const span = (s: typeof wide, k: 'x' | 'y') => Math.max(...s.map((p) => p[k])) - Math.min(...s.map((p) => p[k]))
    expect(span(wide, 'x')).toBeGreaterThan(LANDSCAPE_1024.width * 0.8)
    expect(span(tall, 'y')).toBeGreaterThan(PORTRAIT_820.height * 0.8)
    const sides = wide.map((p) => sideOf(p.x, LANDSCAPE_1024))
    expect(sides.filter((s) => s === 'left').length).toBeGreaterThan(20)
    expect(sides.filter((s) => s === 'right').length).toBeGreaterThan(20)
  })
})
