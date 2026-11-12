import { useEffect } from 'react'
import { DomainBadge } from '../components/DomainBadge'
import { useSound } from '../core/sound'
import { formatDuration } from '../core/stopwatch'
import type { Difficulty, GameDef, GameOutcome, PlayMode } from '../core/types'

interface Props {
  game: GameDef
  difficulty: Difficulty
  mode: PlayMode
  outcome: GameOutcome
  elapsedMs: number
  onRetry: () => void
  onStartMain: () => void
  onChangeDifficulty: () => void
  onNextPerson: () => void
}

const MARKS = {
  correct: { symbol: '○', label: '正解' },
  partial: { symbol: '△', label: 'やり直しで正解' },
  wrong: { symbol: '×', label: '誤り' },
} as const

/** 結果は画面に出すだけで保存しない。OTがカルテに転記する。 */
export function ResultScreen(props: Props) {
  const { game, difficulty, mode, outcome, elapsedMs } = props
  const sound = useSound()

  useEffect(() => {
    sound('done')
  }, [sound])

  const stats = [
    { label: '正答', value: `${outcome.correct} / ${outcome.total}` },
    { label: '誤答', value: `${outcome.errors}回` },
    { label: '所要時間', value: formatDuration(elapsedMs) },
    ...(outcome.extra ?? []),
  ]

  return (
    <div className="screen result">
      <header className="topbar">
        <div className="topbar-title">
          <DomainBadge domain={game.domain} />
          <h1>
            {game.title} の結果
          </h1>
          {mode === 'practice' && <span className="badge-practice">練習</span>}
          <span className="badge-level">レベル{difficulty}</span>
        </div>
      </header>

      <main className="result-body">
        <div className="stat-row">
          {stats.map((s) => (
            <div key={s.label} className="stat">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {outcome.details && outcome.details.length > 0 && (
          <table className="detail-table">
            <tbody>
              {outcome.details.map((row, i) => (
                <tr key={i}>
                  <th scope="row">{row.label}</th>
                  <td>{row.value}</td>
                  <td className={`detail-mark mark-${row.mark ?? 'none'}`} aria-label={row.mark ? MARKS[row.mark].label : ''}>
                    {row.mark ? MARKS[row.mark].symbol : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="result-note">この結果は保存されません。必要な値はカルテに転記してください。</p>

        <div className="result-actions">
          {mode === 'practice' ? (
            <button type="button" className="btn btn-primary btn-lg" onClick={props.onStartMain}>
              本番をはじめる
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-lg" onClick={props.onRetry}>
              もう一度
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-lg" onClick={props.onChangeDifficulty}>
            難易度を変える
          </button>
          <button type="button" className="btn btn-ghost btn-lg" onClick={props.onNextPerson}>
            終了して次の方へ
          </button>
        </div>
      </main>
    </div>
  )
}
