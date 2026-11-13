import { defaultRng, randInt, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

/** 盤面の大きさと色の数 */
export interface BoardConfig {
  cols: number
  rows: number
  colors: number
}

export const LEVELS: Record<Difficulty, BoardConfig> = {
  1: { cols: 5, rows: 5, colors: 3 },
  2: { cols: 6, rows: 6, colors: 3 },
  3: { cols: 7, rows: 7, colors: 4 },
  4: { cols: 8, rows: 8, colors: 4 },
  5: { cols: 10, rows: 8, colors: 5 },
}

/** 練習は小さな盤面 */
export const PRACTICE: BoardConfig = { cols: 4, rows: 4, colors: 3 }

export function configFor(level: Difficulty, mode: PlayMode): BoardConfig {
  return mode === 'practice' ? PRACTICE : LEVELS[level]
}

/** ブロック1個。id は表示(落下アニメーション)用で、盤面の中で重複しない */
export interface Block {
  id: number
  color: number
}

/** grid[行][列]。行0がいちばん上。null は空き */
export type Grid = (Block | null)[][]

/** [行, 列] */
export type Pos = readonly [number, number]

const DIRS: Pos[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

export function gridSize(grid: Grid): { rows: number; cols: number } {
  return { rows: grid.length, cols: grid[0]?.length ?? 0 }
}

export function countBlocks(grid: Grid): number {
  return grid.reduce((n, row) => n + row.filter((b) => b !== null).length, 0)
}

/** (row, col) と上下左右でつながった同じ色のブロックをすべて返す。空きなら [] */
export function findGroup(grid: Grid, row: number, col: number): Pos[] {
  const { rows, cols } = gridSize(grid)
  const start = grid[row]?.[col]
  if (!start) return []
  const seen = new Set<number>()
  const out: Pos[] = []
  const stack: Pos[] = [[row, col]]
  while (stack.length) {
    const [r, c] = stack.pop()!
    const k = r * cols + c
    if (seen.has(k)) continue
    seen.add(k)
    out.push([r, c])
    for (const [dr, dc] of DIRS) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
      const b = grid[nr][nc]
      if (b && b.color === start.color && !seen.has(nr * cols + nc)) stack.push([nr, nc])
    }
  }
  return out
}

/** ブロックを下に落とし、空になった列を左に詰める */
export function collapse(grid: Grid): Grid {
  const { rows, cols } = gridSize(grid)
  const columns: (Block | null)[][] = []
  for (let c = 0; c < cols; c++) {
    const stacked: Block[] = []
    for (let r = rows - 1; r >= 0; r--) {
      const b = grid[r][c]
      if (b) stacked.push(b)
    }
    if (stacked.length === 0) continue
    // 下から積んだ列を、上から見た並びに直す
    const col: (Block | null)[] = Array.from({ length: rows }, (_, r) => stacked[rows - 1 - r] ?? null)
    columns.push(col)
  }
  while (columns.length < cols) columns.push(Array.from({ length: rows }, () => null))
  return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => columns[c][r]))
}

/** 指定したマスのブロックを消して、落下・左詰めした新しい盤面を返す */
export function removeCells(grid: Grid, cells: readonly Pos[]): Grid {
  const next = grid.map((row) => [...row])
  for (const [r, c] of cells) next[r][c] = null
  return collapse(next)
}

/** 2個以上つながった同じ色のブロックがあるか(まだ消せるか) */
export function hasMoves(grid: Grid): boolean {
  const { rows, cols } = gridSize(grid)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const b = grid[r][c]
      if (!b) continue
      const right = c + 1 < cols ? grid[r][c + 1] : null
      const below = r + 1 < rows ? grid[r + 1][c] : null
      if ((right && right.color === b.color) || (below && below.color === b.color)) return true
    }
  }
  return false
}

/** ランダムな盤面を作る。最初から消せる所が無い盤面は作り直す */
export function generateBoard(cfg: BoardConfig, rng: Rng = defaultRng): Grid {
  for (;;) {
    let id = 0
    const grid: Grid = Array.from({ length: cfg.rows }, () =>
      Array.from({ length: cfg.cols }, () => ({ id: id++, color: randInt(0, cfg.colors - 1, rng) })),
    )
    // 色の数が設定どおりで、消せる所がある盤面だけ使う
    const used = new Set(grid.flat().map((b) => b!.color))
    if (used.size === cfg.colors && hasMoves(grid)) return grid
  }
}

/** テスト用: 'ABC.' のような文字列から盤面を作る(A=色0, B=色1…、'.'=空き) */
export function gridFromRows(rows: readonly string[]): Grid {
  let id = 0
  return rows.map((line) => [...line].map((ch) => (ch === '.' ? null : { id: id++, color: ch.charCodeAt(0) - 65 })))
}

/** テスト用: 盤面を 'ABC.' 形式に戻す */
export function gridToRows(grid: Grid): string[] {
  return grid.map((row) => row.map((b) => (b ? String.fromCharCode(65 + b.color) : '.')).join(''))
}
