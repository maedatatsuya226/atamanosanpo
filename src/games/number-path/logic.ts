import { defaultRng, randInt, shuffle, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

/**
 * 数字たどり
 * マス目に数字が書いてあり、スタート(1)から 2, 3, … と「となりのマス」をたどってゴールへ進む。
 * 分岐(おとり)では、次の数字がとなりに2つあり、片方は行き止まりになる。先を見て選ぶ必要がある。
 */
export interface LevelConfig {
  size: number
  /** スタートからゴールまでのマスの数(= ゴールの数字) */
  length: number
  /** おとりの分岐の数 */
  decoys: number
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { size: 4, length: 8, decoys: 0 },
  2: { size: 5, length: 12, decoys: 1 },
  3: { size: 5, length: 14, decoys: 3 },
  4: { size: 6, length: 18, decoys: 4 },
  5: { size: 7, length: 24, decoys: 6 },
}

export const BOARDS: Record<PlayMode, number> = { main: 3, practice: 1 }

export interface Board {
  size: number
  /** 行ごとに並べたマスの数字 */
  values: number[]
  /** 正しい道順(マス番号の列)。values[path[i]] === i + 1 */
  path: number[]
  /** おとりのマス */
  decoyCells: number[]
}

export function neighbors(cell: number, size: number): number[] {
  const r = Math.floor(cell / size)
  const c = cell % size
  const out: number[] = []
  if (r > 0) out.push(cell - size)
  if (r < size - 1) out.push(cell + size)
  if (c > 0) out.push(cell - 1)
  if (c < size - 1) out.push(cell + 1)
  return out
}

export function isAdjacent(a: number, b: number, size: number): boolean {
  return neighbors(a, size).includes(b)
}

/** そのマスから進めるマス(となりで、数字がひとつ大きい) */
export function nextMoves(values: readonly number[], size: number, cell: number): number[] {
  return neighbors(cell, size).filter((n) => values[n] === values[cell] + 1)
}

/** 自分自身と交差しない道をランダムに作る(行き詰まったら戻ってやり直す) */
export function randomPath(size: number, length: number, rng: Rng = defaultRng): number[] | null {
  const total = size * size
  const start = randInt(0, total - 1, rng)
  const path = [start]
  const used = new Set(path)
  const options: number[][] = [shuffle(neighbors(start, size), rng)]
  let guard = 0
  while (path.length < length && guard++ < 20000) {
    const opts = options[options.length - 1]
    const next = opts.pop()
    if (next === undefined) {
      if (path.length === 1) return null
      used.delete(path.pop()!)
      options.pop()
      continue
    }
    if (used.has(next)) continue
    path.push(next)
    used.add(next)
    options.push(shuffle(neighbors(next, size), rng))
  }
  return path.length === length ? path : null
}

/** スタートから「となりの次の数字」をたどって行けるマスの集合 */
export function reachableFrom(values: readonly number[], size: number, start: number): Set<number> {
  const seen = new Set([start])
  const stack = [start]
  while (stack.length) {
    const c = stack.pop()!
    for (const n of nextMoves(values, size, c)) {
      if (!seen.has(n)) {
        seen.add(n)
        stack.push(n)
      }
    }
  }
  return seen
}

/** ゴールにたどり着けるマスの集合(逆向きにたどる) */
export function canReachGoal(values: readonly number[], size: number, goal: number): Set<number> {
  const seen = new Set([goal])
  const stack = [goal]
  while (stack.length) {
    const c = stack.pop()!
    for (const n of neighbors(c, size)) {
      if (values[n] === values[c] - 1 && !seen.has(n)) {
        seen.add(n)
        stack.push(n)
      }
    }
  }
  return seen
}

/**
 * 盤面が正しくできているか。
 * - スタートからゴールへ行ける道は path ただ1本
 * - おとりはスタートから行けるが、ゴールには行けない(行き止まり)
 * - それ以外のマス(うめ草)はスタートから行けない
 */
export function validateBoard(b: Board): boolean {
  const start = b.path[0]
  const goal = b.path[b.path.length - 1]
  const fwd = reachableFrom(b.values, b.size, start)
  const back = canReachGoal(b.values, b.size, goal)
  const onRoute = [...fwd].filter((c) => back.has(c))
  const pathSet = new Set(b.path)
  if (onRoute.length !== pathSet.size || !onRoute.every((c) => pathSet.has(c))) return false
  // 道順は1本だけ: 道の上の各マスから、道の次のマス以外でゴールへ行けるマスに進めない
  for (let i = 0; i < b.path.length - 1; i++) {
    const moves = nextMoves(b.values, b.size, b.path[i]).filter((m) => back.has(m))
    if (moves.length !== 1 || moves[0] !== b.path[i + 1]) return false
  }
  const decoySet = new Set(b.decoyCells)
  for (const c of b.decoyCells) if (!fwd.has(c) || back.has(c)) return false
  for (let c = 0; c < b.values.length; c++) {
    if (!pathSet.has(c) && !decoySet.has(c) && fwd.has(c)) return false
  }
  // 1 とゴールの数字はそれぞれ1マスだけ
  if (b.values.filter((v) => v === 1).length !== 1) return false
  if (b.values.filter((v) => v === b.path.length).length !== 1) return false
  return true
}

function tryBuild(cfg: LevelConfig, rng: Rng): Board | null {
  const { size, length } = cfg
  const path = randomPath(size, length, rng)
  if (!path) return null
  const values = new Array<number>(size * size).fill(0)
  path.forEach((cell, i) => (values[cell] = i + 1))

  // おとり: 道の途中のマスのとなりに「次の数字」を置き、1〜2マス続けて行き止まりにする
  const decoyCells: number[] = []
  const branchPoints = shuffle(
    Array.from({ length: length - 3 }, (_, i) => i + 1), // 道の2番目〜(ゴールの3つ手前)
    rng,
  )
  for (const idx of branchPoints) {
    if (decoyCells.length >= cfg.decoys) break
    let cell = path[idx]
    let v = idx + 1
    const chainLen = randInt(1, 2, rng)
    const chain: number[] = []
    for (let k = 0; k < chainLen && v + 1 < length; k++) {
      const free = neighbors(cell, size).filter((n) => values[n] === 0)
      if (free.length === 0) break
      const n = free[randInt(0, free.length - 1, rng)]
      v += 1
      values[n] = v
      chain.push(n)
      cell = n
    }
    if (chain.length > 0) decoyCells.push(...chain)
  }
  // 1つの分岐で2マス使うことがあるので、分岐の「数」で数える
  const branchCount = decoyBranchCount(values, size, path, decoyCells)
  if (branchCount < cfg.decoys) return null

  // うめ草: 2〜(ゴール-1) の数字。スタートから行けてしまうマスは数字を変える
  const fillers = values.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0)
  for (const f of fillers) values[f] = randInt(2, Math.max(2, length - 1), rng)
  for (let round = 0; round < 60; round++) {
    const fwd = reachableFrom(values, size, path[0])
    const bad = fillers.filter((f) => fwd.has(f))
    if (bad.length === 0) break
    for (const f of bad) values[f] = randInt(2, Math.max(2, length - 1), rng)
  }

  const board: Board = { size, values, path, decoyCells }
  return validateBoard(board) ? board : null
}

/** 道の上で、次に進めるマスが2つ以上ある場所の数 */
export function decoyBranchCount(values: readonly number[], size: number, path: readonly number[], decoys: readonly number[]): number {
  const decoySet = new Set(decoys)
  return path.filter((c) => nextMoves(values, size, c).some((m) => decoySet.has(m))).length
}

export function buildBoard(level: Difficulty, rng: Rng = defaultRng): Board {
  const cfg = LEVELS[level]
  for (let attempt = 0; attempt < 2000; attempt++) {
    const b = tryBuild(cfg, rng)
    if (b) return b
  }
  throw new Error('数字たどりの盤面を作れませんでした')
}

export type PathHint =
  /** 正しい道の上にいる: 次に進むマス */
  | { kind: 'next'; cell: number }
  /** おとり(行き止まり)に入っている: ここまで戻るとよい */
  | { kind: 'back'; cell: number }

/** ヒント: 正しい道の上なら次のマス、おとりに入っていれば戻る所 */
export function pathHint(board: Board, trail: readonly number[]): PathHint {
  let k = 0
  while (k < trail.length && trail[k] === board.path[k]) k++
  if (k === trail.length) return { kind: 'next', cell: board.path[k] }
  return { kind: 'back', cell: trail[k - 1] }
}
