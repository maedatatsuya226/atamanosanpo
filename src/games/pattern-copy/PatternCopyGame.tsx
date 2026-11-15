import { useState } from 'react'
import { AssistBar } from '../../components/AssistBar'
import { Feedback, Progress, type FeedbackKind } from '../../components/Feedback'
import { useElementSize, usePausableTimeout, useTrialClock } from '../../core/hooks'
import { useSound } from '../../core/sound'
import { formatDuration } from '../../core/stopwatch'
import type { DetailRow, GameProps } from '../../core/types'
import { buildProblems, cellHint, checkCells, LEVELS, type Pattern } from './logic'
import './pattern-copy.css'

const NEXT_MS = 1300
const GAP = 28

/** 色(1〜3)。色が見分けにくい人のために、色ごとに白い記号も付ける */
const COLORS = [
  { fill: '#ffffff', name: 'けす', mark: '' },
  { fill: '#d64545', name: 'あか', mark: '●' },
  { fill: '#2f6fd0', name: 'あお', mark: '▲' },
  { fill: '#e3a400', name: 'きいろ', mark: '■' },
] as const

interface ProblemRecord {
  fails: number
  hints: number
  answered: boolean
  ms: number
}

export default function PatternCopyGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const cfg = LEVELS[difficulty]
  const [problems] = useState(() => buildProblems(difficulty, mode))
  const total = problems.length
  const [index, setIndex] = useState(0)
  const model = problems[index]
  const [work, setWork] = useState<Pattern>(() => new Array(problems[0].length).fill(0))
  /** いま選んでいる色(0 = けす) */
  const [brush, setBrush] = useState(1)
  const [checked, setChecked] = useState<boolean[] | null>(null)
  const [phase, setPhase] = useState<'painting' | 'correct' | 'answered'>('painting')
  const [fails, setFails] = useState(0)
  const [hints, setHints] = useState(0)
  const [hint, setHint] = useState<{ cell: number; color: number } | null>(null)
  const [records, setRecords] = useState<ProblemRecord[]>([])
  const [clearMs, setClearMs] = useState(0)
  const clock = useTrialClock(paused)
  const [stageRef, stage] = useElementSize<HTMLDivElement>()

  const paint = (cell: number) => {
    if (phase !== 'painting') return
    sound('tap')
    setWork(work.map((v, i) => (i === cell ? brush : v)))
    setChecked(null)
    setHint(null)
  }

  const clearAll = () => {
    if (phase !== 'painting' || work.every((v) => v === 0)) return
    sound('tap')
    setWork(new Array(model.length).fill(0))
    setChecked(null)
    setHint(null)
  }

  const check = () => {
    if (phase !== 'painting') return
    const res = checkCells(model, work)
    setChecked(res)
    setHint(null)
    if (res.every(Boolean)) {
      sound('correct')
      setClearMs(clock.read())
      setPhase('correct')
    } else {
      sound('wrong')
      setFails((f) => f + 1)
    }
  }

  const goNext = (answered: boolean) => {
    const all = [...records, { fails, hints, answered, ms: clearMs }]
    if (index + 1 >= total) {
      const details = all.map((r, i): DetailRow => {
        const parts = [`やりなおし${r.fails}回`]
        if (r.hints > 0) parts.push(`ヒント${r.hints}回`)
        if (r.answered) parts.push('こたえを見た')
        parts.push(formatDuration(r.ms))
        const clean = r.fails === 0 && r.hints === 0 && !r.answered
        return { label: `${i + 1}つめ`, value: parts.join('・'), mark: clean ? 'correct' : 'partial' }
      })
      onFinish({
        correct: details.filter((d) => d.mark === 'correct').length,
        total: all.length,
        errors: all.reduce((s, r) => s + r.fails, 0),
        extra: [
          { label: 'ヒントを使った回数', value: `${all.reduce((s, r) => s + r.hints, 0)}回` },
          { label: 'こたえを見た模様', value: `${all.filter((r) => r.answered).length}つ` },
        ],
        details,
      })
      return
    }
    const next = problems[index + 1]
    setRecords(all)
    setIndex(index + 1)
    setWork(new Array(next.length).fill(0))
    setBrush(1)
    setChecked(null)
    setHint(null)
    setFails(0)
    setHints(0)
    setPhase('painting')
    clock.restart()
  }

  usePausableTimeout(() => goNext(false), phase === 'correct' ? NEXT_MS : null, paused, index)

  const showHint = () => {
    if (phase !== 'painting') return
    const h = cellHint(model, work)
    if (!h) return
    sound('tap')
    setHints((n) => n + 1)
    setHint(h)
    setBrush(h.color)
  }

  const showAnswer = () => {
    if (phase !== 'painting') return
    setWork([...model])
    setChecked(null)
    setHint(null)
    setClearMs(clock.read())
    setPhase('answered')
  }

  const boardPx = Math.max(0, Math.min((stage.width - GAP) / 2, stage.height - 40))
  const cellPx = boardPx / cfg.size

  let message: { text: string; kind: FeedbackKind }
  if (phase === 'correct') message = { text: 'せいかい！', kind: 'correct' }
  else if (phase === 'answered') message = { text: 'これが こたえです', kind: 'info' }
  else if (hint)
    message = {
      text: hint.color === 0 ? 'ひかって いる マスを けしましょう' : `ひかって いる マスを ${COLORS[hint.color].name}に ぬりましょう`,
      kind: 'info',
    }
  else if (checked) message = { text: 'あかい わくの マスが ちがいます', kind: 'wrong' }
  else message = { text: 'いろを えらんで、マスを おして ぬります', kind: 'info' }

  const palette = [...Array.from({ length: cfg.colors }, (_, i) => i + 1), 0]

  return (
    <div className="pc">
      <div className="pc-stage" ref={stageRef}>
        {boardPx > 0 && (
          <div className="pc-boards" style={{ gap: GAP }}>
            <div className="pc-board-wrap">
              <span className="pc-label">みほん</span>
              <Board pattern={model} size={cfg.size} cellPx={cellPx} />
            </div>
            <div className="pc-board-wrap">
              <span className="pc-label">つくる</span>
              <Board
                pattern={work}
                size={cfg.size}
                cellPx={cellPx}
                onCell={paint}
                disabled={phase !== 'painting'}
                wrong={checked ? checked.map((ok) => !ok) : undefined}
                hintCell={hint?.cell}
              />
            </div>
          </div>
        )}
      </div>

      <aside className="pc-side">
        <Progress current={index + 1} total={total} />
        <Feedback kind={message.kind}>{message.text}</Feedback>
        <div className="pc-palette" role="radiogroup" aria-label="いろ">
          {palette.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={brush === c}
              className={`pc-swatch ${brush === c ? 'is-selected' : ''} ${c === 0 ? 'is-eraser' : ''}`}
              onClick={() => setBrush(c)}
              disabled={phase !== 'painting'}
            >
              <span className="pc-swatch-chip" style={{ background: COLORS[c].fill }}>
                {COLORS[c].mark}
              </span>
              {COLORS[c].name}
            </button>
          ))}
        </div>
        {phase !== 'answered' && (
          <div className="pc-actions">
            <button type="button" className="btn btn-ghost" onClick={clearAll} disabled={phase !== 'painting'}>
              ぜんぶ けす
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={check} disabled={phase !== 'painting'}>
              できた
            </button>
          </div>
        )}
        <AssistBar
          answered={phase === 'answered'}
          disabled={phase !== 'painting'}
          onHint={showHint}
          onAnswer={showAnswer}
          onNext={() => goNext(true)}
        />
      </aside>
    </div>
  )
}

function Board({
  pattern,
  size,
  cellPx,
  onCell,
  disabled,
  wrong,
  hintCell,
}: {
  pattern: Pattern
  size: number
  cellPx: number
  onCell?: (cell: number) => void
  disabled?: boolean
  wrong?: boolean[]
  hintCell?: number
}) {
  return (
    <div className="pc-board" style={{ gridTemplateColumns: `repeat(${size}, ${cellPx}px)`, fontSize: cellPx * 0.36 }}>
      {pattern.map((v, i) => {
        const cls = ['pc-cell', wrong?.[i] ? 'is-wrong' : '', hintCell === i ? 'is-hint' : ''].join(' ')
        const style = { width: cellPx, height: cellPx, background: COLORS[v].fill }
        return onCell ? (
          <button key={i} type="button" className={cls} style={style} onClick={() => onCell(i)} disabled={disabled} aria-label={`${i + 1}ばんめの マス`}>
            {COLORS[v].mark}
          </button>
        ) : (
          <span key={i} className={cls} style={style} aria-hidden="true">
            {COLORS[v].mark}
          </span>
        )
      })}
    </div>
  )
}
