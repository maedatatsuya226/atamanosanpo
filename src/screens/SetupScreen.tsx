import { useEffect } from 'react'
import { DomainBadge } from '../components/DomainBadge'
import { GameThumb } from '../components/GameThumb'
import { DIFFICULTIES, type Difficulty, type GameDef, type PlayMode } from '../core/types'

interface Props {
  game: GameDef
  difficulty: Difficulty
  onChangeDifficulty: (d: Difficulty) => void
  onStart: (mode: PlayMode) => void
  onBack: () => void
}

/** OT向けの準備画面。難易度を決めて開始する。 */
export function SetupScreen({ game, difficulty, onChangeDifficulty, onStart, onBack }: Props) {
  // 難易度を選んでいる間に課題の画面を読み込んでおき、「はじめる」ですぐ始められるようにする
  useEffect(() => {
    game.preload?.()
  }, [game])

  return (
    <div className="screen setup">
      <header className="topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ‹ もどる
        </button>
        <div className="topbar-title">
          <DomainBadge domain={game.domain} />
          <h1>{game.title}</h1>
        </div>
        <span />
      </header>

      <main className="setup-body">
        <div className="setup-intro">
          <div className="setup-thumb">
            <GameThumb id={game.id} />
          </div>
          <div className="setup-texts">
            <p className="setup-summary">{game.summary}</p>
            {game.description && <p className="setup-description">{game.description}</p>}
          </div>
        </div>

        <section aria-labelledby="lv-label">
          <h2 id="lv-label" className="section-label">
            難易度
          </h2>
          <div className="segmented" role="radiogroup" aria-labelledby="lv-label">
            {DIFFICULTIES.map((lv) => (
              <button
                key={lv}
                type="button"
                role="radio"
                aria-checked={lv === difficulty}
                className={`segment ${lv === difficulty ? 'is-selected' : ''}`}
                onClick={() => onChangeDifficulty(lv)}
              >
                {lv}
              </button>
            ))}
          </div>
          <p className="level-desc">
            <strong>レベル{difficulty}:</strong> {game.levels[difficulty - 1]}
          </p>
        </section>

        <div className="setup-actions">
          {game.supportsPractice && (
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => onStart('practice')}>
              練習する
            </button>
          )}
          <button type="button" className="btn btn-primary btn-lg" onClick={() => onStart('main')}>
            はじめる
          </button>
        </div>
      </main>
    </div>
  )
}
