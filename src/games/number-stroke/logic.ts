import { defaultRng, randInt, shuffle, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

/**
 * 数字一筆書き
 * n×n のマスに 1〜k の数字がいくつか書いてある。1 から始めて、すべてのマスを1回ずつ
 * たて・よこに進んで通り、数字は小さい順に通って、k で終わる。
 * 答えは1通りとは限らないので、判定は「ルールを満たしているか」で行う(作った道との一致は見ない)。
 */
export interface LevelConfig {
  size: number
  /** 盤面に書く数字の数(1 と k を含む) */
  numbers: number
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { size: 3, numbers: 3 },
  2: { size: 4, numbers: 3 },
  3: { size: 4, numbers: 4 },
  4: { size: 5, numbers: 4 },
  5: { size: 5, numbers: 5 },
}

export const PRACTICE_LEVEL: LevelConfig = { size: 3, numbers: 3 }

export const BOARDS: Record<PlayMode, number> = { main: 3, practice: 1 }

export interface Board {
  size: number
  /** マスごとの数字(0 = 数字なし) */
  numbers: number[]
  /** 一番大きい数字(= ゴール) */
  last: number
  /** 盤面を作るときに使った道(答えの一例) */
  solution: number[]
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

/**
 * すべてのマスを1回ずつ通る道(ハミルトン路)をランダムに作る。
 * 深さ優先探索 + 戻り(バックトラック)。次のマスは「その先の行き先が少ないマス」を優先する(Warnsdorff則)。
 * 奇数×奇数の盤では、道の両端は市松模様の多い方の色(行+列が偶数)でなければならない。
 * 一定回数で見つからなければ別のスタートからやり直す。
 */
export function hamiltonianPath(size: number, rng: Rng = defaultRng): number[] {
  const total = size * size
  const starts = Array.from({ length: total }, (_, i) => i).filter(
    (c) => size % 2 === 0 || (Math.floor(c / size) + (c % size)) % 2 === 0,
  )
  for (let attempt = 0; attempt < 200; attempt++) {
    const start = starts[randInt(0, starts.length - 1, rng)]
    const path = searchFrom(start, size, rng, 4000)
    if (path) return path
  }
  throw new Error('一筆書きの道を作れませんでした')
}

function searchFrom(start: number, size: number, rng: Rng, budget: number): number[] | null {
  const total = size * size
  const used = new Array<boolean>(total).fill(false)
  const path = [start]
  used[start] = true
  const freeDegree = (c: number) => neighbors(c, size).filter((n) => !used[n]).length
  // 行き先の候補(末尾から試す)。Warnsdorff: 行き先の少ないマスを先に。同点は少しランダムに崩して形を変える
  const order = (c: number) =>
    shuffle(
      neighbors(c, size).filter((n) => !used[n]),
      rng,
    )
      .map((n) => ({ n, key: freeDegree(n) + rng() * 0.8 }))
      .sort((a, b) => b.key - a.key)
      .map((o) => o.n)
  const options: number[][] = [order(start)]
  let steps = 0
  while (path.length < total) {
    if (steps++ > budget) return null
    const opts = options[options.length - 1]
    const next = opts.pop()
    if (next === undefined) {
      if (path.length === 1) return null
      used[path.pop()!] = false
      options.pop()
      continue
    }
    if (used[next]) continue
    used[next] = true
    path.push(next)
    // 行き止まりになるマス(空きのとなりが0個の空きマス)が2つ以上できたら、この先は無理なので戻す
    if (path.length < total && deadCells(used, size, next) > 1) {
      used[path.pop()!] = false
      continue
    }
    options.push(order(next))
  }
  return path
}

/** 空きマスのうち、空きのとなりが無い(=現在地からしか入れない終点候補になる)マスの数 */
function deadCells(used: readonly boolean[], size: number, current: number): number {
  let dead = 0
  for (let c = 0; c < used.length; c++) {
    if (used[c]) continue
    const free = neighbors(c, size).filter((n) => !used[n]).length
    const touchesCurrent = isAdjacent(c, current, size)
    // 現在地のとなりなら、そこへ入って終わることはできる。そうでなければ空きのとなりが1個以上必要
    if (free === 0 && !touchesCurrent) return 99
    if (free + (touchesCurrent ? 1 : 0) <= 1) dead++
  }
  return dead
}

/**
 * 道の上に数字を置く位置(道の何番目か)。最初と最後は必ず含み、途中は2マス以上あけてランダムに選ぶ。
 */
export function numberPositions(pathLength: number, count: number, rng: Rng = defaultRng): number[] {
  const middle = count - 2
  for (let attempt = 0; attempt < 500; attempt++) {
    const picks = shuffle(
      Array.from({ length: pathLength - 2 }, (_, i) => i + 1),
      rng,
    )
      .slice(0, middle)
      .sort((a, b) => a - b)
    const all = [0, ...picks, pathLength - 1]
    if (all.every((p, i) => i === 0 || p - all[i - 1] >= 2)) return all
  }
  // ほぼ起きないが、念のため等間隔に置く
  return Array.from({ length: count }, (_, i) => Math.round((i * (pathLength - 1)) / (count - 1)))
}

export function buildBoardFor(cfg: LevelConfig, rng: Rng = defaultRng): Board {
  const solution = hamiltonianPath(cfg.size, rng)
  const numbers = new Array<number>(cfg.size * cfg.size).fill(0)
  numberPositions(solution.length, cfg.numbers, rng).forEach((pos, i) => (numbers[solution[pos]] = i + 1))
  return { size: cfg.size, numbers, last: cfg.numbers, solution }
}

export function buildBoard(level: Difficulty, mode: PlayMode, rng: Rng = defaultRng): Board {
  return buildBoardFor(mode === 'practice' ? PRACTICE_LEVEL : LEVELS[level], rng)
}

export function cellOfNumber(board: Board, n: number): number {
  return board.numbers.indexOf(n)
}

/** 道の中で次に通るべき数字 */
export function nextNumber(board: Board, trail: readonly number[]): number {
  let max = 0
  for (const c of trail) max = Math.max(max, board.numbers[c])
  return max + 1
}

export type StepResult =
  | 'ok'
  /** ひとつ前のマスに戻る(最後の1歩を消す) */
  | 'back'
  /** いまいるマス */
  | 'same'
  | 'not-adjacent'
  /** もう通ったマス */
  | 'visited'
  /** 数字の順番がちがう */
  | 'wrong-order'
  /** ほかのマスが残っているのに最後の数字へ入る */
  | 'goal-too-early'

/** 道の先端から cell へ進めるか */
export function checkStep(board: Board, trail: readonly number[], cell: number): StepResult {
  const end = trail[trail.length - 1]
  if (cell === end) return 'same'
  if (trail.length > 1 && cell === trail[trail.length - 2]) return 'back'
  if (!isAdjacent(end, cell, board.size)) return 'not-adjacent'
  if (trail.includes(cell)) return 'visited'
  const n = board.numbers[cell]
  if (n === 0) return 'ok'
  if (n !== nextNumber(board, trail)) return 'wrong-order'
  if (n === board.last && trail.length + 1 < board.numbers.length) return 'goal-too-early'
  return 'ok'
}

/** 先端から進めるマスがひとつも無い(戻るしかない) */
export function isStuck(board: Board, trail: readonly number[]): boolean {
  if (isComplete(board, trail)) return false
  const end = trail[trail.length - 1]
  return neighbors(end, board.size).every((n) => checkStep(board, trail, n) !== 'ok')
}

export function isComplete(board: Board, trail: readonly number[]): boolean {
  return trail.length === board.numbers.length && board.numbers[trail[trail.length - 1]] === board.last
}

/**
 * 道がルールを満たしているか(答えは1通りとは限らない)。
 * - 1 から始まり、最後の数字で終わる
 * - すべてのマスを1回ずつ通る
 * - たて・よこのとなりにだけ進む
 * - 数字は 1, 2, 3, … の順に通る
 */
export function validatePath(board: Board, path: readonly number[]): boolean {
  const total = board.numbers.length
  if (path.length !== total) return false
  if (new Set(path).size !== total) return false
  if (path.some((c) => !Number.isInteger(c) || c < 0 || c >= total)) return false
  if (board.numbers[path[0]] !== 1) return false
  if (board.numbers[path[total - 1]] !== board.last) return false
  for (let i = 1; i < total; i++) if (!isAdjacent(path[i - 1], path[i], board.size)) return false
  const seen = path.map((c) => board.numbers[c]).filter((n) => n > 0)
  return seen.length === board.last && seen.every((n, i) => n === i + 1)
}

/**
 * いまの道(trail)から、ルールどおりに最後まで行ける道を1つさがす(見つからなければ null)。
 * 答えは1通りとは限らないので、患者さんがたどった道の続きを探す。作った道の続きなら、それをそのまま使う。
 */
export function completeFrom(board: Board, trail: readonly number[], budget = 200000): number[] | null {
  const total = board.numbers.length
  if (trail.every((c, i) => board.solution[i] === c)) return [...board.solution]
  const path = [...trail]
  const used = new Set(path)
  let steps = 0
  const search = (): boolean => {
    if (path.length === total) return isComplete(board, path)
    if (steps++ > budget) return false
    const end = path[path.length - 1]
    // 行き先の少ないマスから試す(早く行き止まりに気づける)
    const options = neighbors(end, board.size)
      .filter((n) => checkStep(board, path, n) === 'ok')
      .map((n) => ({ n, free: neighbors(n, board.size).filter((m) => !used.has(m)).length }))
      .sort((a, b) => a.free - b.free)
    for (const { n } of options) {
      path.push(n)
      used.add(n)
      if (search()) return true
      path.pop()
      used.delete(n)
    }
    return false
  }
  return search() ? path : null
}

export type StrokeHint =
  /** 次に進むとよいマス */
  | { kind: 'next'; cell: number }
  /** この先は最後まで行けないので、道を length マスまで戻すとよい(その時の先端は cell) */
  | { kind: 'back'; length: number; cell: number }

/** ヒント: いまの道の続きで最後まで行けるなら次のマス、行けなければ戻る所 */
export function strokeHint(board: Board, trail: readonly number[]): StrokeHint {
  const full = completeFrom(board, trail)
  if (full) return { kind: 'next', cell: full[trail.length] }
  for (let len = trail.length - 1; len >= 1; len--) {
    if (completeFrom(board, trail.slice(0, len))) return { kind: 'back', length: len, cell: trail[len - 1] }
  }
  return { kind: 'back', length: 1, cell: trail[0] }
}
