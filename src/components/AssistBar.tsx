import { useState } from 'react'
import { useSettings } from '../core/settings'

interface Props {
  /** こたえを表示し終わって、次へ進むのを待っている */
  answered: boolean
  /** ヒントを出せない(ゴールした直後など) */
  disabled?: boolean
  onHint: () => void
  /** こたえを出せない課題では省く */
  onAnswer?: () => void
  onNext?: () => void
}

/**
 * パズル型の課題に出す「ヒント」「こたえを見る」ボタン。
 * 行き詰まったときに気づけるよう画面に出しておく。こたえは押し間違い・すぐ押してしまうのを防ぐため一度確かめる。
 * 設定で「ヒント・こたえボタン」をオフにすると出さない。
 */
export function AssistBar({ answered, disabled, onHint, onAnswer, onNext }: Props) {
  const { settings } = useSettings()
  const [confirming, setConfirming] = useState(false)

  if (answered) {
    return (
      <button type="button" className="btn btn-primary btn-lg assist-next" onClick={onNext}>
        つぎへ
      </button>
    )
  }
  if (!settings.assist) return null

  return (
    <div className="assist-bar">
      <button type="button" className="btn btn-secondary" onClick={onHint} disabled={disabled}>
        ヒント
      </button>
      {onAnswer && (
        <button type="button" className="btn btn-ghost" onClick={() => setConfirming(true)} disabled={disabled}>
          こたえを見る
        </button>
      )}

      {confirming && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="answer-title">
          <div className="dialog">
            <h2 id="answer-title">こたえを 見ますか？</h2>
            <p className="dialog-note">この問題は「こたえを見た」と結果に記録されます。</p>
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => {
                  setConfirming(false)
                  onAnswer?.()
                }}
              >
                こたえを 見る
              </button>
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => setConfirming(false)}>
                やめる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
