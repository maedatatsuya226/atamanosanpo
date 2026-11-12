import { useState } from 'react'
import { Feedback, Progress } from '../../components/Feedback'
import { ShapeView } from '../../components/ShapeView'
import { average, usePausableTimeout, useTrialClock } from '../../core/hooks'
import { useSound } from '../../core/sound'
import { formatDuration } from '../../core/stopwatch'
import type { DetailRow, GameProps } from '../../core/types'
import { buildTrial, LEVELS, TRIALS } from './logic'
import './figure-match.css'

const MAX_ATTEMPTS = 3
const NEXT_DELAY_MS = 900

interface TrialRecord {
  tries: number
  solved: boolean
  /** 最初にタップするまでの時間 */
  firstResponseMs: number
}

export default function FigureMatchGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const cfg = LEVELS[difficulty]
  const total = TRIALS[mode]
  const [trials] = useState(() => Array.from({ length: total }, () => buildTrial(difficulty)))
  const [index, setIndex] = useState(0)
  const [records, setRecords] = useState<TrialRecord[]>([])
  const [wrong, setWrong] = useState<number[]>([])
  const [state, setState] = useState<'answering' | 'correct' | 'reveal'>('answering')
  const [firstMs, setFirstMs] = useState<number | null>(null)
  const clock = useTrialClock(paused)

  const trial = trials[index]
  const locked = state !== 'answering'

  const finish = (all: TrialRecord[]) => {
    const details: DetailRow[] = all.map((r, i) => ({
      label: `${i + 1}問目`,
      value: r.solved ? (r.tries === 1 ? '1回で正解' : `${r.tries}回目で正解`) : '正解できず',
      mark: !r.solved ? 'wrong' : r.tries === 1 ? 'correct' : 'partial',
    }))
    const avg = average(all.map((r) => r.firstResponseMs))
    onFinish({
      correct: all.filter((r) => r.solved && r.tries === 1).length,
      total: all.length,
      errors: all.reduce((n, r) => n + r.tries - (r.solved ? 1 : 0), 0),
      extra: avg === null ? [] : [{ label: '平均反応時間', value: formatDuration(avg) }],
      details,
    })
  }

  const goNext = () => {
    const tries = wrong.length + (state === 'correct' ? 1 : 0)
    const rec: TrialRecord = { tries, solved: state === 'correct', firstResponseMs: firstMs ?? clock.read() }
    const all = [...records, rec]
    if (index + 1 >= total) {
      finish(all)
      return
    }
    setRecords(all)
    setIndex(index + 1)
    setWrong([])
    setState('answering')
    setFirstMs(null)
    clock.restart()
  }

  usePausableTimeout(goNext, state === 'correct' ? NEXT_DELAY_MS : null, paused, index)

  const choose = (i: number) => {
    if (locked || wrong.includes(i)) return
    if (firstMs === null) setFirstMs(clock.read())
    if (trial.options[i].isAnswer) {
      sound('correct')
      setState('correct')
      return
    }
    sound('wrong')
    const w = [...wrong, i]
    setWrong(w)
    if (w.length >= MAX_ATTEMPTS) setState('reveal')
  }

  return (
    <div className="fm">
      <div className="fm-head">
        <Progress current={index + 1} total={total} />
        <p className="task-instruction">
          みほんと おなじ かたちを えらんで ください
          {cfg.rotate && <span className="fm-note">(まわして おなじなら せいかい)</span>}
        </p>
        <Feedback kind={state === 'correct' ? 'correct' : state === 'reveal' ? 'info' : wrong.length > 0 ? 'wrong' : null}>
          {state === 'correct' && 'せいかい！'}
          {state === 'reveal' && (
            <>
              みどりの わくが こたえです
              <button type="button" className="btn btn-primary" onClick={goNext}>
                つぎへ
              </button>
            </>
          )}
          {state === 'answering' && wrong.length > 0 && 'ちがいます。もういちど えらんで ください。'}
        </Feedback>
      </div>

      <div className="fm-body">
        <figure className="fm-sample">
          <figcaption>みほん</figcaption>
          <ShapeView shape={trial.sample} />
        </figure>

        <div className={`fm-options fm-options-${trial.options.length}`}>
          {trial.options.map((o, i) => {
            const isWrong = wrong.includes(i)
            const showAnswer = locked && o.isAnswer
            return (
              <button
                key={i}
                type="button"
                className={`fm-option ${isWrong ? 'is-wrong' : ''} ${showAnswer ? 'is-answer' : ''}`}
                onClick={() => choose(i)}
                disabled={locked || isWrong}
                aria-label={`せんたくし ${i + 1}`}
              >
                <ShapeView shape={o.shape} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
