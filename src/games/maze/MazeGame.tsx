import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { AssistBar } from '../../components/AssistBar'
import { Feedback, Progress, type FeedbackKind } from '../../components/Feedback'
import { useElementSize, usePausableTimeout, useTrialClock } from '../../core/hooks'
import { useSound } from '../../core/sound'
import { formatDuration } from '../../core/stopwatch'
import type { DetailRow, GameProps } from '../../core/types'
import {
  buildMaze,
  isOpen,
  MAZES,
  mazeHint,
  reachedGoal,
  startTrace,
  traceTo,
  type Maze,
  type MazeHint,
  type Trace,
} from './logic'
import './maze.css'

const CLEAR_MS = 1500
const NOTICE_MS = 1100
/** 迷路の左右に、スタート・ゴールの札を置くためにとる幅(マス目の単位) */
const SIDE = 1.5

interface MazeRecord {
  strays: number
  bumps: number
  backs: number
  ms: number
  /** ヒントを使った回数 */
  hints: number
  /** こたえを見た */
  answered: boolean
}

/** 壁の線(マス目の単位)。スタートの左とゴールの右は入口・出口として開けておく */
function wallLines(m: Maze): [number, number, number, number][] {
  const { cols, rows } = m
  const out: [number, number, number, number][] = [
    [0, 0, cols, 0],
    [0, rows, cols, rows],
  ]
  for (let r = 0; r < rows; r++) {
    if (r * cols !== m.start) out.push([0, r, 0, r + 1])
    if (r * cols + cols - 1 !== m.goal) out.push([cols, r, cols, r + 1])
    for (let c = 0; c < cols; c++) {
      const cell = r * cols + c
      if (c < cols - 1 && !isOpen(m, cell, cell + 1)) out.push([c + 1, r, c + 1, r + 1])
      if (r < rows - 1 && !isOpen(m, cell, cell + cols)) out.push([c, r + 1, c + 1, r + 1])
    }
  }
  return out
}

export default function MazeGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const total = MAZES[mode]
  const [mazes] = useState(() => Array.from({ length: total }, () => buildMaze(difficulty)))
  const [index, setIndex] = useState(0)
  const [trace, setTraceState] = useState<Trace>(() => startTrace(mazes[0]))
  // 指の動きは画面の更新より速く届くことがあるので、最新のなぞり方を ref にも持つ
  const traceRef = useRef(trace)
  const setTrace = (t: Trace) => {
    traceRef.current = t
    setTraceState(t)
    // 線が変わったら、ヒントの表示は消す
    setHint(null)
  }
  const [hints, setHints] = useState(0)
  const [hint, setHint] = useState<MazeHint | null>(null)
  /** こたえを表示して「つぎへ」を待っている */
  const [answered, setAnswered] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [clearMs, setClearMs] = useState(0)
  const [records, setRecords] = useState<MazeRecord[]>([])
  const [notice, setNotice] = useState<{ text: string; n: number } | null>(null)
  const clock = useTrialClock(paused)
  const [stageRef, stage] = useElementSize<HTMLDivElement>()
  const dragging = useRef(false)
  const lastCell = useRef<number | null>(null)

  const maze = mazes[index]
  const { cols, rows } = maze
  const walls = useMemo(() => wallLines(maze), [maze])

  const showNotice = (text: string) => setNotice((p) => ({ text, n: (p?.n ?? 0) + 1 }))

  usePausableTimeout(() => setNotice(null), notice ? NOTICE_MS : null, paused, notice?.n)

  /** この迷路の記録を残して、次の迷路へ(最後なら結果へ) */
  const goNext = (wasAnswered: boolean) => {
    const t = traceRef.current
    const all = [...records, { strays: t.strays, bumps: t.bumps, backs: t.backs, ms: clearMs, hints, answered: wasAnswered }]
    if (index + 1 >= total) {
      const details = all.map((r, i): DetailRow => {
        const parts = [`わき道${r.strays}回`, `壁${r.bumps}回`]
        if (r.hints > 0) parts.push(`ヒント${r.hints}回`)
        if (r.answered) parts.push('こたえを見た')
        parts.push(formatDuration(r.ms))
        return {
          label: `${i + 1}つめ`,
          value: parts.join('・'),
          mark: r.strays === 0 && r.hints === 0 && !r.answered ? 'correct' : 'partial',
        }
      })
      onFinish({
        correct: details.filter((d) => d.mark === 'correct').length,
        total: all.length,
        errors: all.reduce((n, r) => n + r.strays, 0),
        extra: [
          { label: '壁に当たった回数', value: `${all.reduce((n, r) => n + r.bumps, 0)}回` },
          { label: '線を戻した回数', value: `${all.reduce((n, r) => n + r.backs, 0)}回` },
          { label: 'ヒントを使った回数', value: `${all.reduce((n, r) => n + r.hints, 0)}回` },
          { label: 'こたえを見た迷路', value: `${all.filter((r) => r.answered).length}つ` },
        ],
        details,
      })
      return
    }
    setRecords(all)
    setIndex(index + 1)
    setTrace(startTrace(mazes[index + 1]))
    setHints(0)
    setAnswered(false)
    setCleared(false)
    clock.restart()
  }

  const showHint = () => {
    if (cleared || answered) return
    sound('tap')
    setHints((n) => n + 1)
    const h = mazeHint(maze, traceRef.current)
    setHint(h)
    showNotice(h.kind === 'next' ? 'ひかって いる ほうへ すすみましょう' : 'ひかって いる ところまで もどって みましょう')
  }

  const showAnswer = () => {
    if (cleared || answered) return
    dragging.current = false
    setHint(null)
    setNotice(null)
    setClearMs(clock.read())
    setAnswered(true)
  }

  // ゴールしたら次の迷路へ
  usePausableTimeout(
    () => goNext(false),
    cleared ? CLEAR_MS : null,
    paused,
    index,
  )

  /** 画面上の位置を、迷路のマスにする(迷路の外なら null) */
  const cellAt = (e: PointerEvent<SVGSVGElement>): number | null => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * (cols + 2 * SIDE) - SIDE
    const y = ((e.clientY - rect.top) / rect.height) * rows
    if (x < 0 || y < 0 || x >= cols || y >= rows) return null
    return Math.floor(y) * cols + Math.floor(x)
  }

  const moveTo = (cell: number | null) => {
    if (cell === null || cell === lastCell.current || cleared) return
    lastCell.current = cell
    const before = traceRef.current
    const r = traceTo(maze, before, cell)
    if (r.event === 'none') return
    setTrace(r.trace)
    if (r.event === 'wall') {
      sound('wrong')
      showNotice('かべが あります')
    } else if (reachedGoal(maze, r.trace)) {
      sound('correct')
      setClearMs(clock.read())
      setCleared(true)
      setNotice(null)
    } else if (r.trace.bumps > before.bumps) {
      // 壁の手前まで進んだとき
      showNotice('かべが あります')
    }
  }

  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    if (cleared || answered) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = true
    lastCell.current = null
    const cell = cellAt(e)
    const now = traceRef.current
    const head = now.path[now.path.length - 1]
    // 線の先でも線の上でもない所から始めたら、なぞり方を知らせる
    if (cell !== null && cell !== head && !now.path.includes(cell)) {
      const r = traceTo(maze, now, cell)
      if (r.event === 'none') {
        // この指の動きは追わない(線が思わぬ所へ飛ばないように)
        showNotice('せんの さきから なぞって ください')
        dragging.current = false
        return
      }
    }
    moveTo(cell)
  }

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (dragging.current) moveTo(cellAt(e))
  }

  const onUp = () => {
    dragging.current = false
    lastCell.current = null
  }

  const restart = () => {
    const now = traceRef.current
    if (cleared || answered || now.path.length <= 1) return
    sound('tap')
    setTrace({ ...now, path: [maze.start], backs: now.backs + 1 })
  }

  const unit = Math.max(0, Math.min(stage.width / (cols + 2 * SIDE), stage.height / rows))
  // 大きな迷路でもスタート・ゴールの札が読める大きさ(約15px)になるよう、札だけ拡大する
  const tagScale = unit > 0 ? Math.min(1.7, Math.max(1, 15 / (0.17 * unit))) : 1
  const center = (cell: number): [number, number] => [(cell % cols) + 0.5, Math.floor(cell / cols) + 0.5]
  const startY = Math.floor(maze.start / cols) + 0.5
  const goalY = Math.floor(maze.goal / cols) + 0.5
  const points = [[-0.5, startY] as [number, number], ...trace.path.map(center)]
  if (cleared) points.push([cols + 0.5, goalY])
  const head = center(trace.path[trace.path.length - 1])

  let message: { text: string; kind: FeedbackKind }
  if (cleared) message = { text: 'ゴール！', kind: 'correct' }
  else if (answered) message = { text: 'これが こたえです', kind: 'info' }
  else if (notice) message = { text: notice.text, kind: 'info' }
  else message = { text: 'まるを ゆびで うごかして ゴールへ', kind: 'info' }

  return (
    <div className="mz">
      <aside className="mz-side">
        <Progress current={index + 1} total={total} />
        <p className="mz-instruction">
          スタートから
          <br />
          ゴールまで
          <br />
          みちを ゆびで なぞります
        </p>
        <Feedback kind={message.kind}>{message.text}</Feedback>
        {!answered && (
          <button type="button" className="btn btn-secondary btn-lg" onClick={restart} disabled={cleared || trace.path.length <= 1}>
            さいしょから
          </button>
        )}
        <AssistBar
          answered={answered}
          disabled={cleared}
          onHint={showHint}
          onAnswer={showAnswer}
          onNext={() => goNext(true)}
        />
      </aside>

      <div className="mz-stage" ref={stageRef}>
        {unit > 0 && (
          <svg
            className="mz-map"
            width={unit * (cols + 2 * SIDE)}
            height={unit * rows}
            viewBox={`${-SIDE} 0 ${cols + 2 * SIDE} ${rows}`}
            role="img"
            aria-label="めいろ"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <rect className="mz-floor" x={0} y={0} width={cols} height={rows} />
            <polyline className="mz-trail" points={points.map(([x, y]) => `${x},${y}`).join(' ')} />
            {/* ヒント: この先のマス、または戻る所 */}
            {hint &&
              !answered &&
              (hint.kind === 'next' ? hint.cells : [hint.cell]).map((c) => (
                <rect
                  key={`h${c}`}
                  className="mz-hint hint-glow"
                  x={(c % cols) + 0.12}
                  y={Math.floor(c / cols) + 0.12}
                  width={0.76}
                  height={0.76}
                  rx={0.15}
                />
              ))}
            {/* こたえ: スタートからゴールまでの道 */}
            {answered && (
              <polyline
                className="mz-answer"
                points={[[-0.5, startY] as [number, number], ...maze.solution.map(center), [cols + 0.5, goalY] as [number, number]]
                  .map(([x, y]) => `${x},${y}`)
                  .join(' ')}
              />
            )}
            <g className="mz-walls">
              {walls.map(([x1, y1, x2, y2]) => (
                <line key={`${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} />
              ))}
            </g>

            <Tag x={-0.75} y={startY - 0.4} text="スタート" scale={tagScale} />
            <Tag x={cols + 0.75} y={goalY - 0.4} text="ゴール" scale={tagScale} />
            <line className="mz-pole" x1={cols + 0.4} y1={goalY + 0.32} x2={cols + 0.4} y2={goalY - 0.18} />
            <path
              className="mz-flag"
              d={`M ${cols + 0.4} ${goalY - 0.18} L ${cols + 0.7} ${goalY - 0.07} L ${cols + 0.4} ${goalY + 0.04} Z`}
            />

            {!cleared && !answered && <circle className="mz-head" cx={head[0]} cy={head[1]} r={0.3} />}
          </svg>
        )}
      </div>
    </div>
  )
}

function Tag({ x, y, text, scale }: { x: number; y: number; text: string; scale: number }) {
  const w = text.length * 0.17 + 0.14
  return (
    <g className="mz-tag" transform={`translate(${x} ${y}) scale(${scale}) translate(${-x} ${-y})`}>
      <rect x={x - w / 2} y={y - 0.13} width={w} height={0.26} rx={0.09} />
      <text x={x} y={y} dy="0.35em" textAnchor="middle">
        {text}
      </text>
    </g>
  )
}
