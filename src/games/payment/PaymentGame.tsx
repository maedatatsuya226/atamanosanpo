import { useState } from 'react'
import { AssistBar } from '../../components/AssistBar'
import { Feedback, Progress, type FeedbackKind } from '../../components/Feedback'
import { usePausableTimeout, useTrialClock } from '../../core/hooks'
import { useSound } from '../../core/sound'
import { formatDuration } from '../../core/stopwatch'
import type { DetailRow, GameProps } from '../../core/types'
import { buildProblems, fewestCoins, judge, LEVELS, payHint, total, yen, type Money, type PayHint, type PayResult } from './logic'
import './payment.css'

const CLEAR_MS = 1400

interface ProblemRecord {
  price: number
  /** 「はらう」で正しくなかった回数 */
  fails: number
  hints: number
  answered: boolean
  ms: number
}

type Phase = 'paying' | 'correct' | 'answered'

const RESULT_TEXT: Record<Exclude<PayResult, 'ok'>, string> = {
  short: 'たりません。おかねを たしましょう',
  over: 'おおすぎます。おかねを もどしましょう',
  'not-fewest': 'ちょうどです。でも もっと すくない まいすうで はらえます',
}

export default function PaymentGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const cfg = LEVELS[difficulty]
  const [prices] = useState(() => buildProblems(difficulty, mode))
  const totalProblems = prices.length
  const [index, setIndex] = useState(0)
  const price = prices[index]
  const [tray, setTray] = useState<Money[]>([])
  const [phase, setPhase] = useState<Phase>('paying')
  const [result, setResult] = useState<PayResult | null>(null)
  const [fails, setFails] = useState(0)
  const [hints, setHints] = useState(0)
  const [hint, setHint] = useState<PayHint | null>(null)
  const [records, setRecords] = useState<ProblemRecord[]>([])
  const [clearMs, setClearMs] = useState(0)
  const clock = useTrialClock(paused)

  const changeTray = (next: Money[]) => {
    setTray(next)
    setResult(null)
    setHint(null)
  }

  const add = (m: Money) => {
    if (phase !== 'paying') return
    sound('tap')
    changeTray([...tray, m])
  }

  const removeAt = (i: number) => {
    if (phase !== 'paying') return
    sound('tap')
    changeTray(tray.filter((_, k) => k !== i))
  }

  const clearTray = () => {
    if (phase !== 'paying' || tray.length === 0) return
    sound('tap')
    changeTray([])
  }

  const pay = () => {
    if (phase !== 'paying' || tray.length === 0) return
    const r = judge(price, tray, cfg)
    setResult(r)
    setHint(null)
    if (r === 'ok') {
      sound('correct')
      setClearMs(clock.read())
      setPhase('correct')
    } else {
      sound('wrong')
      setFails((f) => f + 1)
    }
  }

  /** この問題の記録を残して、次の問題へ(最後なら結果へ) */
  const goNext = (answered: boolean) => {
    const all = [...records, { price, fails, hints, answered, ms: clearMs }]
    if (index + 1 >= totalProblems) {
      const details = all.map((r): DetailRow => {
        const parts = [`やりなおし${r.fails}回`]
        if (r.hints > 0) parts.push(`ヒント${r.hints}回`)
        if (r.answered) parts.push('こたえを見た')
        parts.push(formatDuration(r.ms))
        const clean = r.fails === 0 && r.hints === 0 && !r.answered
        return { label: `${yen(r.price)}円`, value: parts.join('・'), mark: clean ? 'correct' : 'partial' }
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
    setRecords(all)
    setIndex(index + 1)
    setTray([])
    setResult(null)
    setHint(null)
    setFails(0)
    setHints(0)
    setPhase('paying')
    clock.restart()
  }

  usePausableTimeout(() => goNext(false), phase === 'correct' ? CLEAR_MS : null, paused, index)

  const showHint = () => {
    if (phase !== 'paying') return
    sound('tap')
    setHints((h) => h + 1)
    setResult(null)
    setHint(payHint(price, tray, cfg))
  }

  const showAnswer = () => {
    if (phase !== 'paying') return
    setTray(fewestCoins(price, cfg.kinds))
    setResult(null)
    setHint(null)
    setClearMs(clock.read())
    setPhase('answered')
  }

  // トレーのお金は大きい順に並べて見せる(どれを出したか数えやすいように)
  const shown = tray.map((m, i) => ({ m, i })).sort((a, b) => b.m - a.m)
  const removeHintAt = hint?.kind === 'remove' ? shown.find((x) => x.m === hint.money)?.i : undefined

  let message: { text: string; kind: FeedbackKind }
  if (phase === 'correct') message = { text: 'ちょうどです！', kind: 'correct' }
  else if (phase === 'answered') message = { text: 'これが いちばん すくない まいすうの はらいかたです', kind: 'info' }
  else if (hint)
    message = {
      text:
        hint.kind === 'add'
          ? `${yen(hint.money)}えんを たしましょう`
          : hint.kind === 'remove'
            ? `${yen(hint.money)}えんを もどしましょう`
            : 'ちょうどです。「はらう」を おしましょう',
      kind: 'info',
    }
  else if (result && result !== 'ok') message = { text: RESULT_TEXT[result], kind: 'wrong' }
  else
    message = {
      text: cfg.fewest ? 'なるべく すくない まいすうで はらいます' : 'ちょうどの おかねを だして「はらう」',
      kind: 'info',
    }

  return (
    <div className="pay">
      <div className="pay-main">
        <div className="pay-head">
          <Progress current={index + 1} total={totalProblems} />
          <div className="pay-price" aria-label={`おかいけい ${price}えん`}>
            <span className="pay-price-label">おかいけい</span>
            <strong>{yen(price)}</strong>
            <span className="pay-price-unit">えん</span>
          </div>
        </div>

        <div className="pay-tray" aria-label="だした おかね">
          <span className="pay-tray-label">
            トレー{cfg.showTotal && <strong className="pay-sum">いま {yen(total(tray))}えん</strong>}
          </span>
          <div className="pay-tray-coins">
            {tray.length === 0 && <span className="pay-empty">ここに おかねが でます</span>}
            {shown.map(({ m, i }) => (
              <button
                key={i}
                type="button"
                className={`pay-money-btn ${removeHintAt === i ? 'is-hint' : ''}`}
                onClick={() => removeAt(i)}
                disabled={phase !== 'paying'}
                aria-label={`${m}えんを もどす`}
              >
                <MoneyIcon m={m} />
              </button>
            ))}
          </div>
        </div>

        <div className="pay-wallet" aria-label="さいふ">
          {cfg.kinds.map((m) => (
            <button
              key={m}
              type="button"
              className={`pay-money-btn pay-wallet-btn ${hint?.kind === 'add' && hint.money === m ? 'is-hint' : ''}`}
              onClick={() => add(m)}
              disabled={phase !== 'paying'}
              aria-label={`${m}えんを だす`}
            >
              <MoneyIcon m={m} />
            </button>
          ))}
        </div>
      </div>

      <aside className="pay-side">
        <Feedback kind={message.kind}>{message.text}</Feedback>
        {phase !== 'answered' && (
          <>
            <button type="button" className="btn btn-primary btn-lg" onClick={pay} disabled={phase !== 'paying' || tray.length === 0}>
              はらう
            </button>
            <button type="button" className="btn btn-ghost" onClick={clearTray} disabled={phase !== 'paying' || tray.length === 0}>
              ぜんぶ もどす
            </button>
          </>
        )}
        <AssistBar
          answered={phase === 'answered'}
          disabled={phase !== 'paying'}
          onHint={showHint}
          onAnswer={showAnswer}
          onNext={() => goNext(true)}
        />
      </aside>
    </div>
  )
}

/** お金の絵(実物の図柄はまねず、色と大きさと数字で区別する) */
function MoneyIcon({ m }: { m: Money }) {
  if (m === 1000) {
    return (
      <span className="money money-bill">
        <span className="money-num">1000</span>
        <span className="money-unit">えん</span>
      </span>
    )
  }
  return (
    <span className={`money money-${m}`}>
      {(m === 5 || m === 50) && <span className="money-hole" aria-hidden="true" />}
      <span className="money-num">{m}</span>
    </span>
  )
}
