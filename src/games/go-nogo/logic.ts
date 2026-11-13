import { defaultRng, randInt, shuffle, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

/**
 * Go/No-Go(おす・おさない)
 * 絵が1枚ずつ出る。決まった絵(Go)のときだけ「おす」を押し、それ以外(No-Go)では押さずにがまんする。
 * 反応を抑える力(衝動性のコントロール)と、注意の持続を使う。Go を多めにして「つい押してしまう」状況を作る。
 */
export interface LevelConfig {
  /** 押す絵 */
  go: readonly string[]
  /** 押さない絵 */
  nogo: readonly string[]
  /** 患者さん向けのきまり */
  rule: string
  items: number
  /** Go の割合 */
  goRate: number
  showMs: number
  gapMs: number
}

const FRUITS = ['🍎', '🍌', '🍇', '🍊'] as const
const ANIMALS = ['🐶', '🐱', '🐟', '🐝'] as const

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { go: ['🍎'], nogo: ['🐝'], rule: 'りんごの ときだけ おす', items: 24, goRate: 0.75, showMs: 1500, gapMs: 700 },
  2: { go: ['🍎'], nogo: ['🐝'], rule: 'りんごの ときだけ おす', items: 30, goRate: 0.75, showMs: 1000, gapMs: 600 },
  3: { go: FRUITS, nogo: ANIMALS, rule: 'くだものの ときだけ おす', items: 30, goRate: 0.7, showMs: 1300, gapMs: 600 },
  4: { go: FRUITS, nogo: ANIMALS, rule: 'くだものの ときだけ おす', items: 36, goRate: 0.7, showMs: 900, gapMs: 500 },
  // 「りんご以外で押す」: 押すことが多い中で、りんごだけがまんする(逆のきまり)
  5: {
    go: ['🍌', '🍇', '🍊', '🐶', '🐱', '🐟'],
    nogo: ['🍎'],
    rule: 'りんご いがいの ときに おす',
    items: 36,
    goRate: 0.75,
    showMs: 1000,
    gapMs: 500,
  },
}

export function configFor(level: Difficulty, mode: PlayMode): LevelConfig {
  const cfg = LEVELS[level]
  return mode === 'practice' ? { ...cfg, items: 10, showMs: cfg.showMs + 400 } : cfg
}

export interface Item {
  picture: string
  go: boolean
}

/**
 * 絵の並びを作る。Go と No-Go の数は割合どおりにし、最初の2枚は Go、No-Go は3枚以上続けない。
 */
export function buildItems(cfg: LevelConfig, rng: Rng = defaultRng): Item[] {
  const nogoCount = Math.round(cfg.items * (1 - cfg.goRate))
  const pick = (list: readonly string[]) => list[randInt(0, list.length - 1, rng)]
  for (let attempt = 0; attempt < 500; attempt++) {
    const kinds = shuffle([...new Array(cfg.items - nogoCount).fill(true), ...new Array(nogoCount).fill(false)] as boolean[], rng)
    if (!kinds[0] || !kinds[1]) continue
    if (kinds.some((g, i) => !g && i >= 2 && !kinds[i - 1] && !kinds[i - 2])) continue
    return kinds.map((go) => ({ go, picture: pick(go ? cfg.go : cfg.nogo) }))
  }
  throw new Error('絵の並びを作れませんでした')
}

export interface Response {
  pressed: boolean
  rtMs: number | null
}

export interface Score {
  /** Go で押せた */
  hits: number
  /** Go なのに押さなかった */
  omissions: number
  /** No-Go で押してしまった */
  commissions: number
  /** No-Go でがまんできた */
  correctRejections: number
}

export function score(items: readonly Item[], responses: readonly Response[]): Score {
  const s: Score = { hits: 0, omissions: 0, commissions: 0, correctRejections: 0 }
  items.forEach((it, i) => {
    const p = responses[i]?.pressed ?? false
    if (it.go && p) s.hits++
    else if (it.go) s.omissions++
    else if (p) s.commissions++
    else s.correctRejections++
  })
  return s
}
