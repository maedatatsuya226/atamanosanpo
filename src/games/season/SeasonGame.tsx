import { useState, type CSSProperties } from 'react'
import { AssistBar } from '../../components/AssistBar'
import { Feedback, Progress, type FeedbackKind } from '../../components/Feedback'
import { usePausableTimeout, useTrialClock } from '../../core/hooks'
import { useSound } from '../../core/sound'
import { formatDuration } from '../../core/stopwatch'
import type { DetailRow, GameProps } from '../../core/types'
import { answerOf, buildQuestions, choiceToRemove, LEVELS, SEASON_NAME, type Question, type Season } from './logic'
import './season.css'

const NEXT_MS = 1100

type Choice = Season | number

interface QuestionRecord {
  label: string
  wrong: number
  hints: number
  answered: boolean
  ms: number
}

function choiceLabel(c: Choice): string {
  return typeof c === 'number' ? `${c}がつ` : SEASON_NAME[c]
}

function questionText(q: Question): string {
  if (q.kind === 'season') return 'これは どの きせつ？'
  if (q.kind === 'month') return 'これは なんがつ？'
  return 'いまの きせつは？'
}

export default function SeasonGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const cfg = LEVELS[difficulty]
  const [questions] = useState(() => buildQuestions(difficulty, mode))
  const [today] = useState(() => new Date())
  const total = questions.length
  const [index, setIndex] = useState(0)
  const q = questions[index]
  const answer = answerOf(q, today)
  /** まちがえて押した選択肢(押せなくする) */
  const [wrongPicks, setWrongPicks] = useState<Choice[]>([])
  /** ヒントで消した選択肢 */
  const [removed, setRemoved] = useState<Choice[]>([])
  const [phase, setPhase] = useState<'answering' | 'correct' | 'answered'>('answering')
  const [shake, setShake] = useState<{ c: Choice; n: number } | null>(null)
  const [hints, setHints] = useState(0)
  const [records, setRecords] = useState<QuestionRecord[]>([])
  const [clearMs, setClearMs] = useState(0)
  const clock = useTrialClock(paused)

  const pick = (c: Choice) => {
    if (phase !== 'answering' || wrongPicks.includes(c) || removed.includes(c)) return
    if (c === answer) {
      sound('correct')
      setClearMs(clock.read())
      setPhase('correct')
    } else {
      sound('wrong')
      setWrongPicks([...wrongPicks, c])
      setShake({ c, n: (shake?.n ?? 0) + 1 })
    }
  }

  const label = q.kind === 'now' ? 'いまの きせつ' : q.thing.name

  const goNext = (answered: boolean) => {
    const all = [...records, { label, wrong: wrongPicks.length, hints, answered, ms: clearMs }]
    if (index + 1 >= total) {
      const details = all.map((r): DetailRow => {
        const parts = [`まちがい${r.wrong}回`]
        if (r.hints > 0) parts.push(`ヒント${r.hints}回`)
        if (r.answered) parts.push('こたえを見た')
        parts.push(formatDuration(r.ms))
        const clean = r.wrong === 0 && r.hints === 0 && !r.answered
        return { label: r.label, value: parts.join('・'), mark: clean ? 'correct' : 'partial' }
      })
      onFinish({
        correct: details.filter((d) => d.mark === 'correct').length,
        total: all.length,
        errors: all.reduce((s, r) => s + r.wrong, 0),
        extra: [
          { label: 'ヒントを使った回数', value: `${all.reduce((s, r) => s + r.hints, 0)}回` },
          { label: 'こたえを見た問題', value: `${all.filter((r) => r.answered).length}問` },
        ],
        details,
      })
      return
    }
    setRecords(all)
    setIndex(index + 1)
    setWrongPicks([])
    setRemoved([])
    setShake(null)
    setHints(0)
    setPhase('answering')
    clock.restart()
  }

  usePausableTimeout(() => goNext(false), phase === 'correct' ? NEXT_MS : null, paused, index)

  const showHint = () => {
    if (phase !== 'answering') return
    const r = choiceToRemove<Choice>(q.choices, answer, [...removed, ...wrongPicks])
    if (r === null) return
    sound('tap')
    setHints((h) => h + 1)
    setRemoved([...removed, r])
  }

  const showAnswer = () => {
    if (phase !== 'answering') return
    setClearMs(clock.read())
    setPhase('answered')
  }

  let message: { text: string; kind: FeedbackKind } | null = null
  if (phase === 'correct') message = { text: 'せいかい！', kind: 'correct' }
  else if (phase === 'answered') message = { text: `こたえは「${choiceLabel(answer)}」です`, kind: 'info' }
  else if (wrongPicks.length > 0) message = { text: 'ちがいます。もういちど えらんで ください', kind: 'wrong' }

  const many = q.choices.length > 4

  return (
    <div className="ss">
      <div className="ss-head">
        <Progress current={index + 1} total={total} />
        <p className="task-instruction">{questionText(q)}</p>
      </div>

      <div className="ss-card">
        {q.kind === 'now' ? (
          <span className="ss-now" aria-hidden="true">
            🗓️
          </span>
        ) : (
          <>
            <span className="ss-picture" aria-hidden="true">
              {q.thing.e}
            </span>
            {(cfg.showName || phase !== 'answering') && <span className="ss-name">{q.thing.name}</span>}
          </>
        )}
      </div>

      <Feedback kind={message?.kind ?? null}>{message?.text}</Feedback>

      <div className={`ss-choices ${many ? 'is-many' : ''}`} style={{ '--n': q.choices.length } as CSSProperties}>
        {(q.choices as Choice[]).map((c) => {
          const isWrong = wrongPicks.includes(c)
          const isGone = removed.includes(c)
          const isAnswer = (phase === 'correct' || phase === 'answered') && c === answer
          const cls = [
            'btn',
            'ss-choice',
            typeof c === 'string' ? `ss-season-${c}` : '',
            isWrong ? 'is-wrong' : '',
            isGone ? 'is-gone' : '',
            isAnswer ? 'is-answer' : '',
            shake?.c === c ? 'is-shake' : '',
          ].join(' ')
          return (
            <button
              key={`${index}-${String(c)}`}
              type="button"
              className={cls}
              onClick={() => pick(c)}
              disabled={phase !== 'answering' || isWrong || isGone}
            >
              {choiceLabel(c)}
            </button>
          )
        })}
      </div>

      <div className="ss-assist">
        <AssistBar
          answered={phase === 'answered'}
          disabled={phase !== 'answering'}
          onHint={showHint}
          onAnswer={showAnswer}
          onNext={() => goNext(true)}
        />
      </div>
    </div>
  )
}
