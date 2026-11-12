import { useState, type ReactNode } from 'react'
import { Feedback, Progress } from '../../components/Feedback'
import { average, useElementSize, usePausableTimeout, useTrialClock } from '../../core/hooks'
import { useSound } from '../../core/sound'
import { formatDuration } from '../../core/stopwatch'
import type { DetailRow, GameProps } from '../../core/types'
import {
  buildTrials,
  DIRECTION_LABEL,
  DIRECTION_LABEL_OT,
  GRID,
  isOpposite,
  LEVELS,
  type Block,
  type Direction,
  type View,
} from './logic'
import './viewpoint.css'

const NEXT_DELAY_MS = 900

/** 見取り図のまわりの立ち位置ボタンの大きさ(px) */
const SIDE_W = 112
const BAR_H = 76
const MAP_GAP = 8

/** 積み木の色と記号(色だけに頼らない) */
const BLOCK_STYLES = [
  { color: '#d1495b', name: 'あか', symbol: 'circle' },
  { color: '#2f6fd0', name: 'あお', symbol: 'triangle' },
  { color: '#e0a100', name: 'きいろ', symbol: 'square' },
  { color: '#2e9a5a', name: 'みどり', symbol: 'diamond' },
  { color: '#8b55c9', name: 'むらさき', symbol: 'star' },
] as const

type SymbolKind = (typeof BLOCK_STYLES)[number]['symbol']

const STAR_POINTS = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 === 0 ? 0.5 : 0.21
  const a = -Math.PI / 2 + (i * Math.PI) / 5
  return `${(r * Math.cos(a)).toFixed(3)},${(0.05 + r * Math.sin(a)).toFixed(3)}`
}).join(' ')

/** 中心(0,0)・大きさ1の白い記号。transform で位置と大きさを決める */
function SymbolMark({ kind, x, y, size }: { kind: SymbolKind; x: number; y: number; size: number }) {
  const p = {
    fill: '#fff',
    stroke: 'rgba(0,0,0,0.35)',
    strokeWidth: 0.05,
    strokeLinejoin: 'round' as const,
  }
  let shape: ReactNode
  switch (kind) {
    case 'circle':
      shape = <circle r={0.36} {...p} />
      break
    case 'triangle':
      shape = <polygon points="0,-0.44 0.48,0.4 -0.48,0.4" {...p} />
      break
    case 'square':
      shape = <rect x={-0.34} y={-0.34} width={0.68} height={0.68} {...p} />
      break
    case 'diamond':
      shape = <polygon points="0,-0.5 0.5,0 0,0.5 -0.5,0" {...p} />
      break
    case 'star':
      shape = <polygon points={STAR_POINTS} {...p} />
      break
  }
  return <g transform={`translate(${x} ${y}) scale(${size})`}>{shape}</g>
}

/** 立ち位置から見た絵(立面図)。奥の積み木から順に描き、手前の積み木が奥を隠す */
function ElevationView({ view, maxHeight }: { view: View; maxHeight: number }) {
  const top = maxHeight + 0.35
  return (
    <svg className="vp-elev" viewBox={`-0.35 ${-top} ${GRID + 0.7} ${top + 0.45}`} aria-hidden="true">
      {/* 机の天板(横から見た厚み) */}
      <rect x={-0.3} y={0} width={GRID + 0.6} height={0.22} rx={0.05} fill="#c9a06a" stroke="#9a7240" strokeWidth={0.03} />
      {view.blocks.map((b) => {
        if (!b.visible) return null
        // 奥にある積み木ほど少し細く描いて、後ろにあることを分かりやすくする
        const w = 0.84 - 0.16 * b.rank
        const x = b.slot + (1 - w) / 2
        const s = BLOCK_STYLES[b.color]
        const mid = -(b.visible.from + b.visible.to) / 2
        return (
          <g key={b.color}>
            <rect
              x={x}
              y={-b.height}
              width={w}
              height={b.height}
              rx={0.04}
              fill={s.color}
              stroke="rgba(0,0,0,0.45)"
              strokeWidth={0.03}
            />
            {/* 段の区切り線 */}
            {Array.from({ length: b.height - 1 }, (_, k) => (
              <line
                key={k}
                x1={x}
                x2={x + w}
                y1={-(k + 1)}
                y2={-(k + 1)}
                stroke="rgba(0,0,0,0.35)"
                strokeWidth={0.025}
              />
            ))}
            {/* 奥の積み木は白っぽくして、上に積まれているのではなく「うしろ」にあると分かるようにする */}
            {b.rank > 0 && (
              <rect x={x} y={-b.height} width={w} height={b.height} rx={0.04} fill="#fff" opacity={Math.min(0.5, 0.3 * b.rank)} />
            )}
            <SymbolMark kind={s.symbol} x={b.slot + 0.5} y={mid} size={Math.min(0.42, w * 0.55)} />
          </g>
        )
      })}
    </svg>
  )
}

/** 机を真上から見た図。高さがそろっていないときは段数を数字で添える */
function TableMap({ blocks }: { blocks: Block[] }) {
  const showHeight = new Set(blocks.map((b) => b.height)).size > 1
  const pad = 0.12
  return (
    <svg className="vp-table" viewBox={`${-pad} ${-pad} ${GRID + pad * 2} ${GRID + pad * 2}`} aria-hidden="true">
      <rect x={-pad} y={-pad} width={GRID + pad * 2} height={GRID + pad * 2} rx={0.12} fill="#e9d3ad" stroke="#9a7240" strokeWidth={0.04} />
      {/* マスの目安(うすい点線) */}
      {Array.from({ length: GRID - 1 }, (_, i) => (
        <g key={i} stroke="#c4a372" strokeWidth={0.02} strokeDasharray="0.06 0.06">
          <line x1={i + 1} x2={i + 1} y1={0} y2={GRID} />
          <line y1={i + 1} y2={i + 1} x1={0} x2={GRID} />
        </g>
      ))}
      {blocks.map((b) => {
        const s = BLOCK_STYLES[b.color]
        return (
          <g key={b.color}>
            <rect
              x={b.col + 0.13}
              y={b.row + 0.13}
              width={0.74}
              height={0.74}
              rx={0.06}
              fill={s.color}
              stroke="rgba(0,0,0,0.45)"
              strokeWidth={0.03}
            />
            <SymbolMark kind={s.symbol} x={b.col + 0.5} y={b.row + 0.5} size={0.4} />
            {showHeight && (
              <g>
                <circle cx={b.col + 0.84} cy={b.row + 0.16} r={0.17} fill="#fff" stroke="#1d2320" strokeWidth={0.03} />
                <text
                  x={b.col + 0.84}
                  y={b.row + 0.165}
                  fontSize={0.24}
                  fontWeight={800}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#1d2320"
                >
                  {b.height}
                </text>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** 立ち位置ボタンの矢印(机の方を向く) */
const ARROW: Record<Direction, string> = { front: '▲', back: '▼', left: '▶', right: '◀' }

interface TrialRecord {
  /** 選んだ方向(順番どおり) */
  picks: Direction[]
  solved: boolean
  firstResponseMs: number
}

export default function ViewpointGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const cfg = LEVELS[difficulty]
  const [trials] = useState(() => buildTrials(difficulty, mode))
  const total = trials.length
  const maxWrong = cfg.choices === 2 ? 1 : 2
  const [index, setIndex] = useState(0)
  const [records, setRecords] = useState<TrialRecord[]>([])
  const [wrong, setWrong] = useState<Direction[]>([])
  const [state, setState] = useState<'answering' | 'correct' | 'reveal'>('answering')
  const [firstMs, setFirstMs] = useState<number | null>(null)
  const clock = useTrialClock(paused)
  const [mapRef, mapBox] = useElementSize<HTMLDivElement>()

  const trial = trials[index]
  const locked = state !== 'answering'

  const finish = (all: TrialRecord[]) => {
    const details: DetailRow[] = all.map((r, i) => {
      const t = trials[i]
      const tries = r.picks.length
      const misses = r.picks.filter((d) => d !== t.answer).map((d) => DIRECTION_LABEL_OT[d])
      const result = r.solved ? (tries === 1 ? '1回で正解' : `${tries}回目で正解`) : '正解できず'
      const note = `正答: ${DIRECTION_LABEL_OT[t.answer]}${misses.length ? `・誤: ${misses.join('、')}` : ''}`
      return {
        label: `${i + 1}問目`,
        value: `${result}(${note})`,
        mark: !r.solved ? 'wrong' : tries === 1 ? 'correct' : 'partial',
      }
    })
    const avg = average(all.map((r) => r.firstResponseMs))
    const opposite = all.reduce(
      (n, r, i) => n + r.picks.filter((d) => d !== trials[i].answer && isOpposite(d, trials[i].answer)).length,
      0,
    )
    onFinish({
      correct: all.filter((r) => r.solved && r.picks.length === 1).length,
      total: all.length,
      errors: all.reduce((n, r, i) => n + r.picks.filter((d) => d !== trials[i].answer).length, 0),
      extra: [
        ...(avg === null ? [] : [{ label: '平均反応時間', value: formatDuration(avg) }]),
        { label: '反対側(左右逆の絵)を選んだ回数', value: `${opposite}回` },
      ],
      details,
    })
  }

  const goNext = () => {
    const picks = state === 'correct' ? [...wrong, trial.answer] : wrong
    const rec: TrialRecord = { picks, solved: state === 'correct', firstResponseMs: firstMs ?? clock.read() }
    const all = [...records, rec]
    if (index + 1 >= total) {
      finish(all)
      return
    }
    setRecords(all)
    setIndex(index + 1)
    setWrong([])
    setState('answering')
    setFirstMs(null)
    clock.restart()
  }

  usePausableTimeout(goNext, state === 'correct' ? NEXT_DELAY_MS : null, paused, index)

  const choose = (d: Direction) => {
    if (locked || wrong.includes(d)) return
    if (firstMs === null) setFirstMs(clock.read())
    if (d === trial.answer) {
      sound('correct')
      setState('correct')
      return
    }
    sound('wrong')
    const w = [...wrong, d]
    setWrong(w)
    if (w.length >= maxWrong) setState('reveal')
  }

  // 見取り図(机)の大きさ: まわりのボタンの分を引いた正方形
  const tablePx = Math.max(
    0,
    Math.floor(Math.min(mapBox.width - 2 * (SIDE_W + MAP_GAP), mapBox.height - 2 * (BAR_H + MAP_GAP))),
  )

  const seat = (d: Direction) => {
    if (!trial.choices.includes(d)) return <div className={`vp-seat-empty vp-at-${d}`} />
    const isWrong = wrong.includes(d)
    const showAnswer = locked && d === trial.answer
    return (
      <button
        type="button"
        className={`vp-seat vp-at-${d} ${isWrong ? 'is-wrong' : ''} ${showAnswer ? 'is-answer' : ''}`}
        onClick={() => choose(d)}
        disabled={locked || isWrong}
        aria-label={DIRECTION_LABEL[d]}
      >
        <span className="vp-seat-label">{DIRECTION_LABEL[d]}</span>
        <span className="vp-seat-arrow" aria-hidden="true">
          {isWrong ? '✕' : ARROW[d]}
        </span>
      </button>
    )
  }

  return (
    <div className="vp">
      <div className="vp-head">
        <Progress current={index + 1} total={total} />
        <p className="task-instruction">この え は どこから みた え ですか？</p>
        <Feedback kind={state === 'correct' ? 'correct' : state === 'reveal' ? 'info' : wrong.length > 0 ? 'wrong' : null}>
          {state === 'correct' && 'せいかい！'}
          {state === 'reveal' && (
            <>
              みどりの ところが こたえです
              <button type="button" className="btn btn-primary" onClick={goNext}>
                つぎへ
              </button>
            </>
          )}
          {state === 'answering' && wrong.length > 0 && 'ちがいます。もういちど えらんで ください。'}
        </Feedback>
      </div>

      <div className="vp-body">
        <figure className="vp-view">
          <figcaption>この え</figcaption>
          <ElevationView view={trial.view} maxHeight={cfg.maxHeight} />
        </figure>

        <div className="vp-map" ref={mapRef}>
          <div
            className="vp-map-grid"
            style={{
              gridTemplateColumns: `${SIDE_W}px ${tablePx}px ${SIDE_W}px`,
              gridTemplateRows: `${BAR_H}px ${tablePx}px ${BAR_H}px`,
              gap: MAP_GAP,
            }}
          >
            {seat('back')}
            {seat('left')}
            <div className="vp-table-wrap">
              <TableMap blocks={trial.blocks} />
            </div>
            {seat('right')}
            {seat('front')}
          </div>
        </div>
      </div>
    </div>
  )
}
