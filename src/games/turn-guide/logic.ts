import { stepToward, type Dir } from '../../core/grid'
import { defaultRng, randInt, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

/**
 * 右・左の道案内
 * 町の地図(上から見た図)に、車とゴールの旗、通る道(点線)が描いてある。
 * 曲がり角で「車から見て」右・左・まっすぐのどれに進むかを答える。
 * 地図は回さず、車の向きだけが変わるので、下向きや横向きの車では、画面の左右と車の左右がちがう。
 */
export type Rel = 'left' | 'straight' | 'right'

export const REL_NAME: Record<Rel, string> = { left: 'ひだり', straight: 'まっすぐ', right: 'みぎ' }

export interface LevelConfig {
  /** 答える曲がり角の数 */
  turns: 1 | 2 | 3
  /** 車の最初の向き(0=上 1=右 2=下 3=左) */
  headings: readonly Dir[]
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { turns: 1, headings: [0] },
  2: { turns: 1, headings: [0, 2] },
  3: { turns: 1, headings: [0, 1, 2, 3] },
  4: { turns: 2, headings: [0, 1, 2, 3] },
  5: { turns: 3, headings: [0, 1, 2, 3] },
}

export function questionCount(level: Difficulty, mode: PlayMode): number {
  if (mode === 'practice') return 2
  return LEVELS[level].turns === 1 ? 8 : 5
}

/** 地図の交差点の数(よこ × たて) */
export const MAP_COLS = 7
export const MAP_ROWS = 5

/** 進む向き dir から、rel の方へ曲がったあとの向き */
export function turn(dir: Dir, rel: Rel): Dir {
  const d = rel === 'left' ? 3 : rel === 'right' ? 1 : 0
  return ((dir + d) % 4) as Dir
}

/** 向き from で進んできて、向き to へ進むときの、車から見た曲がり方(Uターンは null) */
export function relOf(from: Dir, to: Dir): Rel | null {
  const d = (to - from + 4) % 4
  if (d === 0) return 'straight'
  if (d === 1) return 'right'
  if (d === 3) return 'left'
  return null
}

export interface Route {
  /** 通る交差点(最初は車のいる所、最後は旗の所) */
  nodes: number[]
  /** 車の最初の向き */
  heading: Dir
  /** 曲がり角(nodes[1] 〜)ごとの正しい答え */
  answers: Rel[]
}

/** 1問ぶんの道を作る。まっすぐは少なめ(曲がる判断を多く練習するため) */
export function buildRoute(cfg: LevelConfig, rng: Rng = defaultRng): Route {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const heading = cfg.headings[randInt(0, cfg.headings.length - 1, rng)]
    const start = randInt(0, MAP_COLS * MAP_ROWS - 1, rng)
    const nodes = [start]
    const answers: Rel[] = []
    let dir = heading
    let cur = start
    let ok = true
    // 車 → 最初の曲がり角 → … → 最後の曲がり角 → 旗(どの区間も1ブロック)
    for (let k = 0; k <= cfg.turns; k++) {
      const next = stepToward(cur, dir, MAP_COLS, MAP_ROWS)
      if (next === null || nodes.includes(next)) {
        ok = false
        break
      }
      nodes.push(next)
      cur = next
      if (k < cfg.turns) {
        const r = rng()
        const rel: Rel = r < 0.2 ? 'straight' : r < 0.6 ? 'left' : 'right'
        answers.push(rel)
        dir = turn(dir, rel)
      }
    }
    // 曲がり角は地図のふち以外(どの向きにも道がある十字路)にする
    const inner = (n: number) => {
      const c = n % MAP_COLS
      const r = Math.floor(n / MAP_COLS)
      return c > 0 && c < MAP_COLS - 1 && r > 0 && r < MAP_ROWS - 1
    }
    if (!ok || !nodes.slice(1, -1).every(inner)) continue
    // 1問に1つは曲がる(全部まっすぐにはしない)
    if (answers.every((a) => a === 'straight')) continue
    return { nodes, heading, answers }
  }
  throw new Error('道を作れませんでした')
}

export function buildQuestions(level: Difficulty, mode: PlayMode, rng: Rng = defaultRng): Route[] {
  const cfg = LEVELS[level]
  const out: Route[] = []
  const n = questionCount(level, mode)
  for (let guard = 0; out.length < n && guard < 200; guard++) {
    const r = buildRoute(cfg, rng)
    // 同じ答えの問題ばかり続かないよう、直前と同じ向き・同じ答えの組み合わせは避ける
    const prev = out[out.length - 1]
    if (prev && prev.heading === r.heading && prev.answers.join() === r.answers.join()) continue
    out.push(r)
  }
  return out
}

/** 曲がり角 k(0から)に入ってくるときの車の向き */
export function incomingDir(route: Route, k: number, cols = MAP_COLS): Dir {
  const a = route.nodes[k]
  const b = route.nodes[k + 1]
  if (b === a - cols) return 0
  if (b === a + 1) return 1
  if (b === a + cols) return 2
  return 3
}

/** 答え合わせ: 曲がり角ごとに合っているか */
export function checkAnswers(route: Route, picks: readonly (Rel | null)[]): boolean[] {
  return route.answers.map((a, i) => picks[i] === a)
}
