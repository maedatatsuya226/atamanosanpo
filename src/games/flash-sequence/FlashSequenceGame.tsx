import { useEffect, useState } from 'react'
import { Feedback, Progress } from '../../components/Feedback'
import { useElementSize, usePausableTimeout } from '../../core/hooks'
import { useSound } from '../../core/sound'
import type { DetailRow, GameProps } from '../../core/types'
import { buildSequence, expectedOrder, LEVELS, showSteps, TILE_COUNT, TRIALS } from './logic'
import './flash-sequence.css'

const READY_MS = 1200
const RESULT_MS = 1600
const TAP_FLASH_MS = 250

type Phase = 'ready' | 'show' | 'input' | 'result'

interface TrialRecord {
  ok: boolean
  /** まちがえる前に正しく押せた数 */
  reached: number
}

export default function FlashSequenceGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const cfg = LEVELS[difficulty]
  const total = TRIALS[mode]
  const [sequences] = useState(() => Array.from({ length: total }, () => buildSequence(cfg.length)))
  const [trial, setTrial] = useState(0)
  const [phase, setPhase] = useState<Phase>('ready')
  const [step, setStep] = useState(0)
  const [inputPos, setInputPos] = useState(0)
  const [records, setRecords] = useState<TrialRecord[]>([])
  const [tap, setTap] = useState<{ tile: number; ok: boolean; n: number } | null>(null)
  const [stageRef, stage] = useElementSize<HTMLDivElement>()
  const boardPx = Math.max(0, Math.min(stage.width, stage.height))

  const sequence = sequences[trial]
  const order = expectedOrder(sequence, cfg.reverse)
  const steps = showSteps(sequence, cfg)
  const last = records[records.length - 1]

  // 見せている途中で一時停止したら、再開時に最初から見せ直す
  useEffect(() => {
    if (paused && (phase === 'ready' || phase === 'show')) {
      setPhase('ready')
      setStep(0)
    }
  }, [paused, phase])

  usePausableTimeout(
    () => {
      if (phase === 'ready') {
        setPhase('show')
        setStep(0)
      } else if (phase === 'show') {
        if (step + 1 < steps.length) setStep(step + 1)
        else setPhase('input')
      } else if (phase === 'result') {
        nextTrial()
      }
    },
    phase === 'ready' ? READY_MS : phase === 'show' ? steps[step].ms : phase === 'result' ? RESULT_MS : null,
    paused,
    `${trial}-${phase}-${step}`,
  )

  usePausableTimeout(() => setTap(null), tap ? TAP_FLASH_MS : null, false, tap?.n)

  const nextTrial = () => {
    if (trial + 1 >= total) {
      finish(records)
      return
    }
    setTrial(trial + 1)
    setPhase('ready')
    setStep(0)
    setInputPos(0)
  }

  const finish = (all: TrialRecord[]) => {
    const details: DetailRow[] = all.map((r, i) => ({
      label: `${i + 1}回目`,
      value: r.ok ? `${cfg.length}個とも正しく押せた` : `${r.reached + 1}個目でまちがい`,
      mark: r.ok ? 'correct' : 'wrong',
    }))
    const pressed = all.reduce((n, r) => n + (r.ok ? cfg.length : r.reached), 0)
    onFinish({
      correct: all.filter((r) => r.ok).length,
      total: all.length,
      errors: all.filter((r) => !r.ok).length,
      extra: [{ label: '正しく押せた個数', value: `${pressed} / ${cfg.length * all.length}` }],
      details,
    })
  }

  const press = (tile: number) => {
    if (phase !== 'input') return
    const ok = tile === order[inputPos]
    setTap({ tile, ok, n: (tap?.n ?? 0) + 1 })
    if (!ok) {
      sound('wrong')
      setRecords([...records, { ok: false, reached: inputPos }])
      setPhase('result')
      return
    }
    if (inputPos + 1 >= order.length) {
      sound('correct')
      setRecords([...records, { ok: true, reached: order.length }])
      setPhase('result')
    } else {
      sound('tap')
      setInputPos(inputPos + 1)
    }
  }

  const litTile = phase === 'show' ? steps[step].tile : null
  const showAnswer = phase === 'result' && last && !last.ok

  let instruction = 'よく みて ください'
  if (phase === 'input' || phase === 'result') {
    instruction = cfg.reverse ? 'ぎゃくの じゅんばんで タップ' : 'おなじ じゅんばんで タップ'
  }

  return (
    <div className="fs">
      <div className="fs-head">
        <Progress current={trial + 1} total={total} />
        <p className="task-instruction">{instruction}</p>
        <div className="fs-dots" aria-label={`${inputPos} / ${order.length}`}>
          {order.map((_, i) => (
            <span key={i} className={`fs-dot ${phase !== 'show' && phase !== 'ready' && i < inputPos ? 'is-on' : ''}`} />
          ))}
        </div>
        <Feedback kind={phase === 'result' ? (last?.ok ? 'correct' : 'wrong') : null}>
          {phase === 'result' && (last?.ok ? 'せいかい！' : 'ちがいました。すうじの じゅんばんが こたえです')}
        </Feedback>
      </div>

      <div className="fs-stage" ref={stageRef}>
      <div
        className={`fs-board ${phase === 'input' ? 'is-input' : ''}`}
        style={{ width: boardPx, height: boardPx }}
      >
        {Array.from({ length: TILE_COUNT }, (_, i) => {
          const isLit = litTile === i || (tap?.tile === i && tap.ok)
          const isWrong = tap?.tile === i && !tap.ok
          const answerNo = showAnswer ? order.indexOf(i) : -1
          return (
            <button
              key={i}
              type="button"
              className={`fs-tile ${isLit ? 'is-lit' : ''} ${isWrong ? 'is-wrong' : ''}`}
              onPointerDown={() => press(i)}
              disabled={phase !== 'input'}
              aria-label={`パネル ${i + 1}`}
            >
              {answerNo >= 0 && <span className="fs-answer-no">{answerNo + 1}</span>}
            </button>
          )
        })}
      </div>
      </div>
    </div>
  )
}
