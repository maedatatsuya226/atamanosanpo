import { useEffect, useState } from 'react'
import { Feedback, Progress } from '../../components/Feedback'
import { average, usePausableTimeout, useTrialClock } from '../../core/hooks'
import { useSound } from '../../core/sound'
import type { GameProps, Metric } from '../../core/types'
import {
  buildItems,
  CARD_BG,
  COLOR_WORD,
  COLORS,
  configFor,
  formatRt,
  INK,
  isCorrect,
  isMismatch,
  ITEMS,
  SPEED_LIMIT_MS,
  type Answer,
  type Item,
} from './logic'
import './color-word.css'

/** 問題と問題のあいだの空白 */
const BLANK_MS = 300
/** 最初の問題の前だけ少し長めに待つ */
const FIRST_BLANK_MS = 1000
/** ○/✕ を見せる時間 */
const FEEDBACK_MS = 500

type Phase = 'blank' | 'show' | 'feedback'

interface ItemRecord {
  item: Item
  correct: boolean
  timedOut: boolean
  /** 答えるまでの時間(時間切れは null) */
  rtMs: number | null
}

export default function ColorWordGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const [cfg] = useState(() => configFor(difficulty, mode))
  const total = ITEMS[mode]
  const limitMs = SPEED_LIMIT_MS[cfg.speed]
  const [items] = useState(() => buildItems(cfg, total))
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('blank')
  const [records, setRecords] = useState<ItemRecord[]>([])
  const clock = useTrialClock(paused)

  const item = items[index]
  const last = records[records.length - 1]

  // 文字を出している途中で一時停止したら、再開時に同じ問題を出し直す
  useEffect(() => {
    if (paused && phase === 'show') setPhase('blank')
  }, [paused, phase])

  // 文字が画面に出てから反応時間を測りはじめる
  useEffect(() => {
    if (phase === 'show') clock.restart()
  }, [phase, index, clock])

  const finish = (all: ItemRecord[]) => {
    const rtOf = (mismatch: boolean) =>
      average(all.filter((r) => r.correct && r.rtMs !== null && isMismatch(r.item) === mismatch).map((r) => r.rtMs!))
    const rtMatch = rtOf(false)
    const rtMismatch = rtOf(true)
    const countOf = (mismatch: boolean) => {
      const rs = all.filter((r) => isMismatch(r.item) === mismatch)
      return `${rs.filter((r) => r.correct).length}/${rs.length}`
    }
    const extra: Metric[] = []
    if (limitMs !== null) {
      extra.push({ label: '見のがし', value: `${all.filter((r) => r.timedOut).length}回` })
    }
    extra.push(
      { label: '正答(一致/不一致)', value: `${countOf(false)} ・ ${countOf(true)}` },
      { label: '平均反応時間(一致)', value: rtMatch === null ? '—' : formatRt(rtMatch) },
      { label: '平均反応時間(不一致)', value: rtMismatch === null ? '—' : formatRt(rtMismatch) },
    )
    if (rtMatch !== null && rtMismatch !== null) {
      const d = rtMismatch - rtMatch
      extra.push({ label: '干渉(不一致−一致)', value: `${d >= 0 ? '+' : '−'}${formatRt(Math.abs(d))}` })
    }
    onFinish({
      correct: all.filter((r) => r.correct).length,
      total: all.length,
      errors: all.filter((r) => !r.correct && !r.timedOut).length,
      extra,
    })
  }

  const record = (rec: ItemRecord) => {
    setRecords([...records, rec])
    setPhase('feedback')
  }

  usePausableTimeout(
    () => {
      if (phase === 'blank') {
        setPhase('show')
      } else if (phase === 'show') {
        // 時間切れ = 見のがし
        record({ item, correct: false, timedOut: true, rtMs: null })
      } else {
        if (index + 1 >= total) {
          finish(records)
          return
        }
        setIndex(index + 1)
        setPhase('blank')
      }
    },
    phase === 'blank' ? (index === 0 ? FIRST_BLANK_MS : BLANK_MS) : phase === 'show' ? limitMs : FEEDBACK_MS,
    paused,
    `${index}-${phase}`,
  )

  const answer = (a: Answer) => {
    if (phase !== 'show' || paused) return
    const rtMs = clock.read()
    const ok = isCorrect(item, cfg.answerMode, a)
    sound(ok ? 'correct' : 'wrong')
    record({ item, correct: ok, timedOut: false, rtMs })
  }

  const fbKind = phase === 'feedback' && last ? (last.correct ? 'correct' : last.timedOut ? 'info' : 'wrong') : null

  return (
    <div className="cw">
      <div className="cw-head">
        <Progress current={index + 1} total={total} />
        <p className="task-instruction">
          {cfg.answerMode === 'match' ? (
            'もじの いみと いろは あっていますか？'
          ) : (
            <>
              もじの「いろ」を こたえて ください
              <span className="cw-note">(よまずに いろを みます)</span>
            </>
          )}
        </p>
        <Feedback kind={fbKind}>
          {fbKind === 'correct' && 'せいかい！'}
          {fbKind === 'wrong' && 'ちがいます'}
          {fbKind === 'info' && 'じかんぎれ'}
        </Feedback>
      </div>

      <div className="cw-card" style={{ background: CARD_BG }} aria-live="off">
        {phase === 'show' && (
          <span className="cw-word" style={{ color: INK[item.ink] }}>
            {COLOR_WORD[item.word]}
          </span>
        )}
        {phase === 'feedback' && last && (
          <span className={`cw-mark ${last.correct ? 'is-ok' : last.timedOut ? 'is-timeout' : 'is-ng'}`} aria-hidden="true">
            {last.correct ? '○' : last.timedOut ? '…' : '✕'}
          </span>
        )}
      </div>

      <div className={`cw-answers cw-answers-${cfg.answerMode}`}>
        {cfg.answerMode === 'match' ? (
          <>
            <button type="button" className="cw-answer" onPointerDown={() => answer('same')}>
              あっている
            </button>
            <button type="button" className="cw-answer" onPointerDown={() => answer('different')}>
              ちがう
            </button>
          </>
        ) : (
          COLORS.map((c) => (
            <button key={c} type="button" className="cw-answer" onPointerDown={() => answer(c)}>
              {COLOR_WORD[c]}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
