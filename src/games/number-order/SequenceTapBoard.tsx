import { useEffect, useState } from 'react'
import { Feedback } from '../../components/Feedback'
import { average, useElementSize, usePausableTimeout, useTrialClock } from '../../core/hooks'
import { useSound } from '../../core/sound'
import { formatDuration } from '../../core/stopwatch'
import type { DetailRow, GameOutcome } from '../../core/types'
import { fieldFor, sideOf, type Field, type Target } from './logic'
import './number-order.css'

const FINISH_DELAY_MS = 700
const WRONG_FLASH_MS = 400
/** 結果画面に出すまちがいの件数の上限 */
const MAX_ERROR_ROWS = 8

interface Props {
  paused: boolean
  onFinish: (outcome: GameOutcome) => void
  /** 丸の半径(仮想画面の単位) */
  radius: number
  /** 画面上部の指示文 */
  instruction: string
  /** 画面の形(縦・横)が決まったら、押す順番に並んだ丸の配置を作る */
  makeLayout: (field: Field) => Target[]
}

/**
 * 「決められた順番に丸をタップする」課題の共通画面(数字順タップ・あいうえお順タップ)。
 * 結果には、左右それぞれの平均時間と、まちがえた内容を出す。
 */
export function SequenceTapBoard({ paused, onFinish, radius, instruction, makeLayout }: Props) {
  const sound = useSound()
  const [stageRef, stage] = useElementSize<HTMLDivElement>()
  // 配置は画面の向き(縦・横)がわかってから1回だけ作る
  const [layout, setLayout] = useState<{ field: Field; targets: Target[] } | null>(null)
  const [next, setNext] = useState(0)
  const [times, setTimes] = useState<number[]>([])
  const [mistakes, setMistakes] = useState<{ after: string; tapped: string }[]>([])
  const [wrong, setWrong] = useState<{ index: number; n: number } | null>(null)
  const clock = useTrialClock(paused)

  useEffect(() => {
    if (layout || stage.width === 0 || stage.height === 0) return
    const field = fieldFor(stage.width, stage.height)
    setLayout({ field, targets: makeLayout(field) })
    clock.restart()
  }, [layout, stage, makeLayout, clock])

  const targets = layout?.targets ?? []
  const done = layout !== null && next >= targets.length

  usePausableTimeout(
    () => {
      if (!layout) return
      const leftTimes = times.filter((_, i) => sideOf(targets[i], layout.field) === 'left')
      const rightTimes = times.filter((_, i) => sideOf(targets[i], layout.field) === 'right')
      const fmt = (v: number | null) => (v === null ? '—' : formatDuration(v))
      const details: DetailRow[] = mistakes.slice(0, MAX_ERROR_ROWS).map((m, i) => ({
        label: `まちがい${i + 1}`,
        value: `「${m.after}」のつぎに「${m.tapped}」をタップ`,
        mark: null,
      }))
      if (mistakes.length > MAX_ERROR_ROWS) {
        details.push({ label: '', value: `ほか ${mistakes.length - MAX_ERROR_ROWS}件`, mark: null })
      }
      onFinish({
        correct: targets.length,
        total: targets.length,
        errors: mistakes.length,
        extra: [
          { label: '左側の平均(1個あたり)', value: fmt(average(leftTimes)) },
          { label: '右側の平均(1個あたり)', value: fmt(average(rightTimes)) },
        ],
        details,
      })
    },
    done ? FINISH_DELAY_MS : null,
    paused,
  )

  usePausableTimeout(() => setWrong(null), wrong ? WRONG_FLASH_MS : null, false, wrong?.n)

  const press = (i: number) => {
    if (done || i < next) return
    if (i === next) {
      sound(next + 1 === targets.length ? 'correct' : 'tap')
      setTimes([...times, clock.read()])
      clock.restart()
      setNext(next + 1)
      return
    }
    sound('wrong')
    setMistakes([...mistakes, { after: next === 0 ? '(はじめ)' : targets[next - 1].label, tapped: targets[i].label }])
    setWrong({ index: i, n: (wrong?.n ?? 0) + 1 })
  }

  const r = radius
  const fontSize = r * 0.9
  const linePoints = targets
    .slice(0, next)
    .map((t) => `${t.x},${t.y}`)
    .join(' ')

  return (
    <div className="no">
      <div className="no-head">
        <p className="task-instruction no-instruction">{instruction}</p>
        <Feedback kind={done ? 'correct' : wrong ? 'wrong' : null}>
          {done ? 'おわり！' : wrong ? 'ちがいます' : null}
        </Feedback>
      </div>

      <div className="no-stage" ref={stageRef}>
        {layout && (
          <svg
            className="no-field"
            viewBox={`0 0 ${layout.field.width} ${layout.field.height}`}
            preserveAspectRatio="xMidYMid meet"
            role="group"
            aria-label="タップする まる"
          >
            <rect x={0} y={0} width={layout.field.width} height={layout.field.height} rx={18} className="no-bg" />
            {next > 1 && <polyline points={linePoints} className="no-line" />}
            {targets.map((t, i) => {
              const isDone = i < next
              const isWrong = wrong?.index === i
              return (
                <g
                  key={t.label}
                  className={`no-target ${isDone ? 'is-done' : ''} ${isWrong ? 'is-wrong' : ''}`}
                  onPointerDown={() => press(i)}
                >
                  {/* 指で押しやすいよう、見た目より少し広い当たり判定 */}
                  <circle cx={t.x} cy={t.y} r={r + 10} className="no-hit" />
                  <circle cx={t.x} cy={t.y} r={r} className="no-circle" />
                  <text x={t.x} y={t.y} dy="0.36em" textAnchor="middle" fontSize={fontSize} className="no-label">
                    {t.label}
                  </text>
                  {(i === 0 || i === targets.length - 1) && (
                    <text
                      x={t.x}
                      // 下の端に近い丸は、ラベルを丸の上に出す
                      y={t.y + r + 24 > layout.field.height ? t.y - r - 8 : t.y + r + 20}
                      textAnchor="middle"
                      fontSize={18}
                      className="no-tag"
                    >
                      {i === 0 ? 'はじめ' : 'おわり'}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        )}
      </div>
    </div>
  )
}
