import { useState } from 'react'
import { AssistBar } from '../../components/AssistBar'
import { Feedback, Progress, type FeedbackKind } from '../../components/Feedback'
import { useElementSize, usePausableTimeout, useTrialClock } from '../../core/hooks'
import { useSound } from '../../core/sound'
import { formatDuration } from '../../core/stopwatch'
import type { DetailRow, GameProps } from '../../core/types'
import {
  buildProblems,
  clockHint,
  handAngles,
  LEVELS,
  speak,
  speakDuration,
  toHM,
  wrap,
  type ClockHint,
} from './logic'
import './clock.css'

const CLEAR_MS = 1400

interface ProblemRecord {
  target: number
  fails: number
  hints: number
  answered: boolean
  ms: number
}

type Phase = 'setting' | 'correct' | 'answered'

export default function ClockGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const cfg = LEVELS[difficulty]
  const [problems] = useState(() => buildProblems(difficulty, mode))
  const total = problems.length
  const [index, setIndex] = useState(0)
  const problem = problems[index]
  const [time, setTime] = useState(problems[0].start)
  const [phase, setPhase] = useState<Phase>('setting')
  const [wrong, setWrong] = useState(false)
  const [fails, setFails] = useState(0)
  const [hints, setHints] = useState(0)
  const [hint, setHint] = useState<ClockHint | null>(null)
  const [records, setRecords] = useState<ProblemRecord[]>([])
  const [clearMs, setClearMs] = useState(0)
  const clock = useTrialClock(paused)
  const [stageRef, stage] = useElementSize<HTMLDivElement>()

  const move = (delta: number) => {
    if (phase !== 'setting') return
    sound('tap')
    setTime((t) => wrap(t + delta))
    setWrong(false)
    setHint(null)
  }

  const check = () => {
    if (phase !== 'setting') return
    setHint(null)
    if (wrap(time) === problem.target) {
      sound('correct')
      setClearMs(clock.read())
      setPhase('correct')
    } else {
      sound('wrong')
      setFails((f) => f + 1)
      setWrong(true)
    }
  }

  /** この問題の記録を残して、次の問題へ(最後なら結果へ) */
  const goNext = (answered: boolean) => {
    const all = [...records, { target: problem.target, fails, hints, answered, ms: clearMs }]
    if (index + 1 >= total) {
      const details = all.map((r): DetailRow => {
        const parts = [`やりなおし${r.fails}回`]
        if (r.hints > 0) parts.push(`ヒント${r.hints}回`)
        if (r.answered) parts.push('こたえを見た')
        parts.push(formatDuration(r.ms))
        const clean = r.fails === 0 && r.hints === 0 && !r.answered
        const { h, m } = toHM(r.target)
        return { label: `${h}時${m === 0 ? '' : `${m}分`}`, value: parts.join('・'), mark: clean ? 'correct' : 'partial' }
      })
      onFinish({
        correct: details.filter((d) => d.mark === 'correct').length,
        total: all.length,
        errors: all.reduce((s, r) => s + r.fails, 0),
        extra: [
          { label: 'ヒントを使った回数', value: `${all.reduce((s, r) => s + r.hints, 0)}回` },
          { label: 'こたえを見た問題', value: `${all.filter((r) => r.answered).length}問` },
        ],
        details,
      })
      return
    }
    const next = problems[index + 1]
    setRecords(all)
    setIndex(index + 1)
    setTime(next.start)
    setWrong(false)
    setHint(null)
    setFails(0)
    setHints(0)
    setPhase('setting')
    clock.restart()
  }

  usePausableTimeout(() => goNext(false), phase === 'correct' ? CLEAR_MS : null, paused, index)

  const showHint = () => {
    if (phase !== 'setting') return
    sound('tap')
    setHints((h) => h + 1)
    setWrong(false)
    setHint(clockHint(problem.target, time))
  }

  const showAnswer = () => {
    if (phase !== 'setting') return
    setTime(problem.target)
    setWrong(false)
    setHint(null)
    setClearMs(clock.read())
    setPhase('answered')
  }

  let message: { text: string; kind: FeedbackKind }
  if (phase === 'correct') message = { text: 'せいかい！', kind: 'correct' }
  else if (phase === 'answered') message = { text: 'これが こたえです', kind: 'info' }
  else if (hint) message = { text: `${hint.hand === 'minute' ? 'ながい' : 'みじかい'} はりを うごかしましょう。うすい はりの ところです`, kind: 'info' }
  else if (wrong) message = { text: 'ちがいます。はりを なおして みましょう', kind: 'wrong' }
  else message = { text: 'あわせたら「これで よし」', kind: 'info' }

  const size = Math.max(0, Math.min(stage.width, stage.height))
  const now = handAngles(time)
  const goal = handAngles(problem.target)

  return (
    <div className="ck">
      <div className="ck-stage" ref={stageRef}>
        {size > 0 && (
          <svg className="ck-face" width={size} height={size} viewBox="-100 -100 200 200" role="img" aria-label={`いま ${speak(time)}`}>
            <circle r={96} className="ck-rim" />
            {Array.from({ length: 60 }, (_, i) => (
              <line
                key={i}
                className={i % 5 === 0 ? 'ck-tick is-major' : 'ck-tick'}
                y1={-90}
                y2={i % 5 === 0 ? -80 : -85}
                transform={`rotate(${i * 6})`}
              />
            ))}
            {Array.from({ length: 12 }, (_, i) => {
              const n = i + 1
              const a = (n * 30 * Math.PI) / 180
              return (
                <text key={n} className="ck-num" x={Math.sin(a) * 68} y={-Math.cos(a) * 68} dy="0.36em" textAnchor="middle">
                  {n}
                </text>
              )
            })}
            {/* ヒント: 合わせる位置にうすい針を出す */}
            {hint?.hand === 'hour' && <line className="ck-hand ck-hour is-ghost" y2={-48} transform={`rotate(${goal.hour})`} />}
            {hint?.hand === 'minute' && <line className="ck-hand ck-minute is-ghost" y2={-76} transform={`rotate(${goal.minute})`} />}
            <line className="ck-hand ck-hour" y2={-48} transform={`rotate(${now.hour})`} />
            <line className="ck-hand ck-minute" y2={-76} transform={`rotate(${now.minute})`} />
            <circle r={6} className="ck-pin" />
          </svg>
        )}
      </div>

      <aside className="ck-side">
        <Progress current={index + 1} total={total} />
        <div className="ck-question">
          {problem.after === null ? (
            <>
              <strong>{speak(problem.target)}</strong> に あわせて ください
            </>
          ) : (
            <>
              いま <strong>{speak(problem.start)}</strong> です。
              <br />
              <strong>{speakDuration(problem.after)}</strong> あとは？
            </>
          )}
        </div>

        <div className="ck-controls">
          <div className="ck-row">
            <span className="ck-row-label">みじかい はり</span>
            <button type="button" className="btn btn-secondary" onClick={() => move(-60)} disabled={phase !== 'setting'} aria-label="みじかい はりを もどす">
              ◀
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => move(60)} disabled={phase !== 'setting'} aria-label="みじかい はりを すすめる">
              ▶
            </button>
          </div>
          {cfg.minuteStep > 0 && (
            <div className="ck-row">
              <span className="ck-row-label">ながい はり</span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => move(-cfg.minuteStep)}
                disabled={phase !== 'setting'}
                aria-label="ながい はりを もどす"
              >
                ◀
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => move(cfg.minuteStep)}
                disabled={phase !== 'setting'}
                aria-label="ながい はりを すすめる"
              >
                ▶
              </button>
            </div>
          )}
        </div>

        <Feedback kind={message.kind}>{message.text}</Feedback>
        {phase !== 'answered' && (
          <button type="button" className="btn btn-primary btn-lg" onClick={check} disabled={phase !== 'setting'}>
            これで よし
          </button>
        )}
        <AssistBar
          answered={phase === 'answered'}
          disabled={phase !== 'setting'}
          onHint={showHint}
          onAnswer={showAnswer}
          onNext={() => goNext(true)}
        />
      </aside>
    </div>
  )
}
