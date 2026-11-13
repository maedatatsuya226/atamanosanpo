import { defaultRng, randInt, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

/**
 * 時計あわせ
 * 「3じ 30ぷん」のように言われた時刻に、アナログ時計の針をボタンで動かして合わせる。
 * 長い針を進めると、本物の時計と同じように短い針も少しずつ動く。
 * レベル5は「いま 2じ 10ぷんです。40ぷん あとは？」のように、時間の足し算をして合わせる。
 * 時刻は 12時間で表す(午前・午後は区別しない)。内部では 0〜719 分で持つ。
 */
export interface LevelConfig {
  /** 長い針を1回で動かす分(0 = 長い針は動かさず、ちょうどの時刻だけ) */
  minuteStep: 0 | 5 | 15 | 30
  /** 「〜ぷん あとは？」の問題 */
  after: boolean
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { minuteStep: 0, after: false },
  2: { minuteStep: 30, after: false },
  3: { minuteStep: 15, after: false },
  4: { minuteStep: 5, after: false },
  5: { minuteStep: 5, after: true },
}

export const PROBLEMS: Record<PlayMode, number> = { main: 5, practice: 2 }

/** 「〜ぷん あと」に使う長さ */
const AFTER_MINUTES = [15, 20, 30, 40, 45, 50, 60, 90] as const

export const DAY = 12 * 60

export interface ClockProblem {
  /** 合わせる時刻(分) */
  target: number
  /** 針の最初の位置(分)。「あと」の問題では「いま」の時刻 */
  start: number
  /** 「〜ぷん あと」の分(ふつうの問題は null) */
  after: number | null
}

export function wrap(minutes: number): number {
  return ((minutes % DAY) + DAY) % DAY
}

/** 分 → 時(1〜12)と分 */
export function toHM(minutes: number): { h: number; m: number } {
  const t = wrap(minutes)
  const h = Math.floor(t / 60)
  return { h: h === 0 ? 12 : h, m: t % 60 }
}

/** 「3じ」「3じ 30ぷん」「3じ 15ふん」 */
export function speak(minutes: number): string {
  const { h, m } = toHM(minutes)
  if (m === 0) return `${h}じ`
  return `${h}じ ${m}${m % 10 === 0 ? 'ぷん' : 'ふん'}`
}

/** 「40ぷん」「1じかん」「1じかん 30ぷん」 */
export function speakDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const mm = m === 0 ? '' : `${m}${m % 10 === 0 ? 'ぷん' : 'ふん'}`
  if (h === 0) return mm
  return m === 0 ? `${h}じかん` : `${h}じかん ${mm}`
}

/** 針の角度(12時の向きから時計回り、度) */
export function handAngles(minutes: number): { hour: number; minute: number } {
  const t = wrap(minutes)
  return { hour: (t / 60) * 30, minute: (t % 60) * 6 }
}

function randomOnGrid(step: number, rng: Rng): number {
  const unit = step === 0 ? 60 : step
  return randInt(0, DAY / unit - 1, rng) * unit
}

export function buildProblems(level: Difficulty, mode: PlayMode, rng: Rng = defaultRng): ClockProblem[] {
  const cfg = LEVELS[level]
  const out: ClockProblem[] = []
  for (let guard = 0; out.length < PROBLEMS[mode] && guard < 500; guard++) {
    let p: ClockProblem
    if (cfg.after) {
      const now = randomOnGrid(cfg.minuteStep, rng)
      const after = AFTER_MINUTES[randInt(0, AFTER_MINUTES.length - 1, rng)]
      p = { target: wrap(now + after), start: now, after }
    } else {
      // 最初の針は 12じ からにして、答えと同じにはしない
      const target = randomOnGrid(cfg.minuteStep, rng)
      if (target === 0) continue
      p = { target, start: 0, after: null }
    }
    if (out.some((q) => q.target === p.target)) continue
    out.push(p)
  }
  return out
}

export type ClockHint = { hand: 'hour' | 'minute' }

/** ヒント: どちらの針を動かせばよいか(長い針がずれていれば長い針、合っていれば短い針) */
export function clockHint(target: number, current: number): ClockHint | null {
  const a = toHM(target)
  const b = toHM(current)
  if (a.m !== b.m) return { hand: 'minute' }
  if (a.h !== b.h) return { hand: 'hour' }
  return null
}
