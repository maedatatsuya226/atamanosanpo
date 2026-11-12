import { useEffect, useState, type ReactNode } from 'react'
import { NumberPad } from '../../components/NumberPad'
import { R } from '../../components/Ruby'
import { useSound } from '../../core/sound'
import type { DetailRow, GameOutcome, GameProps } from '../../core/types'
import {
  buildQuestions,
  formatAnswer,
  formatValue,
  isYearCorrect,
  KIND_LABELS,
  LEVELS,
  MAX_ATTEMPTS,
  monthGrid,
  partOfMonth,
  seasonOf,
  WEEKDAY_LABELS,
  type Era,
  type QuestionKind,
} from './logic'
import './orientation.css'

interface QuestionRecord {
  /** 回答した値(表示用文字列)を順に */
  tries: string[]
  solved: boolean
  hintUsed: boolean
}

type Feedback = null | 'correct' | 'wrong' | 'reveal'

const PROMPTS: Record<QuestionKind, ReactNode> = {
  year: (
    <>
      <R k="ことし">今年</R>は <R k="なんねん">何年</R>ですか？
    </>
  ),
  month: (
    <>
      <R k="いま">今</R>は <R k="なんがつ">何月</R>ですか？
    </>
  ),
  day: (
    <>
      <R k="きょう">今日</R>は <R k="なんにち">何日</R>ですか？
    </>
  ),
  weekday: (
    <>
      <R k="きょう">今日</R>は <R k="なんようび">何曜日</R>ですか？
    </>
  ),
}

/** 正解を表示してから次の問題へ進むまでの時間 */
const CORRECT_DELAY_MS = 1000

export default function OrientationDateGame({ difficulty, paused, onFinish }: GameProps) {
  const sound = useSound()
  const level = LEVELS[difficulty]
  // 開始時点の端末の日付を正解とする
  const [today] = useState(() => new Date())
  const [questions] = useState(() => buildQuestions(today, difficulty))
  const [index, setIndex] = useState(0)
  const [records, setRecords] = useState<QuestionRecord[]>(() =>
    questions.map(() => ({ tries: [], solved: false, hintUsed: false })),
  )
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [wrongChoices, setWrongChoices] = useState<number[]>([])
  const [input, setInput] = useState('')
  const [era, setEra] = useState<Era>('seireki')
  const [showHint, setShowHint] = useState(false)

  const q = questions[index]
  const record = records[index]
  const locked = feedback === 'correct' || feedback === 'reveal'

  const finish = (finalRecords: QuestionRecord[]) => {
    const firstTry = finalRecords.filter((r) => r.solved && r.tries.length === 1).length
    const errors = finalRecords.reduce((n, r) => n + r.tries.length - (r.solved ? 1 : 0), 0)
    const details: DetailRow[] = questions.map((qq, i) => {
      const r = finalRecords[i]
      const answer = formatAnswer(qq.kind, today)
      let value: string
      if (r.solved && r.tries.length === 1) value = r.tries[0]
      else if (r.solved) value = `${r.tries.join(' → ')}(${r.tries.length}回目で正解)`
      else value = `${r.tries.join(' → ')}(正解は${answer})`
      if (r.hintUsed) value += '・ヒントあり'
      const mark = !r.solved ? 'wrong' : r.tries.length === 1 ? 'correct' : 'partial'
      return { label: KIND_LABELS[qq.kind], value, mark }
    })
    const outcome: GameOutcome = { correct: firstTry, total: questions.length, errors, details }
    if (level.hint) {
      outcome.extra = [{ label: 'ヒント使用', value: `${finalRecords.filter((r) => r.hintUsed).length}回` }]
    }
    onFinish(outcome)
  }

  const goNext = () => {
    if (index + 1 >= questions.length) {
      finish(records)
      return
    }
    setIndex(index + 1)
    setFeedback(null)
    setWrongChoices([])
    setInput('')
    setShowHint(false)
  }

  // 正解したら少し間をおいて次へ(一時停止中は待つ)
  useEffect(() => {
    if (feedback !== 'correct' || paused) return
    const t = window.setTimeout(goNext, CORRECT_DELAY_MS)
    return () => window.clearTimeout(t)
    // goNext は毎回作り直されるが、feedback/paused が変わったときだけ予約し直せばよい
  }, [feedback, paused])

  const answer = (correct: boolean, label: string, choiceValue?: number) => {
    if (locked) return
    const tries = [...record.tries, label]
    const next = records.map((r, i) => (i === index ? { ...r, tries, solved: correct } : r))
    setRecords(next)
    if (correct) {
      sound('correct')
      setFeedback('correct')
      return
    }
    sound('wrong')
    setInput('')
    if (choiceValue !== undefined) setWrongChoices((w) => [...w, choiceValue])
    setFeedback(tries.length >= MAX_ATTEMPTS ? 'reveal' : 'wrong')
  }

  const submitInput = () => {
    const n = Number(input)
    if (!Number.isFinite(n) || input === '') return
    if (q.kind === 'year') answer(isYearCorrect(today, era, n), formatValue('year', n, era))
    else answer(n === q.answer, formatValue(q.kind, n))
  }

  const openHint = () => {
    setShowHint(true)
    setRecords((rs) => rs.map((r, i) => (i === index ? { ...r, hintUsed: true } : r)))
  }

  const useNumpad = q.choices.length === 0
  const year = today.getFullYear()
  const month = today.getMonth() + 1

  return (
    <div className={`od ${useNumpad ? 'od-mode-numpad' : 'od-mode-choice'}`}>
      <div className="od-top">
        <div className="od-main">
          <p className="od-progress">
            {index + 1} / {questions.length}
          </p>
          <h2 className="od-prompt">{PROMPTS[q.kind]}</h2>

          <div className={`od-feedback od-feedback-${feedback ?? 'none'}`} role="status" aria-live="polite">
            {feedback === 'correct' && 'せいかい！'}
            {feedback === 'wrong' && 'ちがいます。もういちど こたえて ください。'}
            {feedback === 'reveal' && (
              <>
                こたえは「{formatAnswer(q.kind, today)}」です
                <button type="button" className="btn btn-primary btn-lg" onClick={goNext}>
                  つぎへ
                </button>
              </>
            )}
          </div>

          {level.hint && q.kind !== 'year' && !locked && !showHint && (
            <button type="button" className="btn btn-secondary" onClick={openHint}>
              ヒント
            </button>
          )}
        </div>

        {/* ヒントは問題の右側に出して、選択肢を押し下げないようにする */}
        <div className="od-side">
          {showHint && !locked && (
            <div className="od-hint">
              {q.kind === 'month' && (
                <p>
                  いまの きせつは
                  <br />「<strong>{seasonOf(month)}</strong>」です
                </p>
              )}
              {q.kind === 'day' && (
                <p>
                  いまは つきの
                  <br />「<strong>{partOfMonth(today.getDate())}</strong>」です
                </p>
              )}
              {q.kind === 'weekday' && <MonthCalendar year={year} month={month} />}
            </div>
          )}
        </div>
      </div>

      <div className="od-answers">
        {useNumpad ? (
          <div className="od-input">
            {q.kind === 'year' && (
              <div className="segmented segmented-sm" role="radiogroup" aria-label="こよみ">
                {(['seireki', 'reiwa'] as const).map((e) => (
                  <button
                    key={e}
                    type="button"
                    role="radio"
                    aria-checked={era === e}
                    className={`segment ${era === e ? 'is-selected' : ''}`}
                    onClick={() => setEra(e)}
                    disabled={locked}
                  >
                    {e === 'seireki' ? 'せいれき' : 'れいわ'}
                  </button>
                ))}
              </div>
            )}
            <NumberPad
              value={input}
              onChange={setInput}
              onSubmit={submitInput}
              maxLength={q.kind === 'year' && era === 'seireki' ? 4 : 2}
              unit={q.kind === 'year' ? (era === 'reiwa' ? '年(令和)' : '年') : KIND_LABELS[q.kind]}
              disabled={locked}
            />
          </div>
        ) : (
          <div className={`od-choices ${q.choices.length > 5 ? 'is-many' : ''}`}>
            {q.choices.map((v) => {
              const wrong = wrongChoices.includes(v)
              const isAnswer = locked && v === q.answer
              return (
                <button
                  key={v}
                  type="button"
                  className={`od-choice ${wrong ? 'is-wrong' : ''} ${isAnswer ? 'is-answer' : ''}`}
                  disabled={locked || wrong}
                  onClick={() => answer(v === q.answer, formatValue(q.kind, v), v)}
                >
                  {q.kind === 'weekday' ? (
                    <>
                      <span className="od-choice-main">{WEEKDAY_LABELS[v]}</span>
                      <span className="od-choice-sub">ようび</span>
                    </>
                  ) : (
                    <span className="od-choice-main">{formatValue(q.kind, v)}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/** ヒント用のカレンダー。今日の日付には印を付けない */
function MonthCalendar({ year, month }: { year: number; month: number }) {
  return (
    <table className="od-calendar">
      <caption>{month}月のカレンダー</caption>
      <thead>
        <tr>
          {WEEKDAY_LABELS.map((w, i) => (
            <th key={w} className={i === 0 ? 'is-sun' : i === 6 ? 'is-sat' : ''}>
              {w}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {monthGrid(year, month).map((week, wi) => (
          <tr key={wi}>
            {week.map((d, di) => (
              <td key={di} className={di === 0 ? 'is-sun' : di === 6 ? 'is-sat' : ''}>
                {d ?? ''}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
