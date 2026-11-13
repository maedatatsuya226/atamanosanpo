import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import { buildMaze, isOpen, LEVELS, reachedGoal, startTrace, traceTo, type Maze, type Trace } from './logic'

function isGridNeighbor(a: number, b: number, cols: number): boolean {
  const ra = Math.floor(a / cols)
  const rb = Math.floor(b / cols)
  return (ra === rb && Math.abs(a - b) === 1) || (a % cols === b % cols && Math.abs(ra - rb) === 1)
}

/** 2つのマスのあいだが壁になっている、となりのマスをさがす */
function wallNeighbor(m: Maze, cell: number): number | null {
  const { cols, rows } = m
  const r = Math.floor(cell / cols)
  const c = cell % cols
  const cands = [r > 0 ? cell - cols : -1, c < cols - 1 ? cell + 1 : -1, r < rows - 1 ? cell + cols : -1, c > 0 ? cell - 1 : -1]
  return cands.find((x) => x >= 0 && !isOpen(m, cell, x)) ?? null
}

describe('buildMaze', () => {
  it('全レベルで、すべてのマスがつながったループのない迷路ができる', () => {
    for (const lv of DIFFICULTIES) {
      const { cols, rows } = LEVELS[lv]
      for (let seed = 0; seed < 50; seed++) {
        const m = buildMaze(lv, seededRng(seed * 7 + lv))
        const edges = m.adj.reduce((n, nbs) => n + nbs.length, 0) / 2
        expect(edges).toBe(cols * rows - 1)
        for (let a = 0; a < m.adj.length; a++) for (const b of m.adj[a]) expect(isGridNeighbor(a, b, cols)).toBe(true)
        expect(m.start % cols).toBe(0)
        expect(m.goal % cols).toBe(cols - 1)
        expect(m.solution[0]).toBe(m.start)
        expect(m.solution[m.solution.length - 1]).toBe(m.goal)
        for (let i = 1; i < m.solution.length; i++) expect(isOpen(m, m.solution[i - 1], m.solution[i])).toBe(true)
        // 迷路らしく、まっすぐ行くより遠回りになる
        expect(m.solution.length).toBeGreaterThanOrEqual(cols)
      }
    }
  })

  it('毎回ちがう迷路になる', () => {
    expect(buildMaze(3, seededRng(1)).adj).not.toEqual(buildMaze(3, seededRng(2)).adj)
  })
})

describe('traceTo', () => {
  it('正しい道を1マスずつなぞるとゴールに着き、まちがいは0', () => {
    for (let seed = 0; seed < 30; seed++) {
      const m = buildMaze(4, seededRng(seed))
      let t: Trace = startTrace(m)
      for (const cell of m.solution.slice(1)) {
        const r = traceTo(m, t, cell)
        expect(r.event).toBe('extend')
        t = r.trace
      }
      expect(reachedGoal(m, t)).toBe(true)
      expect(t).toMatchObject({ bumps: 0, backs: 0, strays: 0 })
      expect(t.path).toEqual(m.solution)
    }
  })

  it('壁の向こうへは進めず、当たった回数を数える', () => {
    for (let seed = 0; seed < 30; seed++) {
      const m = buildMaze(3, seededRng(seed))
      const t = startTrace(m)
      const blocked = wallNeighbor(m, m.start)
      if (blocked === null) continue
      const r = traceTo(m, t, blocked)
      expect(r.event).toBe('wall')
      expect(r.trace.path).toEqual([m.start])
      expect(r.trace.bumps).toBe(1)
    }
  })

  it('となりでないマスには飛べないが、同じ通路をまっすぐなら一気に進める', () => {
    const m = buildMaze(5, seededRng(3))
    const t = startTrace(m)
    // 斜めのマスへは進まない
    const diag = m.start + m.cols + 1
    if (diag < m.cols * m.rows) expect(traceTo(m, t, diag).event).toBe('none')
    // 正しい道のうち、最初のまっすぐな区間の端まで一気に進める
    const sol = m.solution
    let end = 1
    while (end + 1 < sol.length && sol[end + 1] - sol[end] === sol[1] - sol[0]) end++
    const r = traceTo(m, t, sol[end])
    expect(r.event).toBe('extend')
    expect(r.trace.path).toEqual(sol.slice(0, end + 1))
  })

  it('なぞった線の上に戻ると、そこまで線が消える', () => {
    const m = buildMaze(3, seededRng(11))
    let t = startTrace(m)
    for (const cell of m.solution.slice(1, 5)) t = traceTo(m, t, cell).trace
    const r = traceTo(m, t, m.solution[1])
    expect(r.event).toBe('back')
    expect(r.trace.path).toEqual(m.solution.slice(0, 2))
    expect(r.trace.backs).toBe(1)
  })

  it('指を速く動かして線の上を飛び越えても、戻ってから先へ進める', () => {
    let checked = 0
    for (let seed = 0; seed < 60; seed++) {
      const m = buildMaze(4, seededRng(seed))
      const { cols } = m
      // スタートから上下どちらかへ2マス以上まっすぐ通れる迷路をさがす
      const up = m.start - cols
      const down = m.start + cols
      const a = isOpen(m, m.start, down) && down + cols < cols * m.rows && isOpen(m, down, down + cols)
      const b = up >= 0 && isOpen(m, m.start, up)
      if (!a || !b) continue
      // スタート → 下へ2マス なぞったあと、一気に上のマスへ指を動かす
      let t = startTrace(m)
      t = traceTo(m, t, down + cols).trace
      expect(t.path).toEqual([m.start, down, down + cols])
      const r = traceTo(m, t, up)
      expect(r.trace.path).toEqual([m.start, up])
      expect(r.trace.backs).toBe(1)
      checked++
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('正しい道から外れてわき道に入ると数える', () => {
    let checked = 0
    for (let seed = 0; seed < 40; seed++) {
      const m = buildMaze(3, seededRng(seed))
      const onSol = new Set(m.solution)
      // わき道への入口がある、正しい道の上のマスをさがす
      const i = m.solution.findIndex((cell) => m.adj[cell].some((x) => !onSol.has(x)))
      if (i < 0) continue
      let t = startTrace(m)
      for (const cell of m.solution.slice(1, i + 1)) t = traceTo(m, t, cell).trace
      const side = m.adj[m.solution[i]].find((x) => !onSol.has(x))!
      const r = traceTo(m, t, side)
      expect(r.event).toBe('extend')
      expect(r.trace.strays).toBe(1)
      checked++
    }
    expect(checked).toBeGreaterThan(10)
  })
})
