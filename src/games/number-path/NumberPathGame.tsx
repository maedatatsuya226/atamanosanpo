import { useState } from 'react'
import { Feedback, Progress } from '../../components/Feedback'
import { useElementSize, usePausableTimeout, useTrialClock } from '../../core/hooks'
import { useSound } from '../../core/sound'
import { formatDuration } from '../../core/stopwatch'
import type { DetailRow, GameProps } from '../../core/types'
import { BOARDS, buildBoard, isAdjacent, nextMoves } from './logic'
import './number-path.css'

const CLEAR_MS = 1300
const WRONG_FLASH_MS = 350

interface BoardRecord {
  errors: number
  backtracks: number
  ms: number
}

export default function NumberPathGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const total = BOARDS[mode]
  const [boards] = useState(() => Array.from({ length: total }, () => buildBoard(difficulty)))
  const [index, setIndex] = useState(0)
  const [trail, setTrail] = useState<number[]>(() => [boards[0].path[0]])
  const [errors, setErrors] = useState(0)
  const [backtracks, setBacktracks] = useState(0)
  const [records, setRecords] = useState<BoardRecord[]>([])
  const [cleared, setCleared] = useState(false)
  /** ゴールした時点の所要時間 */
  const [clearMs, setClearMs] = useState(0)
  const [wrongCell, setWrongCell] = useState<{ cell: number; n: number } | null>(null)
  const clock = useTrialClock(paused)
  const [stageRef, stage] = useElementSize<HTMLDivElement>()

  const board = boards[index]
  const { size, values } = board
  const current = trail[trail.length - 1]
  const goal = board.path[board.path.length - 1]
  const visited = new Set(trail)
  const stuck = !cleared && current !== goal && nextMoves(values, size, current).every((m) => visited.has(m))

  const finish = (all: BoardRecord[]) => {
    const details: DetailRow[] = all.map((r, i) => ({
      label: `${i + 1}面`,
      value: `ミス${r.errors}回・もどる${r.backtracks}回・${formatDuration(r.ms)}`,
      mark: r.errors === 0 && r.backtracks === 0 ? 'correct' : 'partial',
    }))
    onFinish({
      correct: all.filter((r) => r.errors === 0 && r.backtracks === 0).length,
      total: all.length,
      errors: all.reduce((n, r) => n + r.errors, 0),
      extra: [{ label: 'もどった回数', value: `${all.reduce((n, r) => n + r.backtracks, 0)}回` }],
      details,
    })
  }

  usePausableTimeout(
    () => {
      const all = [...records, { errors, backtracks, ms: clearMs }]
      if (index + 1 >= total) {
        finish(all)
        return
      }
      setRecords(all)
      setIndex(index + 1)
      setTrail([boards[index + 1].path[0]])
      setErrors(0)
      setBacktracks(0)
      setCleared(false)
      clock.restart()
    },
    cleared ? CLEAR_MS : null,
    paused,
    index,
  )

  usePausableTimeout(() => setWrongCell(null), wrongCell ? WRONG_FLASH_MS : null, false, wrongCell?.n)

  const undo = () => {
    if (cleared || trail.length <= 1) return
    sound('tap')
    setTrail(trail.slice(0, -1))
    setBacktracks(backtracks + 1)
  }

  const press = (cell: number) => {
    if (cleared) return
    if (trail.length > 1 && cell === trail[trail.length - 2]) {
      undo()
      return
    }
    if (cell === current) return
    const ok = isAdjacent(current, cell, size) && values[cell] === values[current] + 1 && !visited.has(cell)
    if (!ok) {
      sound('wrong')
      setErrors(errors + 1)
      setWrongCell({ cell, n: (wrongCell?.n ?? 0) + 1 })
      return
    }
    const next = [...trail, cell]
    setTrail(next)
    if (cell === goal) {
      sound('correct')
      setCleared(true)
      setClearMs(clock.read())
    } else {
      sound('tap')
    }
  }

  const boardPx = Math.max(0, Math.min(stage.width, stage.height))

  return (
    <div className="np">
      <aside className="np-side">
        <Progress current={index + 1} total={total} />
        <p className="np-instruction">
          1から じゅんばんに
          <br />
          となりの マスへ すすみ
          <br />
          ゴールを めざします
        </p>
        <div className="np-next">
          つぎは <strong>{cleared ? '—' : values[current] + 1}</strong>
        </div>
        <Feedback kind={cleared ? 'correct' : stuck ? 'info' : null}>
          {cleared ? 'ゴール！' : stuck ? 'この先へ すすめません。もどって ください' : null}
        </Feedback>
        <button type="button" className="btn btn-secondary btn-lg" onClick={undo} disabled={cleared || trail.length <= 1}>
          ひとつ もどる
        </button>
      </aside>

      <div className="np-stage" ref={stageRef}>
        <div
          className="np-board"
          style={{
            width: boardPx,
            height: boardPx,
            gridTemplateColumns: `repeat(${size}, 1fr)`,
            fontSize: boardPx / size / 2.6,
          }}
        >
          {values.map((v, cell) => {
            const order = trail.indexOf(cell)
            const cls = [
              'np-cell',
              order >= 0 ? 'is-visited' : '',
              cell === current ? 'is-current' : '',
              cell === goal ? 'is-goal' : '',
              wrongCell?.cell === cell ? 'is-wrong' : '',
            ].join(' ')
            return (
              <button key={cell} type="button" className={cls} onPointerDown={() => press(cell)} aria-label={`${v}`}>
                <span className="np-num">{v}</span>
                {cell === board.path[0] && <span className="np-tag">スタート</span>}
                {cell === goal && <span className="np-tag">ゴール</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
