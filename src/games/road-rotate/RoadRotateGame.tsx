import { useEffect, useRef, useState } from 'react'
import { CAR_ANGLE, CarIcon } from '../../components/CarIcon'
import { AssistBar } from '../../components/AssistBar'
import { Feedback, Progress, type FeedbackKind } from '../../components/Feedback'
import type { Dir } from '../../core/grid'
import { useElementSize, usePausableTimeout, useTrialClock } from '../../core/hooks'
import { useSound } from '../../core/sound'
import { formatDuration } from '../../core/stopwatch'
import type { DetailRow, GameProps } from '../../core/types'
import {
  BASE,
  buildPuzzle,
  drive,
  hintTile,
  minTurns,
  PUZZLES,
  rotateTile,
  solvedPuzzle,
  type Puzzle,
  type Shape,
} from './logic'
import './road-rotate.css'

const CLEAR_MS = 1500
const FAIL_SHOW_MS = 1700
/** 車が1マス進むのにかかる時間 */
const STEP_MS = 340

interface PuzzleRecord {
  taps: number
  minTaps: number
  fails: number
  ms: number
  /** ヒントを使った回数 */
  hints: number
  /** こたえを見た */
  answered: boolean
}

/** answered = こたえを表示して「つぎへ」を待っている */
type Phase = 'solving' | 'driving' | 'failed' | 'goal' | 'answered'

/** 車が通る点(マス目の単位)。左の外から入り、つながっていれば右の外へ出る */
function drivePoints(p: Puzzle, cells: number[], solved: boolean): [number, number][] {
  const { cols } = p
  const pt = (cell: number): [number, number] => [(cell % cols) + 0.5, Math.floor(cell / cols) + 0.5]
  const startY = Math.floor(p.start / cols) + 0.5
  const pts: [number, number][] = [[-0.6, startY]]
  if (cells.length === 0) {
    // スタートのタイルが左を向いていない: 入口の手前で止まる
    pts.push([-0.15, startY])
    return pts
  }
  pts.push([0, startY])
  for (const c of cells) pts.push(pt(c))
  if (solved) {
    const goalY = Math.floor(p.goal / cols) + 0.5
    pts.push([cols, goalY], [cols + 0.6, goalY])
  }
  return pts
}

function poseAt(pts: [number, number][], progress: number): { x: number; y: number; dir: Dir } {
  const seg = Math.min(pts.length - 2, Math.max(0, Math.floor(progress)))
  const t = Math.min(1, Math.max(0, progress - seg))
  const [x1, y1] = pts[seg]
  const [x2, y2] = pts[seg + 1]
  const dx = x2 - x1
  const dy = y2 - y1
  const dir: Dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 1 : 3) : dy >= 0 ? 2 : 0
  return { x: x1 + dx * t, y: y1 + dy * t, dir }
}

export default function RoadRotateGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const total = PUZZLES[mode]
  const [puzzles] = useState(() => Array.from({ length: total }, () => buildPuzzle(difficulty)))
  const [index, setIndex] = useState(0)
  const [board, setBoard] = useState<Puzzle>(puzzles[0])
  /** タイルごとの回した回数(回転のアニメーションを常に時計回りにするため、0〜3に戻さない) */
  const [spins, setSpins] = useState<number[]>(() => puzzles[0].tiles.map((t) => t?.rot ?? 0))
  const [phase, setPhase] = useState<Phase>('solving')
  const [route, setRoute] = useState<{ pts: [number, number][]; solved: boolean; stopCell: number | null } | null>(
    null,
  )
  const [progress, setProgress] = useState(0)
  /** 一時停止をはさんでも続きから走れるよう、進み具合は ref にも持つ */
  const progressRef = useRef(0)
  const [taps, setTaps] = useState(0)
  const [fails, setFails] = useState(0)
  const [records, setRecords] = useState<PuzzleRecord[]>([])
  const [clearMs, setClearMs] = useState(0)
  const [hints, setHints] = useState(0)
  /** ヒントで光らせているタイル */
  const [hintCell, setHintCell] = useState<number | null>(null)
  const [hintNote, setHintNote] = useState<string | null>(null)
  const clock = useTrialClock(paused)
  const [stageRef, stage] = useElementSize<HTMLDivElement>()

  const { cols, rows } = board

  const press = (cell: number) => {
    if (phase !== 'solving' || !board.tiles[cell]) return
    sound('tap')
    setBoard(rotateTile(board, cell))
    setSpins((s) => s.map((v, i) => (i === cell ? v + 1 : v)))
    setTaps((n) => n + 1)
    setHintCell(null)
    setHintNote(null)
  }

  const depart = () => {
    if (phase !== 'solving') return
    setHintCell(null)
    setHintNote(null)
    const r = drive(board)
    setRoute({
      pts: drivePoints(board, r.cells, r.solved),
      solved: r.solved,
      stopCell: r.solved ? null : (r.cells[r.cells.length - 1] ?? board.start),
    })
    progressRef.current = 0
    setProgress(0)
    setPhase('driving')
  }

  // 車を走らせる
  useEffect(() => {
    if (phase !== 'driving' || paused || !route) return
    let raf = 0
    let last = performance.now()
    const end = route.pts.length - 1
    const tick = (now: number) => {
      const dt = Math.min(100, now - last)
      last = now
      progressRef.current = Math.min(end, progressRef.current + dt / STEP_MS)
      setProgress(progressRef.current)
      if (progressRef.current >= end) {
        if (route.solved) {
          sound('correct')
          setClearMs(clock.read())
          setPhase('goal')
        } else {
          sound('wrong')
          setFails((n) => n + 1)
          setPhase('failed')
        }
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, route])

  // つながっていなかったら、少し見せてからスタートに戻す
  usePausableTimeout(
    () => {
      setRoute(null)
      setProgress(0)
      setPhase('solving')
    },
    phase === 'failed' ? FAIL_SHOW_MS : null,
    paused,
    fails,
  )

  /** この盤面の記録を残して、次の盤面へ(最後なら結果へ) */
  const goNext = (answered: boolean) => {
    const all = [...records, { taps, minTaps: minTurns(puzzles[index]), fails, ms: clearMs, hints, answered }]
    if (index + 1 >= total) {
      const details = all.map((r, i): DetailRow => {
        const parts = [`回転${r.taps}回(最少${r.minTaps}回)`, `つながらず${r.fails}回`]
        if (r.hints > 0) parts.push(`ヒント${r.hints}回`)
        if (r.answered) parts.push('こたえを見た')
        parts.push(formatDuration(r.ms))
        return {
          label: `${i + 1}面`,
          value: parts.join('・'),
          mark: !r.answered && r.fails === 0 && r.hints === 0 ? 'correct' : 'partial',
        }
      })
      onFinish({
        correct: details.filter((d) => d.mark === 'correct').length,
        total: all.length,
        errors: all.reduce((n, r) => n + r.fails, 0),
        extra: [
          { label: 'タイルを回した回数', value: `${all.reduce((n, r) => n + r.taps, 0)}回` },
          { label: '最少の回転数(目安)', value: `${all.reduce((n, r) => n + r.minTaps, 0)}回` },
          { label: 'ヒントを使った回数', value: `${all.reduce((n, r) => n + r.hints, 0)}回` },
          { label: 'こたえを見た面', value: `${all.filter((r) => r.answered).length}面` },
        ],
        details,
      })
      return
    }
    const next = puzzles[index + 1]
    setRecords(all)
    setIndex(index + 1)
    setBoard(next)
    setSpins(next.tiles.map((t) => t?.rot ?? 0))
    setRoute(null)
    setProgress(0)
    setTaps(0)
    setFails(0)
    setHints(0)
    setHintCell(null)
    setHintNote(null)
    setPhase('solving')
    clock.restart()
  }

  // ゴールしたら次の盤面へ
  usePausableTimeout(() => goNext(false), phase === 'goal' ? CLEAR_MS : null, paused, index)

  const showHint = () => {
    if (phase !== 'solving') return
    sound('tap')
    setHints((n) => n + 1)
    const cell = hintTile(board)
    setHintCell(cell)
    setHintNote(cell === null ? 'みちは つながって います。「しゅっぱつ」を おしましょう' : 'ひかって いる タイルを まわして みましょう')
  }

  const showAnswer = () => {
    if (phase !== 'solving') return
    const { puzzle, turns } = solvedPuzzle(board)
    setBoard(puzzle)
    setSpins((s) => s.map((v, i) => v + (turns.get(i) ?? 0)))
    setHintCell(null)
    setHintNote(null)
    setClearMs(clock.read())
    setPhase('answered')
  }

  // 盤面の左右に、スタートとゴールの入口を1マス分ずつとる
  const unit = Math.max(0, Math.min(stage.width / (cols + 2), stage.height / rows))
  const startRow = Math.floor(board.start / cols)
  const goalRow = Math.floor(board.goal / cols)
  const pose = route ? poseAt(route.pts, progress) : { x: -0.6, y: startRow + 0.5, dir: 1 as Dir }

  let message: { text: string; kind: FeedbackKind }
  if (phase === 'goal') message = { text: 'ゴール！', kind: 'correct' }
  else if (phase === 'failed') message = { text: 'みちが とぎれています。なおして もういちど', kind: 'info' }
  else if (phase === 'driving') message = { text: 'はしっています…', kind: 'info' }
  else if (phase === 'answered') message = { text: 'これが こたえです', kind: 'info' }
  else if (hintNote) message = { text: hintNote, kind: 'info' }
  else message = { text: 'つながったら「しゅっぱつ」', kind: 'info' }
  const onRoute = new Set(board.route)

  return (
    <div className="rr">
      <aside className="rr-side">
        <Progress current={index + 1} total={total} />
        <p className="rr-instruction">
          タイルを タップして
          <br />
          みちを まわし、
          <br />
          スタートから ゴールまで
          <br />
          つなげます
        </p>
        <Feedback kind={message.kind}>{message.text}</Feedback>
        {phase !== 'answered' && (
          <button type="button" className="btn btn-primary btn-lg" onClick={depart} disabled={phase !== 'solving'}>
            しゅっぱつ
          </button>
        )}
        <AssistBar
          answered={phase === 'answered'}
          disabled={phase !== 'solving'}
          onHint={showHint}
          onAnswer={showAnswer}
          onNext={() => goNext(true)}
        />
      </aside>

      <div className="rr-stage" ref={stageRef}>
        {unit > 0 && (
          <div className="rr-board" style={{ width: unit * (cols + 2), height: unit * rows }}>
            <div
              className="rr-grid"
              style={{
                left: unit,
                width: unit * cols,
                height: unit * rows,
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
              }}
            >
              {board.tiles.map((t, cell) => (
                <button
                  key={cell}
                  type="button"
                  className={[
                    'rr-tile',
                    t ? '' : 'is-empty',
                    route?.stopCell === cell && phase === 'failed' ? 'is-stop' : '',
                    hintCell === cell ? 'is-hint' : '',
                    phase === 'answered' && onRoute.has(cell) ? 'is-answer' : '',
                  ].join(' ')}
                  onPointerDown={() => press(cell)}
                  disabled={!t || phase !== 'solving'}
                  aria-label={t ? 'みちの タイル' : 'あきち'}
                >
                  {t && <TileArt shape={t.shape} spin={spins[cell]} />}
                </button>
              ))}
            </div>

            <svg
              className="rr-overlay"
              viewBox={`-1 0 ${cols + 2} ${rows}`}
              width={unit * (cols + 2)}
              height={unit * rows}
              aria-hidden="true"
            >
              {/* スタートの入口とゴールの出口 */}
              <line className="rr-gate" x1={-1} y1={startRow + 0.5} x2={0} y2={startRow + 0.5} />
              <line className="rr-gate" x1={cols} y1={goalRow + 0.5} x2={cols + 1} y2={goalRow + 0.5} />
              <Tag x={-0.5} y={startRow + 0.12} text="スタート" />
              <Tag x={cols + 0.5} y={goalRow + 0.12} text="ゴール" />
              <line className="rr-pole" x1={cols + 0.72} y1={goalRow + 0.75} x2={cols + 0.72} y2={goalRow + 0.3} />
              <path
                className="rr-flag"
                d={`M ${cols + 0.72} ${goalRow + 0.3} L ${cols + 0.96} ${goalRow + 0.39} L ${cols + 0.72} ${goalRow + 0.48} Z`}
              />
              <g transform={`translate(${pose.x} ${pose.y}) rotate(${CAR_ANGLE[pose.dir]}) scale(0.8)`}>
                <CarIcon />
              </g>
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}

function Tag({ x, y, text }: { x: number; y: number; text: string }) {
  const w = text.length * 0.15 + 0.12
  return (
    <g className="rr-tag">
      <rect x={x - w / 2} y={y - 0.11} width={w} height={0.22} rx={0.08} />
      <text x={x} y={y} dy="0.35em" textAnchor="middle">
        {text}
      </text>
    </g>
  )
}

/** 回す前の形を描き、spin 回分だけCSSで回す(回すときはアニメーションする) */
function TileArt({ shape, spin }: { shape: Shape; spin: number }) {
  const m = BASE[shape]
  const ends: [number, number][] = []
  if (m & 1) ends.push([0.5, 0])
  if (m & 2) ends.push([1, 0.5])
  if (m & 4) ends.push([0.5, 1])
  if (m & 8) ends.push([0, 0.5])
  return (
    <svg className="rr-art" viewBox="0 0 1 1" style={{ transform: `rotate(${spin * 90}deg)` }} aria-hidden="true">
      <g className="rr-road">
        {ends.map(([x, y]) => (
          <line key={`${x}-${y}`} x1={0.5} y1={0.5} x2={x} y2={y} />
        ))}
        <circle cx={0.5} cy={0.5} r={0.21} />
      </g>
      <g className="rr-lane">
        {ends.map(([x, y]) => (
          <line key={`${x}-${y}`} x1={0.5} y1={0.5} x2={x} y2={y} />
        ))}
      </g>
    </svg>
  )
}
