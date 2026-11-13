import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import {
  advanceCar,
  buildCourse,
  chooseAtJunction,
  correctNext,
  dirOf,
  distances,
  LEVELS,
  spanningTree,
  startCar,
  stepToward,
  upcomingJunction,
  type Car,
  type CarEvent,
  type Course,
} from './logic'

function isGridNeighbor(a: number, b: number, cols: number): boolean {
  const ra = Math.floor(a / cols)
  const rb = Math.floor(b / cols)
  return (ra === rb && Math.abs(a - b) === 1) || (a % cols === b % cols && Math.abs(ra - rb) === 1)
}

function usedNodes(c: Course): number[] {
  return c.adj.flatMap((nbs, i) => (nbs.length > 0 ? [i] : []))
}

describe('spanningTree', () => {
  it('すべての点がつながり、ループがない', () => {
    for (let seed = 0; seed < 50; seed++) {
      const adj = spanningTree(7, 5, seededRng(seed))
      const edges = adj.reduce((n, nbs) => n + nbs.length, 0) / 2
      expect(edges).toBe(7 * 5 - 1)
      expect(distances(adj, 0).dist.every((d) => d >= 0)).toBe(true)
    }
  })
})

describe('buildCourse', () => {
  it('全レベルで、ゴールへの道が1本だけのコースができる', () => {
    for (const lv of DIFFICULTIES) {
      const cfg = LEVELS[lv]
      for (let seed = 0; seed < 80; seed++) {
        const c = buildCourse(lv, seededRng(seed * 31 + lv))
        const nodes = usedNodes(c)
        // 道はとなり合う点どうしだけ、ループなし(木)
        const edges = c.adj.reduce((n, nbs) => n + nbs.length, 0) / 2
        expect(edges).toBe(nodes.length - 1)
        for (const a of nodes) for (const b of c.adj[a]) expect(isGridNeighbor(a, b, c.cols)).toBe(true)
        // すべての点からゴールへ行ける
        for (const a of nodes) expect(c.toGoal[a]).toBeGreaterThanOrEqual(0)
        // スタートとゴールは道の端
        expect(c.adj[c.start]).toHaveLength(1)
        expect(c.adj[c.goal]).toHaveLength(1)
        expect(c.route[0]).toBe(c.start)
        expect(c.route[c.route.length - 1]).toBe(c.goal)
        // わき道の数どおり、行き止まりがある(スタート・ゴール以外の端)
        const deadEnds = nodes.filter((a) => c.adj[a].length === 1 && a !== c.start && a !== c.goal)
        expect(deadEnds).toHaveLength(cfg.spurs)
        // 分かれ道は正しい道の上にだけある(わき道は枝分かれしない)
        const onRoute = new Set(c.route)
        for (const a of nodes) if (c.adj[a].length >= 3) expect(onRoute.has(a)).toBe(true)
        // スタートは左側
        expect(c.start % c.cols).toBeLessThanOrEqual(c.goal % c.cols)
      }
    }
  })

  it('毎回ちがうコースになる', () => {
    const a = buildCourse(3, seededRng(1))
    const b = buildCourse(3, seededRng(2))
    expect(a.route).not.toEqual(b.route)
  })
})

describe('向き', () => {
  it('dirOf と stepToward が対応している', () => {
    const cols = 5
    const rows = 4
    const node = 7
    for (const d of [0, 1, 2, 3] as const) {
      const n = stepToward(node, d, cols, rows)
      expect(n).not.toBeNull()
      expect(dirOf(node, n!, cols)).toBe(d)
    }
    expect(stepToward(0, 0, cols, rows)).toBeNull()
    expect(stepToward(0, 3, cols, rows)).toBeNull()
  })
})

/** 車を走らせ、分かれ道では choose の方向へ進ませる */
function drive(c: Course, choose: (node: number, from: number) => number, segmentMs = 500) {
  let car: Car = startCar(c)
  const all: CarEvent[] = []
  for (let step = 0; step < 5000 && !car.arrived; step++) {
    if (car.waiting) {
      const r = chooseAtJunction(c, car, choose(car.to, car.from))!
      expect(r).not.toBeNull()
      car = r.car
      all.push(r.event)
      continue
    }
    const r = advanceCar(c, car, 120, segmentMs, null)
    car = r.car
    all.push(...r.events)
  }
  return { car, events: all }
}

describe('車の動き', () => {
  it('分かれ道で正しく選ぶと、まちがいなしでゴールする', () => {
    for (let seed = 0; seed < 30; seed++) {
      const c = buildCourse(4, seededRng(seed))
      const { car, events } = drive(c, (node) => correctNext(c, node))
      expect(car.arrived).toBe(true)
      expect(events.filter((e) => e.type === 'deadEnd')).toHaveLength(0)
      const turns = events.filter((e) => e.type === 'turn')
      expect(turns.every((e) => e.type === 'turn' && e.correct)).toBe(true)
      // 正しい道の上の分かれ道の数だけ止まって選ぶ
      const junctionsOnRoute = c.route.filter((a) => c.adj[a].length >= 3).length
      expect(turns).toHaveLength(junctionsOnRoute)
    }
  })

  it('わき道に入ると行き止まりでUターンし、戻ってきてまた選べる', () => {
    for (let seed = 0; seed < 30; seed++) {
      const c = buildCourse(3, seededRng(seed))
      const tried = new Set<number>()
      // 各分かれ道で、最初の1回はわざとわき道を選ぶ
      const { car, events } = drive(c, (node, from) => {
        if (!tried.has(node)) {
          tried.add(node)
          const wrong = c.adj[node].find((x) => x !== from && x !== correctNext(c, node) && !c.route.includes(x))
          if (wrong !== undefined) return wrong
        }
        return correctNext(c, node)
      })
      expect(car.arrived).toBe(true)
      const wrongTurns = events.filter((e) => e.type === 'turn' && !e.correct).length
      expect(events.filter((e) => e.type === 'deadEnd')).toHaveLength(wrongTurns)
      expect(wrongTurns).toBeGreaterThan(0)
    }
  })

  it('前もって決めた方向があれば、分かれ道で止まらずに曲がる', () => {
    const c = buildCourse(2, seededRng(5))
    let car = startCar(c)
    const j = upcomingJunction(c, car)!
    expect(j).not.toBeNull()
    const plan = { node: j.node, next: correctNext(c, j.node) }
    const events: CarEvent[] = []
    let used = false
    for (let i = 0; i < 400 && !used; i++) {
      const r = advanceCar(c, car, 100, 500, plan)
      car = r.car
      events.push(...r.events)
      used = r.usedPlan
    }
    expect(used).toBe(true)
    expect(events.some((e) => e.type === 'wait')).toBe(false)
    expect(events).toContainEqual({ type: 'turn', node: j.node, next: plan.next, correct: true })
  })

  it('分かれ道に着いても決めていなければ止まって待つ', () => {
    const c = buildCourse(2, seededRng(9))
    let car = startCar(c)
    const j = upcomingJunction(c, car)!
    for (let i = 0; i < 400 && !car.waiting; i++) car = advanceCar(c, car, 100, 500, null).car
    expect(car.waiting).toBe(true)
    expect(car.to).toBe(j.node)
    // 止まっている間は進まない
    expect(advanceCar(c, car, 10000, 500, null).car).toEqual(car)
    // 来た道へは戻れない
    expect(chooseAtJunction(c, car, car.from)).toBeNull()
  })

  it('最後の分かれ道を過ぎると、次の分かれ道はない(ゴールへ向かう)', () => {
    const c = buildCourse(1, seededRng(3))
    let car = startCar(c)
    for (let i = 0; i < 5000 && !car.arrived; i++) {
      if (car.waiting) car = chooseAtJunction(c, car, correctNext(c, car.to))!.car
      else car = advanceCar(c, car, 100, 500, null).car
      if (!car.waiting && !car.arrived) {
        const j = upcomingJunction(c, car)
        if (j) expect(c.adj[j.node].length).toBeGreaterThanOrEqual(3)
      }
    }
    expect(car.arrived).toBe(true)
    expect(upcomingJunction(c, car)).toBeNull()
  })
})
