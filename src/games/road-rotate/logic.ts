import { dirOf, DIRS, distances, opposite, pathTo, spanningTree, stepToward, type Dir } from '../../core/grid'
import { defaultRng, randInt, shuffle, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

/**
 * 道つなぎ
 * マス目に道のタイル(まっすぐ・カーブ・T字)が並んでいる。タップすると時計回りに90度まわる。
 * 左のスタートから右のゴールまで道がつながるように向きをそろえ、「しゅっぱつ」で車を走らせる。
 * つながっていなければ車は途切れた所で止まり、スタートに戻る(何度でもやり直せる)。
 */
export type Shape = 'straight' | 'curve' | 'tee'

export interface LevelConfig {
  cols: number
  rows: number
  /** ゴールまでの道に使うタイルの最少数 */
  minPath: number
  /** 道以外のマスに、おとりのタイルを置く割合(0なら空き地) */
  decoyFill: number
  /** おとりに使う形 */
  decoyShapes: readonly Shape[]
  /** 最初に向きがずれている道のタイルの最少数 */
  minWrong: number
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { cols: 3, rows: 3, minPath: 4, decoyFill: 0, decoyShapes: [], minWrong: 2 },
  2: { cols: 4, rows: 3, minPath: 5, decoyFill: 0.5, decoyShapes: ['straight', 'curve'], minWrong: 3 },
  3: { cols: 5, rows: 4, minPath: 7, decoyFill: 1, decoyShapes: ['straight', 'curve'], minWrong: 4 },
  4: { cols: 6, rows: 4, minPath: 8, decoyFill: 1, decoyShapes: ['straight', 'curve', 'tee'], minWrong: 5 },
  5: { cols: 7, rows: 5, minPath: 10, decoyFill: 1, decoyShapes: ['straight', 'curve', 'tee'], minWrong: 7 },
}

export const PUZZLES: Record<PlayMode, number> = { main: 3, practice: 1 }

/** 向きの集まりをビットで表す(上=1 右=2 下=4 左=8) */
export type Mask = number

export function bit(d: Dir): Mask {
  return 1 << d
}

/** 回す前(rot=0)の形 */
export const BASE: Record<Shape, Mask> = {
  straight: bit(0) | bit(2),
  curve: bit(0) | bit(1),
  tee: bit(1) | bit(2) | bit(3),
}

/** 時計回りに k 回(90度ずつ)まわす */
export function rotateMask(m: Mask, k: number): Mask {
  let out = 0
  for (const d of DIRS) if (m & bit(d)) out |= bit(((d + k) % 4) as Dir)
  return out
}

export interface Tile {
  shape: Shape
  /** 何回まわした状態か(0〜3) */
  rot: number
}

export function tileMask(t: Tile | null): Mask {
  return t ? rotateMask(BASE[t.shape], t.rot) : 0
}

export interface Puzzle {
  cols: number
  rows: number
  /** null は空き地 */
  tiles: (Tile | null)[]
  /** スタートのマス(左端の列)。左の外から車が入ってくる */
  start: number
  /** ゴールのマス(右端の列)。右の外へ出るとゴール */
  goal: number
  /** 作るときに用意した正解の道(ほかの道でつないでもよい) */
  route: number[]
  /** route の各マスで必要な向き */
  need: Mask[]
}

/** タイルを1回まわしたあとの盤面 */
export function rotateTile(p: Puzzle, cell: number): Puzzle {
  const t = p.tiles[cell]
  if (!t) return p
  const tiles = [...p.tiles]
  tiles[cell] = { ...t, rot: (t.rot + 1) % 4 }
  return { ...p, tiles }
}

/** 必要な向きにするために、あと何回まわせばよいか(できなければ null) */
export function turnsToFit(t: Tile, need: Mask): number | null {
  for (let k = 0; k < 4; k++) if (rotateMask(BASE[t.shape], t.rot + k) === need) return k
  return null
}

/** 正解の道にそろえるのに必要な回転の合計(目安) */
export function minTurns(p: Puzzle): number {
  return p.route.reduce((n, cell, i) => n + (turnsToFit(p.tiles[cell]!, p.need[i]) ?? 0), 0)
}

/** スタートからたどれる道。つながったマスの隣どうしは両方のタイルが向き合っている */
function connectedGraph(p: Puzzle): number[][] {
  const { cols, rows } = p
  return p.tiles.map((_, cell) => {
    const m = tileMask(p.tiles[cell])
    const out: number[] = []
    for (const d of DIRS) {
      if (!(m & bit(d))) continue
      const nb = stepToward(cell, d, cols, rows)
      if (nb !== null && tileMask(p.tiles[nb]) & bit(opposite(d))) out.push(nb)
    }
    return out
  })
}

export interface DriveResult {
  /** ゴールまでつながっているか */
  solved: boolean
  /** 車が通るマスの順(スタートに入れなければ空) */
  cells: number[]
}

/**
 * 車がスタートから走ったときの道筋。
 * つながっていればゴールまでの最短の道、つながっていなければ行ける所のうちいちばん遠いマスまで。
 */
export function drive(p: Puzzle): DriveResult {
  if (!(tileMask(p.tiles[p.start]) & bit(3))) return { solved: false, cells: [] }
  const { dist, parent } = distances(connectedGraph(p), p.start)
  if (dist[p.goal] >= 0 && tileMask(p.tiles[p.goal]) & bit(1)) {
    return { solved: true, cells: pathTo(parent, p.goal) }
  }
  let far = p.start
  dist.forEach((d, cell) => {
    if (d > dist[far]) far = cell
  })
  return { solved: false, cells: pathTo(parent, far) }
}

/** 入ってくる向きと出ていく向きから、その道のタイルの形と必要な向きを決める */
function pieceFor(inDir: Dir, outDir: Dir): { shape: Shape; need: Mask } {
  const need = bit(inDir) | bit(outDir)
  return { shape: inDir === opposite(outDir) ? 'straight' : 'curve', need }
}

function makePuzzle(cfg: LevelConfig, rng: Rng): Puzzle | null {
  const { cols, rows } = cfg
  const tree = spanningTree(cols, rows, rng, 0.85)
  const start = randInt(0, rows - 1, rng) * cols
  const goal = randInt(0, rows - 1, rng) * cols + cols - 1
  const route = pathTo(distances(tree, start).parent, goal)
  if (route.length < cfg.minPath) return null

  const tiles: (Tile | null)[] = new Array(cols * rows).fill(null)
  const need: Mask[] = []
  route.forEach((cell, i) => {
    // 道の入口と出口(スタートは左の外から、ゴールは右の外へ)
    const inDir: Dir = i === 0 ? 3 : dirOf(cell, route[i - 1], cols)
    const outDir: Dir = i === route.length - 1 ? 1 : dirOf(cell, route[i + 1], cols)
    const piece = pieceFor(inDir, outDir)
    need.push(piece.need)
    tiles[cell] = { shape: piece.shape, rot: randInt(0, 3, rng) }
  })

  const onRoute = new Set(route)
  for (let cell = 0; cell < tiles.length; cell++) {
    if (onRoute.has(cell) || cfg.decoyShapes.length === 0 || rng() >= cfg.decoyFill) continue
    tiles[cell] = { shape: cfg.decoyShapes[randInt(0, cfg.decoyShapes.length - 1, rng)], rot: randInt(0, 3, rng) }
  }

  // 向きのずれた道のタイルが少なすぎるときは、ずらしなおす
  const puzzle: Puzzle = { cols, rows, tiles, start, goal, route, need }
  const wrong = () => route.filter((cell, i) => turnsToFit(tiles[cell]!, need[i]) !== 0)
  for (const i of shuffle(
    route.map((_, i) => i),
    rng,
  )) {
    if (wrong().length >= Math.min(cfg.minWrong, route.length)) break
    const t = tiles[route[i]]!
    if (turnsToFit(t, need[i]) === 0) tiles[route[i]] = { ...t, rot: (t.rot + randInt(1, 3, rng)) % 4 }
    // まっすぐの道は半回転すると元と同じなので、もう一度ずらす
    if (turnsToFit(tiles[route[i]]!, need[i]) === 0) tiles[route[i]] = { ...t, rot: (t.rot + 1) % 4 }
  }
  if (wrong().length < Math.min(cfg.minWrong, route.length)) return null
  // 最初からつながっている盤面は出さない
  if (drive(puzzle).solved) return null
  return puzzle
}

export function buildPuzzle(level: Difficulty, rng: Rng = defaultRng): Puzzle {
  const cfg = LEVELS[level]
  for (let attempt = 0; attempt < 500; attempt++) {
    const p = makePuzzle(cfg, rng)
    if (p) return p
  }
  throw new Error(`盤面を作れませんでした(レベル${level})`)
}

/** ヒント: 正解の道のうち、向きがずれているタイル(スタートに近いものから)。ずれが無ければ null */
export function hintTile(p: Puzzle): number | null {
  const i = p.route.findIndex((cell, k) => turnsToFit(p.tiles[cell]!, p.need[k]) !== 0)
  return i < 0 ? null : p.route[i]
}

/** こたえ: 正解の道のタイルを正しい向きにそろえた盤面と、タイルごとに回した回数 */
export function solvedPuzzle(p: Puzzle): { puzzle: Puzzle; turns: Map<number, number> } {
  const tiles = [...p.tiles]
  const turns = new Map<number, number>()
  p.route.forEach((cell, k) => {
    const t = tiles[cell]!
    const n = turnsToFit(t, p.need[k]) ?? 0
    if (n > 0) {
      tiles[cell] = { ...t, rot: (t.rot + n) % 4 }
      turns.set(cell, n)
    }
  })
  return { puzzle: { ...p, tiles }, turns }
}
