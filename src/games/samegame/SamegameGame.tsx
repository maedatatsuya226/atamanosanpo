import { useRef, useState } from 'react'
import { Feedback } from '../../components/Feedback'
import { useElementSize, usePausableTimeout } from '../../core/hooks'
import { useSound } from '../../core/sound'
import type { GameProps } from '../../core/types'
import { configFor, countBlocks, findGroup, generateBoard, hasMoves, removeCells } from './logic'
import './samegame.css'

/** 消せる所がなくなってから結果画面へ進むまでの待ち時間 */
const END_DELAY_MS = 1800
const WRONG_FLASH_MS = 400
/** 1マスの最大サイズ(練習の小さい盤面が大きくなりすぎないように) */
const MAX_CELL_PX = 150

/**
 * 色ごとの見た目。色覚の違いがあっても区別できるよう、色と白い記号を必ず組み合わせる。
 * 色は赤・青・黄・緑・紫で、明るさも少しずつずらしている。
 */
const BLOCK_STYLES = [
  { color: '#d1495b', name: 'あか', symbol: 'circle' },
  { color: '#2f6fd0', name: 'あお', symbol: 'triangle' },
  { color: '#d99a00', name: 'きいろ', symbol: 'square' },
  { color: '#2e9a5a', name: 'みどり', symbol: 'diamond' },
  { color: '#8b55c9', name: 'むらさき', symbol: 'star' },
] as const

type SymbolKind = (typeof BLOCK_STYLES)[number]['symbol']

/** 星形の頂点(中心 50,52) */
const STAR_POINTS = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 === 0 ? 30 : 13
  const a = -Math.PI / 2 + (i * Math.PI) / 5
  return `${(50 + r * Math.cos(a)).toFixed(1)},${(53 + r * Math.sin(a)).toFixed(1)}`
}).join(' ')

function BlockSymbol({ kind }: { kind: SymbolKind }) {
  const p = { fill: '#fff', stroke: 'rgba(0,0,0,0.3)', strokeWidth: 2.5, strokeLinejoin: 'round' as const }
  switch (kind) {
    case 'circle':
      return <circle cx={50} cy={50} r={21} {...p} />
    case 'triangle':
      return <polygon points="50,24 77,72 23,72" {...p} />
    case 'square':
      return <rect x={30} y={30} width={40} height={40} rx={3} {...p} />
    case 'diamond':
      return <polygon points="50,21 79,50 50,79 21,50" {...p} />
    case 'star':
      return <polygon points={STAR_POINTS} {...p} />
  }
}

function BlockFace({ color }: { color: number }) {
  const s = BLOCK_STYLES[color]
  return (
    <svg className="sg-svg" viewBox="0 0 100 100" aria-hidden="true">
      <rect x={3} y={3} width={94} height={94} rx={14} fill={s.color} />
      <rect x={3} y={3} width={94} height={94} rx={14} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth={3} />
      <BlockSymbol kind={s.symbol} />
    </svg>
  )
}

type EndReason = 'cleared' | 'nomoves' | 'quit'

export default function SamegameGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const [cfg] = useState(() => configFor(difficulty, mode))
  const [grid, setGrid] = useState(() => generateBoard(cfg))
  const [moves, setMoves] = useState(0)
  const [errors, setErrors] = useState(0)
  const [wrongTap, setWrongTap] = useState<{ id: number; n: number } | null>(null)
  const [lastWasError, setLastWasError] = useState(false)
  const [ended, setEnded] = useState<Exclude<EndReason, 'quit'> | null>(null)
  const finished = useRef(false)
  const [stageRef, stage] = useElementSize<HTMLDivElement>()

  const total = cfg.cols * cfg.rows
  const remaining = countBlocks(grid)

  const finish = (reason: EndReason) => {
    if (finished.current) return
    finished.current = true
    const ending = reason === 'cleared' ? 'すべて消した' : reason === 'nomoves' ? '消せる所なし' : '途中で終了'
    onFinish({
      correct: total - remaining,
      total,
      errors,
      extra: [
        { label: '残ったブロック', value: `${remaining}個` },
        { label: '手数', value: `${moves}回` },
      ],
      details: [
        {
          label: `${cfg.cols}×${cfg.rows}・${cfg.colors}色`,
          value: `${ending}・${total - remaining}/${total}個消した`,
          mark: reason === 'cleared' ? 'correct' : null,
        },
      ],
    })
  }

  usePausableTimeout(() => ended && finish(ended), ended ? END_DELAY_MS : null, paused)
  usePausableTimeout(() => setWrongTap(null), wrongTap ? WRONG_FLASH_MS : null, false, wrongTap?.n)

  const press = (row: number, col: number) => {
    if (ended || finished.current) return
    const group = findGroup(grid, row, col)
    if (group.length === 0) return
    if (group.length === 1) {
      // ひとつだけのブロックは消えない(やさしい音とゆれで知らせる)
      sound('wrong')
      setErrors(errors + 1)
      setLastWasError(true)
      setWrongTap({ id: grid[row][col]!.id, n: (wrongTap?.n ?? 0) + 1 })
      return
    }
    const next = removeCells(grid, group)
    setGrid(next)
    setMoves(moves + 1)
    setLastWasError(false)
    setWrongTap(null)
    if (!hasMoves(next)) {
      const cleared = countBlocks(next) === 0
      sound(cleared ? 'correct' : 'tap')
      setEnded(cleared ? 'cleared' : 'nomoves')
    } else {
      sound('tap')
    }
  }

  const cell = Math.max(0, Math.min(MAX_CELL_PX, Math.floor(Math.min(stage.width / cfg.cols, stage.height / cfg.rows))))

  return (
    <div className="sg">
      <aside className="sg-side">
        <p className="sg-instruction">
          おなじ いろが
          <br />
          となりあった ところを
          <br />
          タップして けします
        </p>
        <div className="sg-count">
          のこり <strong>{remaining}</strong> こ
        </div>
        <Feedback kind={ended === 'cleared' ? 'correct' : ended ? 'info' : lastWasError ? 'wrong' : null}>
          {ended === 'cleared' && 'ぜんぶ けせました！'}
          {ended === 'nomoves' && 'もう けせる ところが ありません。おつかれさまでした。'}
          {!ended && lastWasError && 'ひとつだけ では きえません'}
        </Feedback>
        {!ended && (
          <button type="button" className="btn btn-ghost btn-lg sg-quit" onClick={() => finish('quit')}>
            ここで おわる
          </button>
        )}
      </aside>

      <div className="sg-stage" ref={stageRef}>
        <div className="sg-board" style={{ width: cell * cfg.cols, height: cell * cfg.rows }}>
          {grid.flatMap((cells, r) =>
            cells.map((b, c) =>
              b ? (
                <button
                  key={b.id}
                  type="button"
                  className="sg-block"
                  style={{ width: cell, height: cell, transform: `translate(${c * cell}px, ${r * cell}px)` }}
                  onPointerDown={() => press(r, c)}
                  aria-label={BLOCK_STYLES[b.color].name}
                >
                  <span
                    key={wrongTap?.id === b.id ? wrongTap.n : 0}
                    className={`sg-face ${wrongTap?.id === b.id ? 'is-wrong' : ''}`}
                  >
                    <BlockFace color={b.color} />
                  </span>
                </button>
              ) : null,
            ),
          )}
        </div>
      </div>
    </div>
  )
}
