import { defaultRng, sample, shuffle, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

/**
 * 絵カード。絵は iPad の絵文字フォントで表示する(画像ファイルは使わない)。
 * 名前はカードの下に出す(ことばでも覚えられるように)。
 */
export interface Picture {
  emoji: string
  /** ひらがなの名前。カード内に収まるよう6文字まで */
  name: string
  category: CategoryId
}

export type CategoryId =
  | 'fruit'
  | 'vegetable'
  | 'food'
  | 'animal'
  | 'creature'
  | 'vehicle'
  | 'tool'
  | 'home'
  | 'wear'
  | 'sky'
  | 'plant'

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  fruit: 'くだもの',
  vegetable: 'やさい',
  food: 'たべもの',
  animal: 'どうぶつ',
  creature: 'とり・むし・さかな',
  vehicle: 'のりもの',
  tool: 'どうぐ',
  home: 'いえの もの',
  wear: 'みにつける もの',
  sky: 'そら・てんき',
  plant: 'はな・き',
}

/**
 * 古い iOS でも表示できる絵文字(主に Unicode 9 以前)に限る。
 * 国旗・人物(肌の色)・ZWJ 合成の絵文字は使わない。
 * 単独では文字として表示されやすい記号には絵文字指定(U+FE0F)を付ける。
 */
const RAW: Record<CategoryId, [string, string][]> = {
  fruit: [
    ['🍎', 'りんご'],
    ['🍊', 'みかん'],
    ['🍇', 'ぶどう'],
    ['🍓', 'いちご'],
    ['🍑', 'もも'],
    ['🍉', 'すいか'],
    ['🍒', 'さくらんぼ'],
  ],
  vegetable: [
    ['🥕', 'にんじん'],
    ['🍆', 'なす'],
    ['🌽', 'とうもろこし'],
    ['🥒', 'きゅうり'],
    ['🍄', 'きのこ'],
    ['🥔', 'じゃがいも'],
  ],
  food: [
    ['🍙', 'おにぎり'],
    ['🍣', 'おすし'],
    ['🍡', 'おだんご'],
    ['🍱', 'おべんとう'],
    ['🍚', 'ごはん'],
    ['🍵', 'おちゃ'],
  ],
  animal: [
    ['🐶', 'いぬ'],
    ['🐱', 'ねこ'],
    ['🐰', 'うさぎ'],
    ['🐷', 'ぶた'],
    ['🐮', 'うし'],
    ['🐴', 'うま'],
    ['🐵', 'さる'],
    ['🐘', 'ぞう'],
  ],
  creature: [
    ['🐔', 'にわとり'],
    ['🐟', 'さかな'],
    ['🐢', 'かめ'],
    ['🐸', 'かえる'],
    ['🦋', 'ちょう'],
    ['🐝', 'はち'],
    ['🐌', 'かたつむり'],
  ],
  vehicle: [
    ['🚗', 'くるま'],
    ['🚲', 'じてんしゃ'],
    ['🚃', 'でんしゃ'],
    ['🚢', 'ふね'],
    ['✈️', 'ひこうき'],
  ],
  tool: [
    ['✂️', 'はさみ'],
    ['🔨', 'かなづち'],
    ['🔑', 'かぎ'],
    ['✏️', 'えんぴつ'],
    ['📏', 'じょうぎ'],
    ['🌂', 'かさ'],
  ],
  home: [
    ['⏰', 'とけい'],
    ['☎️', 'でんわ'],
    ['💡', 'でんきゅう'],
    ['🔔', 'すず'],
    ['🛁', 'おふろ'],
  ],
  wear: [
    ['👘', 'きもの'],
    ['👟', 'くつ'],
    ['👒', 'ぼうし'],
    ['👜', 'かばん'],
    ['👛', 'さいふ'],
    ['👓', 'めがね'],
    ['💍', 'ゆびわ'],
  ],
  sky: [
    ['☀️', 'たいよう'],
    ['🌙', 'つき'],
    ['⭐', 'ほし'],
    ['🌈', 'にじ'],
    ['☁️', 'くも'],
    ['⛄', 'ゆきだるま'],
    ['⚡', 'かみなり'],
  ],
  plant: [
    ['🌸', 'さくら'],
    ['🌻', 'ひまわり'],
    ['🌹', 'ばら'],
    ['🍁', 'もみじ'],
    ['🌵', 'さぼてん'],
    ['🌲', 'き'],
  ],
}

export const PICTURES: readonly Picture[] = (Object.keys(RAW) as CategoryId[]).flatMap((category) =>
  RAW[category].map(([emoji, name]) => ({ emoji, name, category })),
)

export const CATEGORIES = Object.keys(RAW) as CategoryId[]

export interface LevelConfig {
  /** 覚える枚数 */
  count: number
  /** 覚えてから答えるまでの待ち時間(秒)。0 ならすぐ回答 */
  delaySec: number
  /** まちがいの絵を、覚えた絵と同じ仲間から選ぶ */
  similar: boolean
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { count: 3, delaySec: 0, similar: false },
  2: { count: 4, delaySec: 0, similar: false },
  3: { count: 5, delaySec: 10, similar: false },
  4: { count: 6, delaySec: 20, similar: false },
  5: { count: 8, delaySec: 30, similar: true },
}

export const PRACTICE_LEVEL: LevelConfig = { count: 3, delaySec: 0, similar: false }

export const ROUNDS: Record<PlayMode, number> = { main: 3, practice: 1 }

/** 1枚あたりの提示時間 */
export const STUDY_MS_PER_CARD = 2500

export function levelConfig(difficulty: Difficulty, mode: PlayMode): LevelConfig {
  return mode === 'practice' ? PRACTICE_LEVEL : LEVELS[difficulty]
}

export function studyMs(cfg: LevelConfig): number {
  return STUDY_MS_PER_CARD * cfg.count
}

export interface Round {
  /** 覚える絵 */
  targets: Picture[]
  /** 回答画面に並べる絵(覚えた絵+同じ数のまちがいの絵、順番はまぜてある) */
  choices: Picture[]
}

/**
 * 1回分の問題を作る。
 * - similar: 仲間を count/2 種類えらび、それぞれから 覚える絵2枚・まちがいの絵2枚 を取る
 * - それ以外: 覚える絵は仲間が重ならないように選び、まちがいの絵は別の仲間から選ぶ
 */
export function buildRound(cfg: LevelConfig, rng: Rng = defaultRng): Round {
  const n = cfg.count
  let targets: Picture[]
  let distractors: Picture[]

  if (cfg.similar) {
    const perCat = 2
    const catCount = Math.ceil(n / perCat)
    const cats = sample(CATEGORIES, catCount, rng)
    targets = []
    distractors = []
    cats.forEach((c, i) => {
      const take = Math.min(perCat, n - i * perCat)
      const items = sample(byCategory(c), take * 2, rng)
      targets.push(...items.slice(0, take))
      distractors.push(...items.slice(take))
    })
  } else {
    const cats = sample(CATEGORIES, n, rng)
    targets = cats.map((c) => sample(byCategory(c), 1, rng)[0])
    const used = new Set(cats)
    const others = PICTURES.filter((p) => !used.has(p.category))
    distractors = sample(others, n, rng)
    if (distractors.length < n) {
      // 仲間が足りないとき(通常は起きない)は残りから補う
      const rest = PICTURES.filter((p) => !targets.includes(p) && !distractors.includes(p))
      distractors.push(...sample(rest, n - distractors.length, rng))
    }
  }

  return { targets, choices: shuffle([...targets, ...distractors], rng) }
}

function byCategory(c: CategoryId): Picture[] {
  return PICTURES.filter((p) => p.category === c)
}

export interface RoundScore {
  /** 覚えた絵をえらべた数 */
  hits: number
  /** 覚えた絵をえらばなかった数 */
  misses: number
  /** 覚えていない絵をえらんだ数 */
  falseAlarms: number
  total: number
}

export function scoreRound(round: Round, selected: ReadonlySet<string>): RoundScore {
  const targetNames = new Set(round.targets.map((t) => t.name))
  let hits = 0
  let falseAlarms = 0
  for (const name of selected) {
    if (targetNames.has(name)) hits++
    else falseAlarms++
  }
  return { hits, misses: round.targets.length - hits, falseAlarms, total: round.targets.length }
}

/**
 * 結果画面の判定: 全部えらべてまちがいなし=○、
 * えらべたのが半分以下 または まちがいの方が多い(当てずっぽう)=×、それ以外=△
 */
export function roundMark(s: RoundScore): 'correct' | 'partial' | 'wrong' {
  if (s.hits === s.total && s.falseAlarms === 0) return 'correct'
  if (s.hits <= s.total / 2 || s.falseAlarms >= s.hits) return 'wrong'
  return 'partial'
}

/**
 * n 枚のカードを w×h の領域に並べるとき、カードがいちばん大きくなる列数を選ぶ。
 * カードの高さは幅 × ratio。
 */
export function fitGrid(
  n: number,
  w: number,
  h: number,
  gap: number,
  ratio: number,
  maxCard = Infinity,
): { cols: number; rows: number; card: number } {
  let best = { cols: 1, rows: n, card: 0 }
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols)
    const byW = (w - gap * (cols - 1)) / cols
    const byH = (h - gap * (rows - 1)) / rows / ratio
    const card = Math.min(byW, byH, maxCard)
    if (card > best.card + 0.5) best = { cols, rows, card }
  }
  return { ...best, card: Math.max(0, Math.floor(best.card)) }
}
