import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import {
  BASE,
  bit,
  buildPuzzle,
  drive,
  LEVELS,
  minTurns,
  rotateMask,
  rotateTile,
  tileMask,
  turnsToFit,
  type Puzzle,
} from './logic'

/** 正解の道のタイルを、必要な回数だけまわす */
function solve(p: Puzzle): { puzzle: Puzzle; taps: number } {
  let puzzle = p
  let taps = 0
  p.route.forEach((cell, i) => {
    const k = turnsToFit(puzzle.tiles[cell]!, p.need[i])!
    for (let j = 0; j < k; j++) {
      puzzle = rotateTile(puzzle, cell)
      taps++
    }
  })
  return { puzzle, taps }
}

describe('タイルの回転', () => {
  it('時計回りに90度ずつまわり、4回で元に戻る', () => {
    expect(rotateMask(bit(0), 1)).toBe(bit(1))
    expect(rotateMask(bit(3), 1)).toBe(bit(0))
    expect(rotateMask(BASE.curve, 1)).toBe(bit(1) | bit(2))
    for (const m of Object.values(BASE)) expect(rotateMask(m, 4)).toBe(m)
  })

  it('まっすぐの道は半回転で同じ形になる', () => {
    expect(rotateMask(BASE.straight, 2)).toBe(BASE.straight)
    expect(rotateMask(BASE.curve, 2)).not.toBe(BASE.curve)
  })
})

describe('buildPuzzle', () => {
  it('全レベルで、最初はつながっておらず、まわせば必ずつながる', () => {
    for (const lv of DIFFICULTIES) {
      const cfg = LEVELS[lv]
      for (let seed = 0; seed < 80; seed++) {
        const p = buildPuzzle(lv, seededRng(seed * 17 + lv))
        expect(p.tiles).toHaveLength(cfg.cols * cfg.rows)
        expect(p.route.length).toBeGreaterThanOrEqual(cfg.minPath)
        expect(p.start % p.cols).toBe(0)
        expect(p.goal % p.cols).toBe(p.cols - 1)
        expect(p.route[0]).toBe(p.start)
        expect(p.route[p.route.length - 1]).toBe(p.goal)
        // 最初はつながっていない
        expect(drive(p).solved).toBe(false)
        // ずれている道のタイルが決めた数以上ある
        const wrong = p.route.filter((cell, i) => turnsToFit(p.tiles[cell]!, p.need[i]) !== 0).length
        expect(wrong).toBeGreaterThanOrEqual(Math.min(cfg.minWrong, p.route.length))
        // 道のタイルはすべて、まわせば必要な向きにできる
        p.route.forEach((cell, i) => expect(turnsToFit(p.tiles[cell]!, p.need[i])).not.toBeNull())
        // 必要な回転数どおりにまわすとゴールまでつながる
        const { puzzle, taps } = solve(p)
        expect(taps).toBe(minTurns(p))
        const r = drive(puzzle)
        expect(r.solved).toBe(true)
        expect(r.cells[0]).toBe(p.start)
        expect(r.cells[r.cells.length - 1]).toBe(p.goal)
      }
    }
  })

  it('レベル1は道以外のマスが空き地、レベル3以上はすべてのマスにタイルがある', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p1 = buildPuzzle(1, seededRng(seed))
      const onRoute = new Set(p1.route)
      p1.tiles.forEach((t, cell) => expect(t !== null).toBe(onRoute.has(cell)))
      const p3 = buildPuzzle(3, seededRng(seed))
      expect(p3.tiles.every((t) => t !== null)).toBe(true)
    }
  })

  it('毎回ちがう盤面になる', () => {
    expect(buildPuzzle(3, seededRng(1)).tiles).not.toEqual(buildPuzzle(3, seededRng(2)).tiles)
  })
})

describe('drive', () => {
  it('つながった道をたどり、途切れた所で止まる', () => {
    const p = buildPuzzle(3, seededRng(4))
    const { puzzle } = solve(p)
    // ゴールの手前のタイルだけ向きをずらす
    const cut = p.route[p.route.length - 2]
    let broken = rotateTile(puzzle, cut)
    if (turnsToFit(broken.tiles[cut]!, p.need[p.route.length - 2]) === 0) broken = rotateTile(broken, cut)
    const r = drive(broken)
    expect(r.solved).toBe(false)
    expect(r.cells[0]).toBe(p.start)
    expect(r.cells).not.toContain(p.goal)
    // 通るマスは隣どうしがつながっている
    for (let i = 1; i < r.cells.length; i++) {
      const a = r.cells[i - 1]
      const b = r.cells[i]
      expect(tileMask(broken.tiles[a]) && tileMask(broken.tiles[b])).toBeTruthy()
    }
  })

  it('スタートのタイルが左を向いていなければ、車は入れない', () => {
    const p = buildPuzzle(2, seededRng(8))
    let q = p
    for (let k = 0; k < 4 && tileMask(q.tiles[q.start]) & bit(3); k++) q = rotateTile(q, q.start)
    expect(drive(q)).toEqual({ solved: false, cells: [] })
  })
})
