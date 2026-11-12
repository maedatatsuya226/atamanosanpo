import type { ReactNode } from 'react'

export type FeedbackKind = 'correct' | 'wrong' | 'info' | null

/** 課題共通の「せいかい」「ちがいます」表示。高さを固定して画面がずれないようにする */
export function Feedback({ kind, children }: { kind: FeedbackKind; children?: ReactNode }) {
  return (
    <div className={`feedback feedback-${kind ?? 'none'}`} role="status" aria-live="polite">
      {kind ? children : null}
    </div>
  )
}

export function Progress({ current, total }: { current: number; total: number }) {
  return (
    <p className="progress-text">
      {current} / {total}
    </p>
  )
}
