import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AssistBar } from '../../components/AssistBar'
import { Feedback, Progress, type FeedbackKind } from '../../components/Feedback'
import { useElementSize, usePausableTimeout, useTrialClock } from '../../core/hooks'
import { useSound } from '../../core/sound'
import { formatDuration } from '../../core/stopwatch'
import type { DetailRow, GameProps } from '../../core/types'
import {
  BOARDS,
  buildBoard,
  cellOfNumber,
  checkStep,
  isComplete,
  isStuck,
  nextNumber,
  strokeHint,
  type StepResult,
  type StrokeHint,
} from './logic'
import './number-stroke.css'

const CLEAR_MS = 1300
const WRONG_FLASH_MS = 350
const MESSAGE_MS = 2200
/** SVG 上の1マスの大きさ */
const UNIT = 100
/**
 * なぞっている間は、マスの中心からこの範囲(マスの幅に対する割合)に指が入ったときだけ「入った」とみなす。
 * マスの境目で指がふるえて行ったり来たりするのを防ぐ。
 */
const DRAG_INNER = 0.4

interface BoardRecord {
  errors: number
  /** 1マスずつ戻した回数 */
  stepsBack: number
  /** 「さいしょから」の回数 */
  restarts: number
  ms: number
  /** ヒントを使った回数 */
  hints: number
  /** こたえを見た */
  answered: boolean
}

interface Message {
  kind: Exclude<FeedbackKind, null>
  text: string
  n: number
}

interface Drag {
  pointerId: number
  /** 指が最後にいたマス */
  lastCell: number
  /** このなぞりの中で最後に断られたマス(同じマスで何度もミスを数えないため) */
  lastRefused: number | null
}

export default function NumberStrokeGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const total = BOARDS[mode]
  const [boards] = useState(() => Array.from({ length: total }, () => buildBoard(difficulty, mode)))
  const [index, setIndex] = useState(0)
  const board = boards[index]
  const { size, numbers, last } = board
  const startCell = cellOfNumber(board, 1)

  const [trail, setTrailState] = useState<number[]>(() => [cellOfNumber(boards[0], 1)])
  // なぞりは1回の描画の間に何マスも進むことがあるので、最新の道は ref でも持つ
  const trailRef = useRef(trail)
  const setTrail = (t: number[]) => {
    trailRef.current = t
    setTrailState(t)
    // 道が変わったら、ヒントの光は消す
    setHint(null)
  }
  const [hints, setHints] = useState(0)
  const [hint, setHint] = useState<StrokeHint | null>(null)
  /** こたえを表示して「つぎへ」を待っている */
  const [answered, setAnswered] = useState(false)
  const [errors, setErrors] = useState(0)
  const [stepsBack, setStepsBack] = useState(0)
  const [restarts, setRestarts] = useState(0)
  const [records, setRecords] = useState<BoardRecord[]>([])
  const [cleared, setCleared] = useState(false)
  const [clearMs, setClearMs] = useState(0)
  const [wrongCell, setWrongCell] = useState<{ cell: number; n: number } | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const clock = useTrialClock(paused)
  const [stageRef, stage] = useElementSize<HTMLDivElement>()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const flashN = useRef(0)

  // 一時停止したら、なぞりを打ち切る(指を離したことにする)
  useEffect(() => {
    if (paused) dragRef.current = null
  }, [paused])

  const current = trail[trail.length - 1]
  const stuck = !cleared && isStuck(board, trail)
  const nextNum = nextNumber(board, trail)

  const finish = (all: BoardRecord[]) => {
    const details: DetailRow[] = all.map((r, i) => {
      const parts = [`ミス${r.errors}回`, `もどる${r.stepsBack}回`, `さいしょから${r.restarts}回`]
      if (r.hints > 0) parts.push(`ヒント${r.hints}回`)
      if (r.answered) parts.push('こたえを見た')
      parts.push(formatDuration(r.ms))
      const clean = r.errors === 0 && r.stepsBack + r.restarts === 0 && r.hints === 0 && !r.answered
      return { label: `${i + 1}面`, value: parts.join('・'), mark: clean ? 'correct' : 'partial' }
    })
    onFinish({
      correct: details.filter((d) => d.mark === 'correct').length,
      total: all.length,
      errors: all.reduce((n, r) => n + r.errors, 0),
      extra: [
        { label: 'もどった回数', value: `${all.reduce((n, r) => n + r.stepsBack + r.restarts, 0)}回` },
        { label: 'うち「さいしょから」', value: `${all.reduce((n, r) => n + r.restarts, 0)}回` },
        { label: 'ヒントを使った回数', value: `${all.reduce((n, r) => n + r.hints, 0)}回` },
        { label: 'こたえを見た面', value: `${all.filter((r) => r.answered).length}面` },
      ],
      details,
    })
  }

  /** この面の記録を残して、次の面へ(最後なら結果へ) */
  const goNext = (wasAnswered: boolean) => {
    const all = [...records, { errors, stepsBack, restarts, ms: clearMs, hints, answered: wasAnswered }]
    if (index + 1 >= total) {
      finish(all)
      return
    }
    setRecords(all)
    setIndex(index + 1)
    setTrail([cellOfNumber(boards[index + 1], 1)])
    setErrors(0)
    setStepsBack(0)
    setRestarts(0)
    setHints(0)
    setAnswered(false)
    setMessage(null)
    setCleared(false)
    clock.restart()
  }

  usePausableTimeout(() => goNext(false), cleared ? CLEAR_MS : null, paused, index)

  usePausableTimeout(() => setWrongCell(null), wrongCell ? WRONG_FLASH_MS : null, false, wrongCell?.n)
  usePausableTimeout(() => setMessage(null), message ? MESSAGE_MS : null, paused, message?.n)

  const say = (kind: Message['kind'], text: string) => {
    flashN.current += 1
    setMessage({ kind, text, n: flashN.current })
  }

  const advance = (cell: number) => {
    const next = [...trailRef.current, cell]
    setTrail(next)
    setMessage(null)
    if (isComplete(board, next)) {
      sound('correct')
      setCleared(true)
      setClearMs(clock.read())
      dragRef.current = null
    } else {
      sound('tap')
    }
  }

  const stepBack = () => {
    const t = trailRef.current
    if (cleared || answered || t.length <= 1) return
    sound('tap')
    setTrail(t.slice(0, -1))
    setStepsBack((n) => n + 1)
    setMessage(null)
  }

  const restart = () => {
    if (cleared || answered || trailRef.current.length <= 1) return
    sound('tap')
    setTrail([startCell])
    setRestarts((n) => n + 1)
    setMessage(null)
  }

  const showHint = () => {
    if (cleared || answered) return
    sound('tap')
    setHints((n) => n + 1)
    const h = strokeHint(board, trailRef.current)
    setHint(h)
    say('info', h.kind === 'next' ? 'ひかって いる マスへ すすみましょう' : 'ひかって いる マスまで もどって みましょう')
  }

  const showAnswer = () => {
    if (cleared || answered) return
    dragRef.current = null
    setHint(null)
    setMessage(null)
    setClearMs(clock.read())
    setAnswered(true)
  }

  /** ルール違反(数字の順番ちがい・ほかのマスが残っているのにゴール)。やさしく断ってミスに数える */
  const refuse = (cell: number, res: StepResult) => {
    sound('wrong')
    setErrors((n) => n + 1)
    flashN.current += 1
    setWrongCell({ cell, n: flashN.current })
    if (res === 'goal-too-early') say('wrong', 'まだ とおって いない マスが あります')
    else say('wrong', `つぎの すうじは ${nextNumber(board, trailRef.current)} です`)
  }

  /** 指(またはタップ)で cell に入ろうとしたときの処理。進めた・戻れたら true */
  const tryEnter = (cell: number, fromDrag: boolean): boolean => {
    const res = checkStep(board, trailRef.current, cell)
    switch (res) {
      case 'same':
        return true
      case 'back':
        stepBack()
        return true
      case 'ok':
        advance(cell)
        if (dragRef.current) dragRef.current.lastRefused = null
        return true
      case 'wrong-order':
      case 'goal-too-early': {
        const d = dragRef.current
        if (fromDrag && d) {
          if (d.lastRefused === cell) return false
          d.lastRefused = cell
        }
        refuse(cell, res)
        return false
      }
      case 'not-adjacent':
      case 'visited':
        // なぞっている途中で指が飛んだだけのことが多いので、ミスには数えない
        if (!fromDrag) say('info', 'ひかって いる マスの となりへ すすみます')
        return false
    }
  }

  /** 画面上の位置からマスを求める。inner のときはマスの中心付近だけを当たりにする */
  const cellAt = (clientX: number, clientY: number, inner: boolean): number | null => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    const fx = ((clientX - rect.left) / rect.width) * size
    const fy = ((clientY - rect.top) / rect.height) * size
    if (fx < 0 || fy < 0 || fx >= size || fy >= size) return null
    const col = Math.floor(fx)
    const row = Math.floor(fy)
    if (inner && Math.max(Math.abs(fx - col - 0.5), Math.abs(fy - row - 0.5)) > DRAG_INNER) return null
    return row * size + col
  }

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (cleared || answered || paused) return
    // なぞっている指とは別の指(手のひらなど)は無視する。前のなぞりが残っていたら新しい指で始め直す
    if (dragRef.current && !e.isPrimary) return
    dragRef.current = null
    const cell = cellAt(e.clientX, e.clientY, false)
    if (cell === null) return
    const res = checkStep(board, trailRef.current, cell)
    if (res !== 'same' && res !== 'back' && res !== 'ok') {
      tryEnter(cell, false)
      return
    }
    // 道の先端・ひとつ前・となりのマスに触れたら、そのままなぞりを始められる
    dragRef.current = { pointerId: e.pointerId, lastCell: cell, lastRefused: null }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // 取れなくても、指が盤面の上にある間はなぞれる
    }
    tryEnter(cell, false)
  }

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId || cleared) return
    const cell = cellAt(e.clientX, e.clientY, true)
    if (cell === null || cell === d.lastCell) return
    // 指が速く動いてマスを飛ばしたとき、同じ行・列なら間のマスも順に通ったことにする
    const seq = cellsBetween(d.lastCell, cell, size)
    d.lastCell = cell
    for (const c of seq) {
      if (!tryEnter(c, true)) break
      if (!dragRef.current) break
    }
  }

  const endDrag = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null
  }

  const boardPx = Math.max(0, Math.min(stage.width, stage.height))
  const S = size * UNIT
  const center = (cell: number) => ({
    x: (cell % size) * UNIT + UNIT / 2,
    y: Math.floor(cell / size) * UNIT + UNIT / 2,
  })
  const linePoints = trail
    .map((c) => {
      const p = center(c)
      return `${p.x},${p.y}`
    })
    .join(' ')
  const visited = new Set(trail)
  const goalCell = cellOfNumber(board, last)
  const endP = center(current)

  const feedbackKind: FeedbackKind = cleared ? 'correct' : answered ? 'info' : message ? message.kind : stuck ? 'info' : null
  const feedbackText = cleared
    ? 'せいかい！'
    : answered
      ? 'これが こたえの ひとつです'
      : message
      ? message.text
      : stuck
        ? 'この さきへ すすめません。もどって ください'
        : null

  return (
    <div className="ns">
      <aside className="ns-side">
        <Progress current={index + 1} total={total} />
        <p className="ns-instruction">
          <span className="ns-inst-line">1から ゆびで なぞります</span>
          <span className="ns-inst-line">すうじは じゅんばんに</span>
          <span className="ns-inst-line">マスは ぜんぶ 1かいずつ</span>
          <span className="ns-inst-line">{last}で ゴール</span>
        </p>
        <div className="ns-next">
          つぎの すうじ <strong>{cleared || nextNum > last ? '—' : nextNum}</strong>
        </div>
        <Feedback kind={feedbackKind}>{feedbackText}</Feedback>
        {!answered && (
          <div className="ns-buttons">
            <button type="button" className="btn btn-secondary btn-lg" onClick={stepBack} disabled={cleared || trail.length <= 1}>
              ひとつ もどる
            </button>
            <button type="button" className="btn btn-ghost btn-lg" onClick={restart} disabled={cleared || trail.length <= 1}>
              さいしょから
            </button>
          </div>
        )}
        <AssistBar
          answered={answered}
          disabled={cleared}
          onHint={showHint}
          onAnswer={showAnswer}
          onNext={() => goNext(true)}
        />
      </aside>

      <div className="ns-stage" ref={stageRef}>
        <svg
          ref={svgRef}
          className="ns-board"
          width={boardPx}
          height={boardPx}
          viewBox={`0 0 ${S} ${S}`}
          role="group"
          aria-label={`${size}かける${size}の マス`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
        >
          {numbers.map((_, cell) => {
            const p = center(cell)
            const cls = [
              'ns-cell',
              visited.has(cell) ? 'is-visited' : '',
              cell === goalCell ? 'is-goal' : '',
              wrongCell?.cell === cell ? 'is-wrong' : '',
            ].join(' ')
            return (
              <rect
                key={`c${cell}`}
                className={cls}
                x={p.x - UNIT / 2 + 5}
                y={p.y - UNIT / 2 + 5}
                width={UNIT - 10}
                height={UNIT - 10}
                rx={12}
              />
            )
          })}
          {trail.length > 1 && <polyline points={linePoints} className={`ns-line ${cleared ? 'is-cleared' : ''}`} />}
          {answered && (
            <polyline
              points={board.solution.map((c) => `${center(c).x},${center(c).y}`).join(' ')}
              className="ns-answer"
            />
          )}
          {hint && !answered && (
            <rect
              className="ns-hint hint-glow"
              x={center(hint.cell).x - UNIT / 2 + 5}
              y={center(hint.cell).y - UNIT / 2 + 5}
              width={UNIT - 10}
              height={UNIT - 10}
              rx={12}
            />
          )}
          {!cleared && !answered && <circle cx={endP.x} cy={endP.y} r={40} className="ns-head" />}
          {trail.length === 1 && <circle cx={endP.x} cy={endP.y} r={13} className="ns-dot" />}
          {numbers.map((n, cell) => {
            if (n === 0) return null
            const p = center(cell)
            return (
              <g key={`n${cell}`} className={`ns-num ${visited.has(cell) ? 'is-visited' : ''}`}>
                <circle cx={p.x} cy={p.y} r={29} />
                <text x={p.x} y={p.y} dy="0.36em" textAnchor="middle" fontSize={38}>
                  {n}
                </text>
              </g>
            )
          })}
          {!visited.has(goalCell) && (
            <text x={center(goalCell).x} y={center(goalCell).y + 43} textAnchor="middle" fontSize={13} className="ns-tag">
              ゴール
            </text>
          )}
        </svg>
      </div>
    </div>
  )
}

/** from から to へ同じ行・列でまっすぐ進むときに通るマス(from は含まず to は含む)。そうでなければ [to] */
function cellsBetween(from: number, to: number, size: number): number[] {
  const r1 = Math.floor(from / size)
  const c1 = from % size
  const r2 = Math.floor(to / size)
  const c2 = to % size
  if (r1 !== r2 && c1 !== c2) return [to]
  const out: number[] = []
  const dr = Math.sign(r2 - r1)
  const dc = Math.sign(c2 - c1)
  let r = r1
  let c = c1
  while (r !== r2 || c !== c2) {
    r += dr
    c += dc
    out.push(r * size + c)
  }
  return out
}
