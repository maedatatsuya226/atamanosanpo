import { defaultRng, sample, shuffle, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

/**
 * 買い物メモの記憶
 * 買い物メモ(文字だけ)を覚え、(待ち時間のあと)お店の棚に並んだ品物(絵と名前)から、メモにあった物を全部選ぶ。
 * 文字で覚えて絵から選ぶので、絵カード記憶(絵→絵)とはちがう覚え方になる。
 * 上のレベルでは、メモの品物と同じ種類の物(牛乳に対するチーズなど)が棚に混ざる。
 */
export type Kind = 'dairy' | 'grain' | 'fruit' | 'veg' | 'meat' | 'drink' | 'sweets' | 'daily'

export interface Item {
  e: string
  name: string
  kind: Kind
}

export const ITEMS: readonly Item[] = [
  { e: '🥛', name: 'ぎゅうにゅう', kind: 'dairy' },
  { e: '🧀', name: 'チーズ', kind: 'dairy' },
  { e: '🧈', name: 'バター', kind: 'dairy' },
  { e: '🥚', name: 'たまご', kind: 'dairy' },
  { e: '🍞', name: 'パン', kind: 'grain' },
  { e: '🍚', name: 'おこめ', kind: 'grain' },
  { e: '🍙', name: 'おにぎり', kind: 'grain' },
  { e: '🍜', name: 'ラーメン', kind: 'grain' },
  { e: '🍎', name: 'りんご', kind: 'fruit' },
  { e: '🍌', name: 'バナナ', kind: 'fruit' },
  { e: '🍊', name: 'みかん', kind: 'fruit' },
  { e: '🍇', name: 'ぶどう', kind: 'fruit' },
  { e: '🍓', name: 'いちご', kind: 'fruit' },
  { e: '🍅', name: 'トマト', kind: 'veg' },
  { e: '🥕', name: 'にんじん', kind: 'veg' },
  { e: '🧅', name: 'たまねぎ', kind: 'veg' },
  { e: '🥔', name: 'じゃがいも', kind: 'veg' },
  { e: '🍆', name: 'なす', kind: 'veg' },
  { e: '🥒', name: 'きゅうり', kind: 'veg' },
  { e: '🐟', name: 'さかな', kind: 'meat' },
  { e: '🍗', name: 'とりにく', kind: 'meat' },
  { e: '🥩', name: 'ぎゅうにく', kind: 'meat' },
  { e: '🍵', name: 'おちゃ', kind: 'drink' },
  { e: '☕', name: 'コーヒー', kind: 'drink' },
  { e: '🧃', name: 'ジュース', kind: 'drink' },
  { e: '🍬', name: 'あめ', kind: 'sweets' },
  { e: '🍪', name: 'クッキー', kind: 'sweets' },
  { e: '🍫', name: 'チョコレート', kind: 'sweets' },
  { e: '🧻', name: 'トイレットペーパー', kind: 'daily' },
  { e: '🧼', name: 'せっけん', kind: 'daily' },
  { e: '🪥', name: 'はブラシ', kind: 'daily' },
  { e: '🔋', name: 'でんち', kind: 'daily' },
]

export interface LevelConfig {
  /** メモの品物の数 */
  count: number
  /** 棚に並べる品物の数(メモの品物を含む) */
  shelf: number
  /** 棚を見るまでの待ち時間(秒) */
  delaySec: number
  /** 棚に、メモの品物と同じ種類の物を混ぜる */
  similar: boolean
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { count: 3, shelf: 6, delaySec: 0, similar: false },
  2: { count: 4, shelf: 8, delaySec: 0, similar: false },
  3: { count: 5, shelf: 10, delaySec: 10, similar: false },
  4: { count: 6, shelf: 12, delaySec: 20, similar: false },
  5: { count: 6, shelf: 12, delaySec: 30, similar: true },
}

export const PRACTICE: LevelConfig = { count: 3, shelf: 6, delaySec: 0, similar: false }

export const ROUNDS: Record<PlayMode, number> = { main: 3, practice: 1 }

export function configFor(level: Difficulty, mode: PlayMode): LevelConfig {
  return mode === 'practice' ? PRACTICE : LEVELS[level]
}

/** メモを覚える時間(品物1つにつき2.5秒+3秒)。「おぼえました」で早く進められる */
export function studyMs(cfg: LevelConfig): number {
  return cfg.count * 2500 + 3000
}

export interface Round {
  memo: Item[]
  shelf: Item[]
}

export function buildRound(cfg: LevelConfig, rng: Rng = defaultRng): Round {
  // メモの品物は、なるべく種類がばらけるように選ぶ
  const kinds = shuffle([...new Set(ITEMS.map((i) => i.kind))], rng)
  const memo: Item[] = []
  for (let i = 0; memo.length < cfg.count; i++) {
    const kind = kinds[i % kinds.length]
    const pool = ITEMS.filter((it) => it.kind === kind && !memo.includes(it))
    if (pool.length > 0) memo.push(sample(pool, 1, rng)[0])
  }
  const rest = ITEMS.filter((it) => !memo.includes(it))
  let others: Item[]
  if (cfg.similar) {
    // メモの品物と同じ種類の物を先に入れ、足りなければほかの物で埋める
    const memoKinds = new Set(memo.map((m) => m.kind))
    const same = shuffle(
      rest.filter((it) => memoKinds.has(it.kind)),
      rng,
    ).slice(0, cfg.shelf - cfg.count)
    const fill = sample(
      rest.filter((it) => !same.includes(it)),
      cfg.shelf - cfg.count - same.length,
      rng,
    )
    others = [...same, ...fill]
  } else {
    others = sample(rest, cfg.shelf - cfg.count, rng)
  }
  return { memo, shelf: shuffle([...memo, ...others], rng) }
}

export interface RoundScore {
  total: number
  hits: number
  misses: number
  falseAlarms: number
}

export function scoreRound(round: Round, selected: ReadonlySet<string>): RoundScore {
  const memo = new Set(round.memo.map((m) => m.name))
  const hits = [...selected].filter((n) => memo.has(n)).length
  return {
    total: round.memo.length,
    hits,
    misses: round.memo.length - hits,
    falseAlarms: [...selected].filter((n) => !memo.has(n)).length,
  }
}
