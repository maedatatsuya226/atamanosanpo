import type { ComponentType, LazyExoticComponent } from 'react'

export type Difficulty = 1 | 2 | 3 | 4 | 5
export const DIFFICULTIES: readonly Difficulty[] = [1, 2, 3, 4, 5]

export type DomainId = 'spatial' | 'orientation' | 'memory' | 'planning' | 'attention'

/** practice = 練習(短く・結果は参考), main = 本番 */
export type PlayMode = 'practice' | 'main'

export interface Metric {
  label: string
  value: string
}

/** 結果画面の明細1行。mark: correct=○ / partial=△(やり直しで正解など) / wrong=× / null=判定なし */
export interface DetailRow {
  label: string
  value: string
  mark: 'correct' | 'partial' | 'wrong' | null
}

/** 各課題が終了時に返す結果。所要時間は共通側(PlayScreen)で計測して付け足す。 */
export interface GameOutcome {
  /** 正答数(課題ごとに定義。例: 1回目で正解した問題数) */
  correct: number
  /** 問題数・試行数 */
  total: number
  /** 誤答(誤タップ)の回数 */
  errors: number
  /** 課題固有の指標(左右別の見落とし数など) */
  extra?: Metric[]
  /** 問題ごとの明細 */
  details?: DetailRow[]
}

export interface GameProps {
  difficulty: Difficulty
  mode: PlayMode
  /** 一時停止中。時間で進む課題はこの間タイマーを止めること */
  paused: boolean
  onFinish: (outcome: GameOutcome) => void
}

export interface GameDef {
  id: string
  domain: DomainId
  /** OT向けの課題名 */
  title: string
  /** OT向けの一行説明(ホームのカードに出す) */
  summary: string
  /** OT向けの詳しい説明(準備画面に出す。ねらい・記録する指標・注意点など) */
  description?: string
  /** 患者さん向けの「やりかた」(1行ずつ表示) */
  howTo: string[]
  /** 難易度1〜5の説明(OT向け) */
  levels: readonly [string, string, string, string, string]
  supportsPractice: boolean
  /** 未実装の課題は undefined(ホームで「準備中」表示) */
  component?: LazyExoticComponent<ComponentType<GameProps>>
  /** 課題の画面を前もって読み込む(準備画面を開いたときに呼ぶ) */
  preload?: () => void
}
