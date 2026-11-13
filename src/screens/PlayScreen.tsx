import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { GameLoadBoundary } from '../components/GameLoadBoundary'
import { unlockAudio } from '../core/sound'
import { Stopwatch } from '../core/stopwatch'
import type { Difficulty, GameDef, GameOutcome, PlayMode } from '../core/types'
import { useWakeLock } from '../core/useWakeLock'

interface Props {
  game: GameDef
  difficulty: Difficulty
  mode: PlayMode
  onFinish: (outcome: GameOutcome, elapsedMs: number) => void
  onRestart: () => void
  onQuit: () => void
}

/** 課題と同じ Suspense の中に置き、課題が実際に画面に出たときに知らせる */
function OnShown({ onShown }: { onShown: () => void }) {
  useEffect(() => {
    onShown()
  }, [onShown])
  return null
}

/**
 * 課題の実施画面。やりかた表示 → 課題 の順に進む。
 * 一時停止中は課題を隠し、所要時間の計測も止める。
 * 所要時間は課題が画面に出てから測る(読み込みにかかった時間は含めない)。
 */
export function PlayScreen({ game, difficulty, mode, onFinish, onRestart, onQuit }: Props) {
  const [phase, setPhase] = useState<'intro' | 'playing'>('intro')
  const [paused, setPaused] = useState(false)
  const [shown, setShown] = useState(false)
  const stopwatch = useRef(new Stopwatch())
  const Game = game.component

  useWakeLock(true)

  // 課題が表示されていて、一時停止していない間だけ時間を測る
  useEffect(() => {
    if (phase === 'playing' && shown && !paused) stopwatch.current.start()
    else stopwatch.current.pause()
  }, [phase, shown, paused])

  const handleShown = useCallback(() => setShown(true), [])

  const pause = useCallback(() => {
    stopwatch.current.pause()
    setPaused(true)
  }, [])

  const resume = () => {
    setPaused(false)
  }

  // 別アプリに切り替えたり画面を閉じたら自動で一時停止
  useEffect(() => {
    if (phase !== 'playing') return
    const onHide = () => {
      if (document.visibilityState === 'hidden') pause()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [phase, pause])

  const start = () => {
    unlockAudio()
    setPhase('playing')
  }

  const handleFinish = useCallback(
    (outcome: GameOutcome) => {
      stopwatch.current.pause()
      onFinish(outcome, stopwatch.current.elapsedMs())
    },
    [onFinish],
  )

  if (!Game) return null

  return (
    <div className="screen play">
      <header className="topbar topbar-compact">
        <div className="topbar-title">
          <h1>{game.title}</h1>
          {mode === 'practice' && <span className="badge-practice">練習</span>}
          <span className="badge-level">レベル{difficulty}</span>
        </div>
        {phase === 'playing' && (
          <button type="button" className="btn btn-ghost" onClick={pause}>
            一時停止
          </button>
        )}
      </header>

      {phase === 'intro' ? (
        <main className="intro">
          <h2 className="intro-heading">{mode === 'practice' ? 'れんしゅう' : 'やりかた'}</h2>
          <div className="intro-text">
            {game.howTo.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="intro-actions">
            <button type="button" className="btn btn-ghost btn-lg" onClick={onQuit}>
              もどる
            </button>
            <button type="button" className="btn btn-primary btn-xl" onClick={start}>
              はじめる
            </button>
          </div>
        </main>
      ) : (
        <main className={`play-area ${paused ? 'is-hidden' : ''}`} aria-hidden={paused}>
          <GameLoadBoundary onQuit={onQuit}>
            <Suspense fallback={<p className="loading">よみこみ中…</p>}>
              <OnShown onShown={handleShown} />
              <Game difficulty={difficulty} mode={mode} paused={paused} onFinish={handleFinish} />
            </Suspense>
          </GameLoadBoundary>
        </main>
      )}

      {paused && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <div className="dialog">
            <h2 id="pause-title">一時停止中</h2>
            <p className="dialog-note">時間の計測は止まっています。</p>
            <div className="dialog-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={resume}>
                つづける
              </button>
              <button type="button" className="btn btn-secondary btn-lg" onClick={onRestart}>
                最初からやり直す
              </button>
              <button type="button" className="btn btn-ghost btn-lg" onClick={onQuit}>
                やめる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
