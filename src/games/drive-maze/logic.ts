import { dirOf, distances, spanningTree, type Dir } from '../../core/grid'
import { defaultRng, randInt, shuffle, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

export { DIRS, dirOf, distances, spanningTree, stepToward, type Dir } from '../../core/grid'

/**
 * ドライブ迷路
 * 迷路のような道を車が自動で走る。曲がり角(分かれ道)に着く前に、どちらへ曲がるかを決めておく。
 * 間に合わなければ車は分かれ道で止まって待つ(1回のミスで終わりにしない)。
 * まちがえて行き止まりに入ると、車はそこでUターンして戻ってくる。
 *
 * 道はマス目の点(交差点)と、そのあいだの道路でできている。
 * ゴールへの道は1本だけで、途中に行き止まりの「わき道」がある。
 */
export interface LevelConfig {
  cols: number
  rows: number
  /** わき道(行き止まり)の数 */
  spurs: number
  /** わき道の長さ(区間の数) */
  spurMin: number
  spurMax: number
  /** 車が1区間を走るのにかかる時間(ミリ秒) */
  segmentMs: number
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { cols: 5, rows: 4, spurs: 2, spurMin: 1, spurMax: 2, segmentMs: 1200 },
  2: { cols: 6, rows: 4, spurs: 3, spurMin: 1, spurMax: 2, segmentMs: 1000 },
  3: { cols: 7, rows: 5, spurs: 4, spurMin: 1, spurMax: 3, segmentMs: 850 },
  4: { cols: 8, rows: 5, spurs: 6, spurMin: 2, spurMax: 3, segmentMs: 700 },
  5: { cols: 9, rows: 6, spurs: 8, spurMin: 2, spurMax: 4, segmentMs: 600 },
}

export const COURSES: Record<PlayMode, number> = { main: 3, practice: 1 }

export interface Course {
  cols: number
  rows: number
  /** 点ごとの、道でつながっている点。使わない点は空 */
  adj: number[][]
  start: number
  goal: number
  /** スタートからゴールまでの正しい道順 */
  route: number[]
  /** ゴールまでの区間の数(使わない点は -1) */
  toGoal: number[]
}

function farthest(dist: number[]): number {
  let best = 0
  for (let i = 1; i < dist.length; i++) if (dist[i] > dist[best]) best = i
  return best
}

function link(adj: number[][], a: number, b: number) {
  if (!adj[a].includes(b)) adj[a].push(b)
  if (!adj[b].includes(a)) adj[b].push(a)
}

/** 木から1コースを切り出す。わき道が足りなければ null */
function carveCourse(cfg: LevelConfig, rng: Rng): Course | null {
  const { cols, rows } = cfg
  const tree = spanningTree(cols, rows, rng)

  // いちばん遠い2点をスタートとゴールにする(道が長くなる)
  const a = farthest(distances(tree, randInt(0, tree.length - 1, rng)).dist)
  const { dist, parent } = distances(tree, a)
  const b = farthest(dist)
  const path: number[] = []
  for (let cur = b; cur !== -1; cur = parent[cur]) path.push(cur)
  path.reverse()
  // スタートは左側にそろえる
  const route = path[0] % cols <= path[path.length - 1] % cols ? path : [...path].reverse()
  const onRoute = new Set(route)

  // わき道の候補 = 正しい道の途中の点から、道から外れる方向
  const candidates: { at: number; first: number }[] = []
  for (let i = 1; i < route.length - 1; i++) {
    for (const nb of tree[route[i]]) if (!onRoute.has(nb)) candidates.push({ at: route[i], first: nb })
  }
  if (candidates.length < cfg.spurs) return null

  const adj: number[][] = Array.from({ length: cols * rows }, () => [])
  for (let i = 1; i < route.length; i++) link(adj, route[i - 1], route[i])

  for (const { at, first } of shuffle(candidates, rng).slice(0, cfg.spurs)) {
    // わき道は枝分かれしない1本道にする(行き止まりでUターンしたら、そのまま戻れる)
    const length = randInt(cfg.spurMin, cfg.spurMax, rng)
    let prev = at
    let cur = first
    link(adj, prev, cur)
    for (let k = 1; k < length; k++) {
      const next = tree[cur].filter((x) => x !== prev)
      if (next.length === 0) break
      const pick = next[randInt(0, next.length - 1, rng)]
      link(adj, cur, pick)
      prev = cur
      cur = pick
    }
  }

  const start = route[0]
  const goal = route[route.length - 1]
  return { cols, rows, adj, start, goal, route, toGoal: distances(adj, goal).dist }
}

export function buildCourse(level: Difficulty, rng: Rng = defaultRng): Course {
  const cfg = LEVELS[level]
  for (let attempt = 0; attempt < 500; attempt++) {
    const course = carveCourse(cfg, rng)
    if (course) return course
  }
  throw new Error(`コースを作れませんでした(レベル${level})`)
}

/** 来た道を除いた、進める方向 */
export function exitsFrom(course: Course, node: number, cameFrom: number): number[] {
  return course.adj[node].filter((x) => x !== cameFrom)
}

/** その分かれ道で、ゴールへ向かう正しい行き先 */
export function correctNext(course: Course, node: number): number {
  const d = course.toGoal[node]
  const next = course.adj[node].find((x) => course.toGoal[x] === d - 1)
  if (next === undefined) throw new Error(`ゴールへの道がありません: ${node}`)
  return next
}

/**
 * 車の状態。from から to へ向かって走っていて、t は 0〜1 の進み具合。
 * waiting / arrived のときは to の位置に止まっている。
 */
export interface Car {
  from: number
  to: number
  t: number
  waiting: boolean
  arrived: boolean
}

export function startCar(course: Course): Car {
  return { from: course.start, to: course.adj[course.start][0], t: 0, waiting: false, arrived: false }
}

/** 前もって決めておいた曲がり方(どの分かれ道で、どの点へ進むか) */
export interface Plan {
  node: number
  next: number
}

/** 車がこれから着く分かれ道(と、その分かれ道へ入ってくる向きの手前の点)。先にゴールへ着くなら null */
export function upcomingJunction(course: Course, car: Car): { node: number; from: number } | null {
  if (car.arrived) return null
  if (car.waiting) return { node: car.to, from: car.from }
  let prev = car.from
  let cur = car.to
  for (let guard = 0; guard < course.adj.length * 4; guard++) {
    if (cur === course.goal) return null
    const exits = exitsFrom(course, cur, prev)
    if (exits.length >= 2) return { node: cur, from: prev }
    // 1本道ならそのまま進み、行き止まりならUターン
    const next = exits.length === 1 ? exits[0] : prev
    prev = cur
    cur = next
  }
  return null
}

export type CarEvent =
  | { type: 'goal' }
  | { type: 'deadEnd'; node: number }
  | { type: 'wait'; node: number }
  | { type: 'turn'; node: number; next: number; correct: boolean }

/** 分かれ道で止まっている車を、選んだ方向へ出発させる */
export function chooseAtJunction(course: Course, car: Car, next: number): { car: Car; event: CarEvent } | null {
  if (!car.waiting || !exitsFrom(course, car.to, car.from).includes(next)) return null
  return {
    car: { from: car.to, to: next, t: 0, waiting: false, arrived: false },
    event: { type: 'turn', node: car.to, next, correct: correctNext(course, car.to) === next },
  }
}

/**
 * 車を dtMs だけ進める。分かれ道では plan があればその方向へ曲がり、なければ止まって待つ。
 * plan はその分かれ道を通ったら使い終わる(usedPlan が true になる)。
 */
export function advanceCar(
  course: Course,
  car: Car,
  dtMs: number,
  segmentMs: number,
  plan: Plan | null,
): { car: Car; events: CarEvent[]; usedPlan: boolean } {
  const events: CarEvent[] = []
  let usedPlan = false
  if (car.waiting || car.arrived) return { car, events, usedPlan }
  let { from, to, t } = car
  t += dtMs / segmentMs
  while (t >= 1) {
    const node = to
    if (node === course.goal) {
      events.push({ type: 'goal' })
      return { car: { from, to: node, t: 1, waiting: false, arrived: true }, events, usedPlan }
    }
    const exits = exitsFrom(course, node, from)
    if (exits.length === 0) {
      events.push({ type: 'deadEnd', node })
      ;[from, to] = [node, from]
      t -= 1
      continue
    }
    if (exits.length === 1) {
      from = node
      to = exits[0]
      t -= 1
      continue
    }
    if (plan && plan.node === node && exits.includes(plan.next)) {
      const next = plan.next
      events.push({ type: 'turn', node, next, correct: correctNext(course, node) === next })
      usedPlan = true
      plan = null
      from = node
      to = next
      t -= 1
      continue
    }
    events.push({ type: 'wait', node })
    return { car: { from, to: node, t: 1, waiting: true, arrived: false }, events, usedPlan }
  }
  return { car: { from, to, t, waiting: false, arrived: false }, events, usedPlan }
}

/** 画面に描く車の位置(マス目の単位)と向き */
export function carPose(course: Course, car: Car): { x: number; y: number; dir: Dir } {
  const { cols } = course
  const fx = (car.from % cols) + 0.5
  const fy = Math.floor(car.from / cols) + 0.5
  const tx = (car.to % cols) + 0.5
  const ty = Math.floor(car.to / cols) + 0.5
  const t = Math.min(1, Math.max(0, car.t))
  return { x: fx + (tx - fx) * t, y: fy + (ty - fy) * t, dir: dirOf(car.from, car.to, cols) }
}
