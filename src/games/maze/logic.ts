import { dirOf, distances, pathTo, spanningTree, stepToward } from '../../core/grid'
import { defaultRng, randInt, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

/**
 * 迷路
 * 左のスタートから右のゴールまで、指でなぞって進む。
 * 壁に当たっても終わりにしない(線がそこで止まるだけ。当たった回数は記録する)。
 * なぞった線の上を戻れば、そこまで線が消えて、別の道を試せる。
 */
export interface LevelConfig {
  cols: number
  rows: number
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { cols: 5, rows: 4 },
  2: { cols: 7, rows: 5 },
  3: { cols: 9, rows: 6 },
  4: { cols: 11, rows: 7 },
  5: { cols: 13, rows: 8 },
}

export const MAZES: Record<PlayMode, number> = { main: 3, practice: 1 }

export interface Maze {
  cols: number
  rows: number
  /** マスごとの、壁のない(通れる)となりのマス */
  adj: number[][]
  /** スタート(左端の列)。左の外から入る */
  start: number
  /** ゴール(右端の列)。右の外へ出る */
  goal: number
  /** スタートからゴールまでの正しい道順 */
  solution: number[]
}

export function buildMaze(level: Difficulty, rng: Rng = defaultRng): Maze {
  const { cols, rows } = LEVELS[level]
  // 長い通路の多い、迷路らしい形にする
  const adj = spanningTree(cols, rows, rng, 0.8)
  const start = randInt(0, rows - 1, rng) * cols
  // ゴールは右端の列のうち、スタートからいちばん遠いマス
  const { dist, parent } = distances(adj, start)
  let goal = cols - 1
  for (let r = 0; r < rows; r++) {
    const cell = r * cols + cols - 1
    if (dist[cell] > dist[goal]) goal = cell
  }
  return { cols, rows, adj, start, goal, solution: pathTo(parent, goal) }
}

export function isOpen(m: Maze, a: number, b: number): boolean {
  return m.adj[a].includes(b)
}

export interface Trace {
  /** なぞった道(スタートから今いるマスまで) */
  path: number[]
  /** 壁に当たった回数 */
  bumps: number
  /** なぞった線を戻った回数 */
  backs: number
  /** 正しい道から外れて、わき道に入った回数 */
  strays: number
}

export function startTrace(m: Maze): Trace {
  return { path: [m.start], bumps: 0, backs: 0, strays: 0 }
}

export type TraceEvent = 'none' | 'extend' | 'back' | 'wall'

/**
 * 指が cell のマスに来たときの、なぞった道の変化。
 * - なぞった線の上 → そこまで戻る
 * - 今いるマスと同じ行・列で、壁なしで行ける → そこまで進む(速くなぞってマスを飛ばしても進めるように)
 * - 途中に壁がある → 壁の手前まで進み、壁に当たったと数える
 */
export function traceTo(m: Maze, trace: Trace, cell: number): { trace: Trace; event: TraceEvent } {
  const { path } = trace
  const head = path[path.length - 1]
  if (cell === head) return { trace, event: 'none' }

  const at = path.indexOf(cell)
  if (at >= 0) {
    return { trace: { ...trace, path: path.slice(0, at + 1), backs: trace.backs + 1 }, event: 'back' }
  }

  const { cols, rows } = m
  const sameRow = Math.floor(cell / cols) === Math.floor(head / cols)
  const sameCol = cell % cols === head % cols
  if (!sameRow && !sameCol) return { trace, event: 'none' }

  const dir = dirOf(head, sameRow ? head + Math.sign(cell - head) : head + Math.sign(cell - head) * cols, cols)
  let next = [...path]
  const onSolution = new Set(m.solution)
  let strays = trace.strays
  let backs = trace.backs
  let backed = false
  let cur = head
  while (cur !== cell) {
    const step = stepToward(cur, dir, cols, rows)
    if (step === null) break
    if (!isOpen(m, cur, step)) {
      const changed = backed || next.length !== path.length
      return {
        trace: { ...trace, path: next, strays, backs, bumps: trace.bumps + 1 },
        event: changed ? 'extend' : 'wall',
      }
    }
    const at = next.indexOf(step)
    if (at >= 0) {
      // なぞった線を戻る向き(指を速く動かしてマスを飛ばしたとき)。そこまで線を消して続ける
      next = next.slice(0, at + 1)
      if (!backed) backs++
      backed = true
    } else {
      if (onSolution.has(cur) && !onSolution.has(step)) strays++
      next.push(step)
    }
    cur = step
  }
  if (!backed && next.length === path.length) return { trace, event: 'none' }
  return { trace: { ...trace, path: next, strays, backs }, event: backed && next.length <= path.length ? 'back' : 'extend' }
}

export function reachedGoal(m: Maze, trace: Trace): boolean {
  return trace.path[trace.path.length - 1] === m.goal
}

export type MazeHint =
  /** 正しい道の上にいる: この先のマス(数マス) */
  | { kind: 'next'; cells: number[] }
  /** 正しい道から外れている: ここまで戻るとよい */
  | { kind: 'back'; cell: number }

/** ヒント: 正しい道の上ならこの先を少しだけ、外れていれば外れた所を示す */
export function mazeHint(m: Maze, trace: Trace, ahead = 3): MazeHint {
  const p = trace.path
  let k = 0
  while (k < p.length && p[k] === m.solution[k]) k++
  if (k === p.length) return { kind: 'next', cells: m.solution.slice(k, k + ahead) }
  return { kind: 'back', cell: p[k - 1] }
}
