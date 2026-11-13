import { defaultRng, randInt, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

/**
 * お会計
 * 表示された金額ちょうどになるよう、お金(硬貨・お札)を選んでトレーに出し、「はらう」を押す。
 * 足りない・多すぎるときは知らせて、直してやり直せる。
 * レベル5は「なるべく少ない枚数で」払う(ちょうどでも枚数が多いとやり直し)。
 * お金は何枚でも出せる(財布の中身の制限はない)。
 */
export type Money = 1 | 5 | 10 | 50 | 100 | 500 | 1000

export const ALL_MONEY: readonly Money[] = [1, 5, 10, 50, 100, 500, 1000]

export interface LevelConfig {
  min: number
  max: number
  /** 金額のきざみ(10 なら 10円単位) */
  unit: number
  /** 使えるお金 */
  kinds: readonly Money[]
  /** いま出している合計を画面に出す */
  showTotal: boolean
  /** なるべく少ない枚数で払う */
  fewest: boolean
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { min: 20, max: 100, unit: 10, kinds: [10, 50, 100], showTotal: true, fewest: false },
  2: { min: 30, max: 300, unit: 1, kinds: [1, 5, 10, 50, 100], showTotal: true, fewest: false },
  3: { min: 150, max: 1000, unit: 1, kinds: [1, 5, 10, 50, 100, 500], showTotal: true, fewest: false },
  4: { min: 600, max: 3000, unit: 1, kinds: ALL_MONEY, showTotal: false, fewest: false },
  5: { min: 300, max: 3000, unit: 1, kinds: ALL_MONEY, showTotal: false, fewest: true },
}

export const PROBLEMS: Record<PlayMode, number> = { main: 5, practice: 2 }

export function total(tray: readonly Money[]): number {
  return tray.reduce((s, m) => s + m, 0)
}

/** price ちょうどを、使えるお金でいちばん少ない枚数で払う組み合わせ(大きいお金から順に) */
export function fewestCoins(price: number, kinds: readonly Money[]): Money[] {
  // 日本のお金(1・5・10・50・100・500・1000)は、大きい方から使えば最少になる
  const out: Money[] = []
  let rest = price
  for (const m of [...kinds].sort((a, b) => b - a)) {
    while (rest >= m) {
      out.push(m)
      rest -= m
    }
  }
  if (rest !== 0) throw new Error(`${price}円はこのお金では払えません`)
  return out
}

/** 金額を作る(きざみに合わせ、同じ金額が続かないように) */
export function buildPrices(cfg: LevelConfig, count: number, rng: Rng = defaultRng): number[] {
  const out: number[] = []
  for (let guard = 0; out.length < count && guard < 1000; guard++) {
    const p = randInt(Math.ceil(cfg.min / cfg.unit), Math.floor(cfg.max / cfg.unit), rng) * cfg.unit
    // お金1枚ちょうどの金額(100円など)は簡単すぎるので出さない
    if (cfg.kinds.includes(p as Money)) continue
    if (out.includes(p)) continue
    out.push(p)
  }
  return out
}

export function buildProblems(level: Difficulty, mode: PlayMode, rng: Rng = defaultRng): number[] {
  return buildPrices(LEVELS[level], PROBLEMS[mode], rng)
}

export type PayResult =
  | 'ok'
  /** 足りない */
  | 'short'
  /** 多すぎる */
  | 'over'
  /** ちょうどだが、もっと少ない枚数で払える(レベル5) */
  | 'not-fewest'

export function judge(price: number, tray: readonly Money[], cfg: Pick<LevelConfig, 'kinds' | 'fewest'>): PayResult {
  const sum = total(tray)
  if (sum < price) return 'short'
  if (sum > price) return 'over'
  if (cfg.fewest && tray.length > fewestCoins(price, cfg.kinds).length) return 'not-fewest'
  return 'ok'
}

export type PayHint =
  /** このお金を足す */
  | { kind: 'add'; money: Money }
  /** トレーからこのお金をもどす */
  | { kind: 'remove'; money: Money }
  /** ちょうどになっている */
  | { kind: 'done' }

/**
 * ヒント: 1枚ぶんだけ助ける。いちばん少ない枚数の組み合わせ(目標)に近づける1枚を示す。
 * - 目標より多く出ているお金があり、多すぎる(またはちょうどだが枚数が多い)ときは、それを戻す
 * - 足りないときは、目標に足りないお金のうち、残りの金額をこえない大きいものを足す
 *   (足せるものが無いときは、目標に無いお金を戻す)
 * どの1歩も目標との差を必ず1枚減らすので、ヒントどおりに進めば必ずちょうどになる。
 */
export function payHint(price: number, tray: readonly Money[], cfg: Pick<LevelConfig, 'kinds' | 'fewest'>): PayHint {
  const sum = total(tray)
  if (sum === price && (!cfg.fewest || tray.length === fewestCoins(price, cfg.kinds).length)) return { kind: 'done' }
  const best = fewestCoins(price, cfg.kinds)
  const count = (list: readonly Money[], m: Money) => list.filter((x) => x === m).length
  const big = [...ALL_MONEY].sort((a, b) => b - a)
  const extra = big.filter((m) => count(tray, m) > count(best, m))
  const missing = big.filter((m) => count(best, m) > count(tray, m))
  if (sum < price) {
    const add = missing.find((m) => m <= price - sum)
    if (add !== undefined) return { kind: 'add', money: add }
  }
  if (extra.length > 0) return { kind: 'remove', money: extra[0] }
  // ここに来るのは、目標より少ない枚数しか出ていない(足りない)ときだけ
  return { kind: 'add', money: missing[missing.length - 1] }
}

/** 金額の表示(3桁ごとにカンマ) */
export function yen(n: number): string {
  return n.toLocaleString('ja-JP')
}
