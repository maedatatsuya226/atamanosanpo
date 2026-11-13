import { useState } from 'react'
import { AssistBar } from '../../components/AssistBar'
import { Feedback, Progress, type FeedbackKind } from '../../components/Feedback'
import { usePausableTimeout, useTrialClock } from '../../core/hooks'
import { useSound } from '../../core/sound'
import { formatDuration } from '../../core/stopwatch'
import type { DetailRow, GameProps } from '../../core/types'
import { buildProblems, checkSlots, slotHint, type Card } from './logic'
import './step-order.css'

const CLEAR_MS = 1400

interface ProblemRecord {
  title: string
  /** 「こたえあわせ」を押した回数 */
  tries: number
  hints: number
  answered: boolean
  ms: number
}

type Phase = 'arrange' | 'correct' | 'answered'

export default function StepOrderGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const [problems] = useState(() => buildProblems(difficulty, mode))
  const total = problems.length
  const [index, setIndex] = useState(0)
  const problem = problems[index]
  const n = problem.answer.length
  /** 枠ごとに置いたカードの id */
  const [slots, setSlots] = useState<(string | null)[]>(() => new Array(problems[0].answer.length).fill(null))
  /** こたえあわせの結果(枠ごとの正誤)。並べかえたら消す */
  const [checked, setChecked] = useState<boolean[] | null>(null)
  const [phase, setPhase] = useState<Phase>('arrange')
  const [tries, setTries] = useState(0)
  const [hints, setHints] = useState(0)
  const [hint, setHint] = useState<{ slot: number; cardId: string } | null>(null)
  const [records, setRecords] = useState<ProblemRecord[]>([])
  const [clearMs, setClearMs] = useState(0)
  const clock = useTrialClock(paused)

  const cardById = new Map(problem.cards.map((c) => [c.id, c]))
  const placed = new Set(slots.filter((s): s is string => s !== null))
  const full = slots.every((s) => s !== null)

  const changeSlots = (next: (string | null)[]) => {
    setSlots(next)
    setChecked(null)
    setHint(null)
  }

  const place = (card: Card) => {
    if (phase !== 'arrange' || placed.has(card.id)) return
    const at = slots.indexOf(null)
    if (at < 0) return
    sound('tap')
    const next = [...slots]
    next[at] = card.id
    changeSlots(next)
  }

  const unplace = (slot: number) => {
    if (phase !== 'arrange' || slots[slot] === null) return
    sound('tap')
    const next = [...slots]
    next[slot] = null
    changeSlots(next)
  }

  const check = () => {
    if (phase !== 'arrange' || !full) return
    const res = checkSlots(problem, slots)
    setTries((t) => t + 1)
    if (res.every(Boolean)) {
      sound('correct')
      setClearMs(clock.read())
      setChecked(res)
      setPhase('correct')
    } else {
      sound('wrong')
      setChecked(res)
    }
  }

  /** この問題の記録を残して、次の問題へ(最後なら結果へ) */
  const goNext = (answered: boolean) => {
    const all = [...records, { title: problem.scene.title, tries, hints, answered, ms: clearMs }]
    if (index + 1 >= total) {
      const details = all.map((r): DetailRow => {
        const parts = [`こたえあわせ${r.tries}回`]
        if (r.hints > 0) parts.push(`ヒント${r.hints}回`)
        if (r.answered) parts.push('こたえを見た')
        parts.push(formatDuration(r.ms))
        const clean = r.tries === 1 && r.hints === 0 && !r.answered
        return { label: r.title, value: parts.join('・'), mark: clean ? 'correct' : 'partial' }
      })
      onFinish({
        correct: details.filter((d) => d.mark === 'correct').length,
        total: all.length,
        errors: all.reduce((s, r) => s + Math.max(0, r.tries - (r.answered ? 0 : 1)), 0),
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
    setSlots(new Array(next.answer.length).fill(null))
    setChecked(null)
    setHint(null)
    setTries(0)
    setHints(0)
    setPhase('arrange')
    clock.restart()
  }

  usePausableTimeout(() => goNext(false), phase === 'correct' ? CLEAR_MS : null, paused, index)

  const showHint = () => {
    if (phase !== 'arrange') return
    sound('tap')
    setHints((h) => h + 1)
    setHint(slotHint(problem, slots))
  }

  const showAnswer = () => {
    if (phase !== 'arrange') return
    setSlots(problem.answer.map((c) => c.id))
    setChecked(null)
    setHint(null)
    setClearMs(clock.read())
    setPhase('answered')
  }

  let message: { text: string; kind: FeedbackKind }
  if (phase === 'correct') message = { text: 'せいかい！', kind: 'correct' }
  else if (phase === 'answered') message = { text: 'これが こたえです', kind: 'info' }
  else if (hint) message = { text: `ひかって いる カードを ${hint.slot + 1}ばんに おきましょう`, kind: 'info' }
  else if (checked) message = { text: 'あかい ところが ちがいます。カードを おして もどせます', kind: 'wrong' }
  else if (full) message = { text: 'ならべたら「こたえあわせ」', kind: 'info' }
  else message = { text: 'じゅんばんに カードを おして ならべます', kind: 'info' }

  return (
    <div className="so">
      <div className="so-main">
        <div className="so-head">
          <Progress current={index + 1} total={total} />
          <h2 className="so-title">
            <span className="so-title-icon" aria-hidden="true">
              {problem.scene.icon}
            </span>
            {problem.scene.title}
          </h2>
          {problem.cards.length > n && <p className="so-note">つかわない カードが まざって います</p>}
        </div>

        <ol className="so-slots" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {slots.map((id, i) => {
            const card = id ? cardById.get(id) : undefined
            const cls = [
              'so-slot',
              card ? 'is-filled' : '',
              checked && card ? (checked[i] ? 'is-right' : 'is-wrong') : '',
              hint?.slot === i ? 'is-hint' : '',
            ].join(' ')
            return (
              <li key={i} className={cls}>
                <span className="so-slot-num">{i + 1}</span>
                {card && (
                  <button
                    type="button"
                    className={`so-card ${hint?.cardId === card.id ? 'is-hint' : ''}`}
                    onClick={() => unplace(i)}
                    disabled={phase !== 'arrange'}
                  >
                    <CardFace card={card} />
                  </button>
                )}
              </li>
            )
          })}
        </ol>

        <div className="so-pool" aria-label="ならべる カード">
          {/* 置いたカードは、ここからは消える(枠のカードを押すと戻る) */}
          {problem.cards
            .filter((c) => !placed.has(c.id))
            .map((c) => (
              <button
                key={c.id}
                type="button"
                className={`so-card ${hint?.cardId === c.id ? 'is-hint' : ''}`}
                onClick={() => place(c)}
                disabled={phase !== 'arrange'}
              >
                <CardFace card={c} />
              </button>
            ))}
        </div>
      </div>

      <aside className="so-actions">
        <Feedback kind={message.kind}>{message.text}</Feedback>
        {phase !== 'answered' && (
          <button type="button" className="btn btn-primary btn-lg" onClick={check} disabled={phase !== 'arrange' || !full}>
            こたえあわせ
          </button>
        )}
        <AssistBar
          answered={phase === 'answered'}
          disabled={phase !== 'arrange'}
          onHint={showHint}
          onAnswer={showAnswer}
          onNext={() => goNext(true)}
        />
      </aside>
    </div>
  )
}

function CardFace({ card }: { card: Card }) {
  return (
    <>
      <span className="so-card-icon" aria-hidden="true">
        {card.step.e}
      </span>
      <span className="so-card-text">{card.step.t}</span>
    </>
  )
}
