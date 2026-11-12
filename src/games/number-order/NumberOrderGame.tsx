import { useCallback } from 'react'
import type { GameProps } from '../../core/types'
import { labelsFor, layoutTargets, LEVELS, type Field } from './logic'
import { SequenceTapBoard } from './SequenceTapBoard'

export default function NumberOrderGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const cfg = LEVELS[difficulty]
  const makeLayout = useCallback(
    (field: Field) => layoutTargets(labelsFor(difficulty, mode), LEVELS[difficulty], field),
    [difficulty, mode],
  )
  return (
    <SequenceTapBoard
      paused={paused}
      onFinish={onFinish}
      radius={cfg.radius}
      instruction={cfg.alternate ? '1 → あ → 2 → い … の じゅんばんで タップ' : '1 から じゅんばんに タップ'}
      makeLayout={makeLayout}
    />
  )
}
