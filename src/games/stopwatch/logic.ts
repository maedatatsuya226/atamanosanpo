import type { Difficulty, PlayMode } from '../../core/types'

export interface LevelConfig {
  /** 目標の秒数 */
  targetSec: number
  /**
   * 表示が「？」に変わる時刻(秒)。
   * null = ずっと表示 / 0 = はじめから表示なし
   */
  hideAfterSec: number | null
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { targetSec: 5, hideAfterSec: null },
  2: { targetSec: 5, hideAfterSec: 2 },
  3: { targetSec: 10, hideAfterSec: 3 },
  4: { targetSec: 10, hideAfterSec: 0 },
  5: { targetSec: 15, hideAfterSec: 0 },
}

export const TRIALS: Record<PlayMode, number> = { main: 5, practice: 2 }

/** 成功とみなすずれの幅(秒): 目標の±10%、ただし最低±0.5秒 */
export function toleranceSec(targetSec: number): number {
  return Math.max(0.5, targetSec * 0.1)
}

/** 表示と判定をそろえるため、0.1秒単位に丸める */
export function roundTenth(sec: number): number {
  return Math.round(sec * 10) / 10
}

/** 浮動小数の誤差(5.5 - 5 = 0.5000001 など)で境界がずれないようにする */
const EPS = 1e-6

export function isWithinTolerance(actualSec: number, targetSec: number): boolean {
  return Math.abs(actualSec - targetSec) <= toleranceSec(targetSec) + EPS
}

/** 経過 elapsedSec の時点で、数字を表示するか */
export function isDisplayVisible(cfg: LevelConfig, elapsedSec: number): boolean {
  if (cfg.hideAfterSec === null) return true
  return elapsedSec < cfg.hideAfterSec
}

export interface ErrorSummary {
  /** ずれの平均(符号つき。+ = おそい / - = はやい) */
  meanSigned: number
  /** ずれの大きさの平均 */
  meanAbs: number
}

/** 符号つきのずれ(実際 - 目標)の一覧から平均を出す */
export function summarizeErrors(signedErrors: readonly number[]): ErrorSummary | null {
  if (signedErrors.length === 0) return null
  const n = signedErrors.length
  return {
    meanSigned: signedErrors.reduce((a, b) => a + b, 0) / n,
    meanAbs: signedErrors.reduce((a, b) => a + Math.abs(b), 0) / n,
  }
}

export type Tendency = 'はやめ' | 'おそめ' | 'ばらつき' | 'かたよりなし'

/**
 * 傾向の判定。
 * - 平均のずれ(符号つき)が許容幅の半分以上で、かつ平均の大きさの半分以上 → はやめ / おそめ
 *   (はやい・おそいが混ざって打ち消し合う場合は方向の傾向とはしない)
 * - それ以外で、ずれの大きさの平均が許容幅を超える → ばらつき
 * - それ以外 → かたよりなし
 */
export function classifyTendency(signedErrors: readonly number[], targetSec: number): Tendency {
  const s = summarizeErrors(signedErrors)
  if (!s) return 'かたよりなし'
  const tol = toleranceSec(targetSec)
  const bias = Math.abs(s.meanSigned)
  if (bias >= tol / 2 - EPS && bias >= s.meanAbs / 2 - EPS) return s.meanSigned < 0 ? 'はやめ' : 'おそめ'
  if (s.meanAbs > tol + EPS) return 'ばらつき'
  return 'かたよりなし'
}

/** 例: +0.4 / -0.3 / ±0.0 */
export function formatSigned(sec: number): string {
  const r = roundTenth(sec)
  if (Math.abs(r) < EPS) return '±0.0'
  return `${r > 0 ? '+' : '-'}${Math.abs(r).toFixed(1)}`
}

/** 患者さん向けのずれの言い方。例: 「0.4びょう おそい」 */
export function describeDiff(actualSec: number, targetSec: number): string {
  const d = roundTenth(actualSec - targetSec)
  if (Math.abs(d) < EPS) return 'ぴったり'
  return `${Math.abs(d).toFixed(1)}びょう ${d > 0 ? 'おそい' : 'はやい'}`
}
