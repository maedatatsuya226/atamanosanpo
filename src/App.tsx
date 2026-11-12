import { useCallback, useState } from 'react'
import type { Difficulty, GameOutcome, PlayMode } from './core/types'
import { findGame } from './games/registry'
import { HomeScreen } from './screens/HomeScreen'
import { PlayScreen } from './screens/PlayScreen'
import { ResultScreen } from './screens/ResultScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SetupScreen } from './screens/SetupScreen'

type Screen =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'setup'; gameId: string }
  | { name: 'play'; gameId: string; mode: PlayMode; runKey: number }
  | { name: 'result'; gameId: string; mode: PlayMode; outcome: GameOutcome; elapsedMs: number }

/**
 * 画面遷移はメモリ上の状態だけで管理する(URLや端末に履歴を残さない)。
 * 「終了して次の方へ」で、選んだ難易度も含めてすべて初期化する。
 */
/** 開発時だけ ?game=<課題ID> でその課題の準備画面から始められる(本番ビルドでは無効) */
function initialScreen(): Screen {
  if (import.meta.env.DEV) {
    const id = new URLSearchParams(location.search).get('game')
    if (id) return { name: 'setup', gameId: id }
  }
  return { name: 'home' }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [difficulties, setDifficulties] = useState<Record<string, Difficulty>>({})
  const [runCounter, setRunCounter] = useState(0)

  const difficultyOf = (gameId: string): Difficulty => difficulties[gameId] ?? 1

  const play = (gameId: string, mode: PlayMode) => {
    setRunCounter((n) => n + 1)
    setScreen({ name: 'play', gameId, mode, runKey: runCounter + 1 })
  }

  const handleFinish = useCallback(
    (gameId: string, mode: PlayMode) => (outcome: GameOutcome, elapsedMs: number) =>
      setScreen({ name: 'result', gameId, mode, outcome, elapsedMs }),
    [],
  )

  const nextPerson = () => {
    setDifficulties({})
    setScreen({ name: 'home' })
  }

  switch (screen.name) {
    case 'home':
      return (
        <HomeScreen
          onSelectGame={(gameId) => setScreen({ name: 'setup', gameId })}
          onOpenSettings={() => setScreen({ name: 'settings' })}
        />
      )

    case 'settings':
      return <SettingsScreen onBack={() => setScreen({ name: 'home' })} />

    case 'setup': {
      const game = findGame(screen.gameId)
      return (
        <SetupScreen
          game={game}
          difficulty={difficultyOf(game.id)}
          onChangeDifficulty={(d) => setDifficulties((m) => ({ ...m, [game.id]: d }))}
          onStart={(mode) => play(game.id, mode)}
          onBack={() => setScreen({ name: 'home' })}
        />
      )
    }

    case 'play': {
      const game = findGame(screen.gameId)
      return (
        <PlayScreen
          key={screen.runKey}
          game={game}
          difficulty={difficultyOf(game.id)}
          mode={screen.mode}
          onFinish={handleFinish(game.id, screen.mode)}
          onRestart={() => play(game.id, screen.mode)}
          onQuit={() => setScreen({ name: 'setup', gameId: game.id })}
        />
      )
    }

    case 'result': {
      const game = findGame(screen.gameId)
      return (
        <ResultScreen
          game={game}
          difficulty={difficultyOf(game.id)}
          mode={screen.mode}
          outcome={screen.outcome}
          elapsedMs={screen.elapsedMs}
          onRetry={() => play(game.id, 'main')}
          onStartMain={() => play(game.id, 'main')}
          onChangeDifficulty={() => setScreen({ name: 'setup', gameId: game.id })}
          onNextPerson={nextPerson}
        />
      )
    }
  }
}
