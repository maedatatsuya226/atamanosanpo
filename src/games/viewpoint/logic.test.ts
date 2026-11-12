import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import {
  buildTrial,
  buildTrials,
  choicesDistinguishable,
  coarseSignature,
  computeView,
  DIRECTIONS,
  GRID,
  isOpposite,
  LEVELS,
  occlusionOk,
  project,
  viewSignature,
  type Block,
  type Direction,
} from './logic'

/**
 * project() とは別の方法(ベクトル計算)で、見る人の左右と奥行きを求める。
 * 地図座標: 東 = +x(列が増える方向)、北 = +y(行が減る方向)。上 = +z。
 * 前向きベクトル f に対して、右手の向きは f × z = (fy, -fx)。
 */
const FORWARD: Record<Direction, [number, number]> = {
  front: [0, 1], // 手前(南)に立って北を向く
  back: [0, -1], // 奥(北)に立って南を向く
  left: [1, 0], // 左(西)に立って東を向く
  right: [-1, 0], // 右(東)に立って西を向く
}
function geometric(row: number, col: number, dir: Direction) {
  const [fx, fy] = FORWARD[dir]
  const [rx, ry] = [fy, -fx]
  const x = col
  const y = -row
  return { side: x * rx + y * ry, ahead: x * fx + y * fy }
}

const cells = Array.from({ length: GRID * GRID }, (_, i) => [Math.floor(i / GRID), i % GRID] as const)

describe('project(左右と奥行き)', () => {
  it('ベクトル計算と左右・奥行きの順序が一致する(鏡像になっていない)', () => {
    for (const dir of DIRECTIONS) {
      for (const [r1, c1] of cells) {
        for (const [r2, c2] of cells) {
          const p1 = project({ row: r1, col: c1 }, dir)
          const p2 = project({ row: r2, col: c2 }, dir)
          const g1 = geometric(r1, c1, dir)
          const g2 = geometric(r2, c2, dir)
          // 左にあるほど slot が小さい
          expect(Math.sign(p1.slot - p2.slot)).toBe(Math.sign(g1.side - g2.side))
          // 手前(前を向いて近い)ほど depth が小さい
          expect(Math.sign(p1.depth - p2.depth)).toBe(Math.sign(g1.ahead - g2.ahead))
        }
      }
    }
  })

  it('具体例: 手前の左に赤、手前の右に青', () => {
    // 行2 = 手前(まえ側)
    const red = { row: 2, col: 0 }
    const blue = { row: 2, col: 2 }
    // まえ から: 赤が左、青が右
    expect(project(red, 'front').slot).toBeLessThan(project(blue, 'front').slot)
    // うしろ から: 左右が入れ替わる
    expect(project(red, 'back').slot).toBeGreaterThan(project(blue, 'back').slot)
    // ひだり から(東を向く): 手前(南)は右手側。赤が手前、青がその奥に重なる
    expect(project(red, 'left')).toEqual({ slot: 2, depth: 0 })
    expect(project(blue, 'left')).toEqual({ slot: 2, depth: 2 })
    // みぎ から(西を向く): 手前(南)は左手側。青が手前、赤が奥
    expect(project(blue, 'right')).toEqual({ slot: 0, depth: 0 })
    expect(project(red, 'right')).toEqual({ slot: 0, depth: 2 })
  })

  it('反対側の向きは左右がちょうど逆になる', () => {
    for (const [r, c] of cells) {
      expect(project({ row: r, col: c }, 'front').slot + project({ row: r, col: c }, 'back').slot).toBe(GRID - 1)
      expect(project({ row: r, col: c }, 'left').slot + project({ row: r, col: c }, 'right').slot).toBe(GRID - 1)
    }
    expect(isOpposite('front', 'back')).toBe(true)
    expect(isOpposite('left', 'right')).toBe(true)
    expect(isOpposite('front', 'right')).toBe(false)
  })
})

describe('computeView(重なり)', () => {
  const blocks: Block[] = [
    { row: 0, col: 1, height: 2, color: 0 }, // 奥・中央・2段
    { row: 2, col: 1, height: 1, color: 1 }, // 手前・中央・1段
    { row: 1, col: 1, height: 1, color: 2 }, // 真ん中・1段(手前に完全に隠れる)
  ]

  it('手前の積み木が奥を隠し、高い奥の積み木は上だけ見える', () => {
    const v = computeView(blocks, 'front')
    const byColor = (c: number) => v.blocks.find((b) => b.color === c)!
    expect(byColor(1).visible).toEqual({ from: 0, to: 1 })
    expect(byColor(2).visible).toBeNull()
    expect(byColor(0).visible).toEqual({ from: 1, to: 2 })
    expect(byColor(1).rank).toBe(0)
    expect(byColor(0).rank).toBe(2)
    // 描く順は奥から手前
    expect(v.blocks.map((b) => b.color)).toEqual([0, 2, 1])
  })

  it('横から見ると3個とも並んで見える', () => {
    const v = computeView(blocks, 'left')
    expect(v.blocks.every((b) => b.visible && b.rank === 0)).toBe(true)
    // ひだりから: 奥(行0)が左
    expect(viewSignature(v)).toBe('0:0-2/2:0-1/1:0-1')
    // みぎから: 手前(行2)が左
    expect(viewSignature(computeView(blocks, 'right'))).toBe('1:0-1/2:0-1/0:0-2')
  })

  it('重なりのルール', () => {
    expect(occlusionOk(computeView(blocks, 'front'), 'none')).toBe(false)
    expect(occlusionOk(computeView(blocks, 'front'), 'partial')).toBe(false)
    expect(occlusionOk(computeView(blocks, 'front'), 'any')).toBe(true)
    expect(occlusionOk(computeView(blocks, 'left'), 'none')).toBe(true)
  })

  it('粗い署名はすきまの位置を無視する', () => {
    const a = computeView([{ row: 0, col: 0, height: 1, color: 0 }], 'front')
    const b = computeView([{ row: 0, col: 2, height: 1, color: 0 }], 'front')
    expect(viewSignature(a)).not.toBe(viewSignature(b))
    expect(coarseSignature(a)).toBe(coarseSignature(b))
  })

  it('対角に置いた2個は、みぎ と うしろ で同じ絵になる(→同時には出さない)', () => {
    const diag: Block[] = [
      { row: 0, col: 0, height: 1, color: 0 },
      { row: 2, col: 2, height: 1, color: 1 },
    ]
    expect(viewSignature(computeView(diag, 'right'))).toBe(viewSignature(computeView(diag, 'back')))
    expect(choicesDistinguishable(diag, ['right', 'back'])).toBe(false)
    expect(choicesDistinguishable(diag, ['front', 'right'])).toBe(true)
  })
})

describe('buildTrial', () => {
  it('全レベル・多数の seed で、条件どおりで、選択肢の絵がすべて見分けられる', () => {
    for (const lv of DIFFICULTIES) {
      const cfg = LEVELS[lv]
      for (let seed = 0; seed < 400; seed++) {
        const t = buildTrial(lv, seededRng(seed * 31 + lv))
        // 積み木の数・位置・色・高さ
        expect(t.blocks).toHaveLength(cfg.blocks)
        expect(new Set(t.blocks.map((b) => b.row * GRID + b.col)).size).toBe(cfg.blocks)
        expect(new Set(t.blocks.map((b) => b.color)).size).toBe(cfg.blocks)
        for (const b of t.blocks) {
          expect(b.height).toBeGreaterThanOrEqual(1)
          expect(b.height).toBeLessThanOrEqual(cfg.maxHeight)
        }
        // 選択肢
        expect(t.choices).toHaveLength(cfg.choices)
        expect(t.choices).toContain(t.answer)
        expect(new Set(t.choices).size).toBe(cfg.choices)
        // 見せる絵は正解の方向から見たもの
        expect(viewSignature(t.view)).toBe(viewSignature(computeView(t.blocks, t.answer)))
        expect(occlusionOk(t.view, cfg.occlusion)).toBe(true)
        // どの2方向を比べても、正確な署名・粗い署名とも違う
        const exact = t.choices.map((d) => viewSignature(computeView(t.blocks, d)))
        const coarse = t.choices.map((d) => coarseSignature(computeView(t.blocks, d)))
        expect(new Set(exact).size).toBe(cfg.choices)
        expect(new Set(coarse).size).toBe(cfg.choices)
        // 正解以外の方向の絵は、見せている絵と必ず違う
        for (const d of t.choices) {
          if (d !== t.answer) expect(viewSignature(computeView(t.blocks, d))).not.toBe(viewSignature(t.view))
        }
      }
    }
  })

  it('重なりなしのレベルでは、正解の絵で積み木が前後に重ならない', () => {
    for (const lv of [1, 2, 3] as const) {
      for (let seed = 0; seed < 200; seed++) {
        const t = buildTrial(lv, seededRng(seed))
        const slots = t.view.blocks.map((b) => b.slot)
        expect(new Set(slots).size).toBe(slots.length)
      }
    }
  })

  it('レベル4は全部少しは見え、レベル5は高さ1〜3段で高さがそろわない', () => {
    for (let seed = 0; seed < 200; seed++) {
      const t4 = buildTrial(4, seededRng(seed))
      expect(t4.view.blocks.every((b) => b.visible)).toBe(true)
      const t5 = buildTrial(5, seededRng(seed))
      expect(new Set(t5.blocks.map((b) => b.height)).size).toBeGreaterThan(1)
    }
  })

  it('正解の方向と選択肢の組み合わせは偏らない', () => {
    const answers = new Map<string, number>()
    const pairs = new Set<string>()
    for (let seed = 0; seed < 400; seed++) {
      const t = buildTrial(1, seededRng(seed))
      answers.set(t.answer, (answers.get(t.answer) ?? 0) + 1)
      pairs.add(t.choices.join(','))
    }
    for (const d of DIRECTIONS) expect(answers.get(d) ?? 0).toBeGreaterThan(50)
    // 2択の組み合わせ(4方向から2つ)は6通りすべて出る
    expect(pairs.size).toBe(6)
  })

  it('同じ seed なら同じ問題、本番6問・練習2問', () => {
    const a = buildTrials(5, 'main', seededRng(7))
    const b = buildTrials(5, 'main', seededRng(7))
    expect(a).toEqual(b)
    expect(a).toHaveLength(6)
    expect(buildTrials(1, 'practice', seededRng(1))).toHaveLength(2)
  })
})
