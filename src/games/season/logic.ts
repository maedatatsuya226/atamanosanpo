import { defaultRng, randInt, sample, shuffle, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

/**
 * 季節・行事あて
 * 季節のものや行事の絵を見て、「どの季節か」「何月の行事か」を答える。
 * 季節の感覚と、行事を手がかりにした時期の見当識を使う。
 * レベル2以上は、最後に「いまの季節は？」を端末の日付で出題する(きょうの日付と同じく端末の時計を正解に使う)。
 * 地域で時期がずれやすいもの(桜・紅葉など)は季節の問題だけに使い、月の問題には使わない。
 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter']

export const SEASON_NAME: Record<Season, string> = {
  spring: 'はる',
  summer: 'なつ',
  autumn: 'あき',
  winter: 'ふゆ',
}

export interface Thing {
  e: string
  name: string
  season: Season
  /** はっきり決まっている月(行事)。決まっていないものは null */
  month: number | null
}

export const THINGS: readonly Thing[] = [
  { e: '🌸', name: 'さくら', season: 'spring', month: null },
  { e: '🎎', name: 'ひなまつり', season: 'spring', month: 3 },
  { e: '🎒', name: 'にゅうがくしき', season: 'spring', month: 4 },
  { e: '🎏', name: 'こいのぼり(こどもの ひ)', season: 'spring', month: 5 },
  { e: '🌷', name: 'チューリップ', season: 'spring', month: null },
  { e: '☔', name: 'つゆ(あめの きせつ)', season: 'summer', month: 6 },
  { e: '🎋', name: 'たなばた', season: 'summer', month: 7 },
  { e: '🏮', name: 'おぼん', season: 'summer', month: 8 },
  { e: '🎆', name: 'はなび', season: 'summer', month: null },
  { e: '🍉', name: 'すいか', season: 'summer', month: null },
  { e: '🌻', name: 'ひまわり', season: 'summer', month: null },
  { e: '🎑', name: 'おつきみ', season: 'autumn', month: 9 },
  { e: '👘', name: 'しちごさん', season: 'autumn', month: 11 },
  { e: '🍁', name: 'もみじ', season: 'autumn', month: null },
  { e: '🌰', name: 'くり', season: 'autumn', month: null },
  { e: '🌾', name: 'いねかり', season: 'autumn', month: null },
  { e: '🎄', name: 'クリスマス', season: 'winter', month: 12 },
  { e: '🎍', name: 'おしょうがつ', season: 'winter', month: 1 },
  { e: '👹', name: 'せつぶん(まめまき)', season: 'winter', month: 2 },
  { e: '⛄', name: 'ゆきだるま', season: 'winter', month: null },
]

export interface LevelConfig {
  kind: 'season' | 'month'
  /** 選択肢の数(季節は 2 か 4、月は 4 か 12) */
  choices: number
  /** 絵の下に名前を出す */
  showName: boolean
  /** 最後に「いまの季節は？」を出す */
  askNow: boolean
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { kind: 'season', choices: 2, showName: true, askNow: false },
  2: { kind: 'season', choices: 4, showName: true, askNow: true },
  3: { kind: 'season', choices: 4, showName: false, askNow: true },
  4: { kind: 'month', choices: 4, showName: true, askNow: true },
  5: { kind: 'month', choices: 12, showName: true, askNow: true },
}

/** 絵の問題の数(「いまの季節は？」は別に1問) */
export const QUESTIONS: Record<PlayMode, number> = { main: 6, practice: 2 }

export type Question =
  | { kind: 'season'; thing: Thing; choices: Season[] }
  | { kind: 'month'; thing: Thing; choices: number[] }
  | { kind: 'now'; choices: Season[] }

/** 月から季節(3〜5月=はる、6〜8月=なつ、9〜11月=あき、12〜2月=ふゆ) */
export function seasonOfMonth(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

function seasonChoices(answer: Season, n: number, rng: Rng): Season[] {
  if (n >= 4) return [...SEASONS]
  // 2択は、答えと反対の季節を組み合わせて見分けやすくする
  const opposite: Record<Season, Season> = { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' }
  return shuffle([answer, opposite[answer]], rng)
}

function monthChoices(answer: number, n: number, rng: Rng): number[] {
  if (n >= 12) return Array.from({ length: 12 }, (_, i) => i + 1)
  const others = sample(
    Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => m !== answer),
    n - 1,
    rng,
  )
  return [answer, ...others].sort((a, b) => a - b)
}

export function buildQuestions(level: Difficulty, mode: PlayMode, rng: Rng = defaultRng): Question[] {
  const cfg = LEVELS[level]
  const count = QUESTIONS[mode]
  const out: Question[] = []
  if (cfg.kind === 'season') {
    // 季節がかたよらないよう、季節を順にめぐらせて選ぶ
    const bySeason = SEASONS.map((s) => shuffle(THINGS.filter((t) => t.season === s), rng))
    const order = shuffle([...SEASONS.keys()], rng)
    for (let i = 0; out.length < count; i++) {
      const pool = bySeason[order[i % 4]]
      const thing = pool[Math.floor(i / 4)]
      if (!thing) continue
      out.push({ kind: 'season', thing, choices: seasonChoices(thing.season, cfg.choices, rng) })
    }
  } else {
    const events = sample(
      THINGS.filter((t) => t.month !== null),
      count,
      rng,
    )
    for (const thing of events) out.push({ kind: 'month', thing, choices: monthChoices(thing.month!, cfg.choices, rng) })
  }
  const shuffled = shuffle(out, rng)
  if (cfg.askNow && mode === 'main') shuffled.push({ kind: 'now', choices: [...SEASONS] })
  return shuffled
}

/** 正解(「いまの季節」は端末の日付から) */
export function answerOf(q: Question, today: Date): Season | number {
  if (q.kind === 'season') return q.thing.season
  if (q.kind === 'month') return q.thing.month!
  return seasonOfMonth(today.getMonth() + 1)
}

/** ヒント: まちがいの選択肢をひとつ消す(残っている中からランダムに) */
export function choiceToRemove<T>(choices: readonly T[], answer: T, removed: readonly T[], rng: Rng = defaultRng): T | null {
  const wrong = choices.filter((c) => c !== answer && !removed.includes(c))
  // 最後の2つ(答えとまちがい1つ)になったら、それ以上は消さない
  if (wrong.length <= 1 && choices.length - removed.length <= 2) return null
  if (wrong.length === 0) return null
  return wrong[randInt(0, wrong.length - 1, rng)]
}
