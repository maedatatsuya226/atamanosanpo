import { useCallback } from 'react'
import type { GameProps } from '../../core/types'
import { gridLayout, layoutTargets, type Field } from '../number-order/logic'
import { SequenceTapBoard } from '../number-order/SequenceTapBoard'
import { labelsFor, lastLabel, LEVELS } from './logic'

export default function KanaOrderGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const cfg = LEVELS[difficulty]
  const makeLayout = useCallback(
    (field: Field) => {
      const labels = labelsFor(difficulty, mode)
      return cfg.scatter
        ? layoutTargets(labels, { count: labels.length, alternate: false, radius: cfg.radius, gap: 30, spread: 1 }, field)
        : gridLayout(labels, cfg.radius, field)
    },
    [difficulty, mode, cfg],
  )
  return (
    <SequenceTapBoard
      paused={paused}
      onFinish={onFinish}
      radius={cfg.radius}
      instruction={`「あ」から「${lastLabel(difficulty, mode)}」まで じゅんばんに タップ`}
      makeLayout={makeLayout}
    />
  )
}
