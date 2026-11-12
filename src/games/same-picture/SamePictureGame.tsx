import { useEffect, useState } from 'react'
import { Feedback } from '../../components/Feedback'
import { average, useElementSize, usePausableTimeout, useTrialClock } from '../../core/hooks'
import { useSound } from '../../core/sound'
import { formatDuration } from '../../core/stopwatch'
import type { DetailRow, GameProps } from '../../core/types'
import { buildRound, countBySide, LEVELS, type Round } from './logic'
import './same-picture.css'

/** ぜんぶ見つけてから結果へ進むまで */
const ALL_FOUND_MS = 1200
/** 「おわり」のあと、見落とした絵を見せておく時間 */
const SHOW_MISSED_MS = 2500
const WRONG_FLASH_MS = 500

type Ending = 'all' | 'button'

export default function SamePictureGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const [stageRef, stage] = useElementSize<HTMLDivElement>()
  // 配置は画面の大きさ(縦向き・横向き)がわかってから1回だけ作る
  const [round, setRound] = useState<Round | null>(null)
  const [found, setFound] = useState<ReadonlySet<number>>(() => new Set())
  /** 1個見つけるまでにかかった時間(前に見つけたときから) */
  const [times, setTimes] = useState<number[]>([])
  const [wrongTaps, setWrongTaps] = useState<{ index: number; similar: boolean }[]>([])
  const [wrong, setWrong] = useState<{ index: number; n: number } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [ending, setEnding] = useState<Ending | null>(null)
  const clock = useTrialClock(paused)

  useEffect(() => {
    if (round || stage.width === 0 || stage.height === 0) return
    setRound(buildRound(difficulty, mode, { width: Math.round(stage.width), height: Math.round(stage.height) }))
    clock.restart()
  }, [round, stage, difficulty, mode, clock])

  const items = round?.items ?? []
  const nTargets = items.filter((it) => it.isTarget).length

  const finish = () => {
    if (!round) return
    const sides = countBySide(round, found)
    const missL = sides.left.total - sides.left.found
    const missR = sides.right.total - sides.right.found
    const avg = average(times)
    const markOf = (s: { found: number; total: number }) =>
      s.found === s.total ? ('correct' as const) : s.found > 0 ? ('partial' as const) : ('wrong' as const)
    const similarWrong = wrongTaps.filter((w) => w.similar).length
    const details: DetailRow[] = [
      { label: '左半分', value: `${sides.left.found} / ${sides.left.total}個 見つけた`, mark: markOf(sides.left) },
      { label: '右半分', value: `${sides.right.found} / ${sides.right.total}個 見つけた`, mark: markOf(sides.right) },
      {
        label: 'まちがいタップ',
        value:
          LEVELS[difficulty].similarKinds > 0
            ? `${wrongTaps.length}回(うち似た絵 ${similarWrong}回)`
            : `${wrongTaps.length}回`,
        mark: null,
      },
      {
        label: '終わり方',
        value: ending === 'all' ? 'すべて見つけて自動で終了' : '「おわり」ボタンで終了',
        mark: null,
      },
    ]
    onFinish({
      correct: sides.left.found + sides.right.found,
      total: sides.left.total + sides.right.total,
      errors: wrongTaps.length,
      extra: [
        { label: '見落とし(左)', value: `${missL}個` },
        { label: '見落とし(右)', value: `${missR}個` },
        { label: '1個見つける平均時間', value: avg === null ? '—' : formatDuration(avg) },
      ],
      details,
    })
  }

  usePausableTimeout(finish, ending ? (ending === 'all' ? ALL_FOUND_MS : SHOW_MISSED_MS) : null, paused, ending)
  usePausableTimeout(() => setWrong(null), wrong ? WRONG_FLASH_MS : null, false, wrong?.n)

  const press = (i: number) => {
    if (!round || ending || paused) return
    const it = items[i]
    if (it.isTarget) {
      if (found.has(i)) return
      const next = new Set(found)
      next.add(i)
      setFound(next)
      setTimes([...times, clock.read()])
      clock.restart()
      if (next.size === nTargets) {
        sound('done')
        setConfirming(false)
        setEnding('all')
      } else {
        sound('correct')
      }
      return
    }
    sound('wrong')
    setWrongTaps([...wrongTaps, { index: i, similar: it.similar }])
    setWrong({ index: i, n: (wrong?.n ?? 0) + 1 })
  }

  const endByButton = () => {
    if (ending) return
    sound('tap')
    setConfirming(false)
    setEnding('button')
  }

  const feedback = (() => {
    if (ending === 'all') return <Feedback kind="correct">ぜんぶ みつけました！</Feedback>
    if (ending === 'button')
      return (
        <Feedback kind="info">{found.size < nTargets ? 'のこりは ここでした' : 'ぜんぶ みつけました！'}</Feedback>
      )
    return <Feedback kind={wrong ? 'wrong' : null}>{wrong ? 'ちがう え です' : null}</Feedback>
  })()

  return (
    <div className="sp">
      <div className="sp-head">
        <div className="sp-sample" aria-label="みほん">
          <span className="sp-sample-label">みほん</span>
          <span className="sp-sample-emoji">{round?.sample ?? ''}</span>
        </div>
        <p className="task-instruction sp-instruction">
          みほんと おなじ え を<wbr /> ぜんぶ タップ
        </p>
        <div className="sp-feedback">{feedback}</div>
        <button
          type="button"
          className="btn btn-secondary btn-lg sp-end"
          onClick={() => {
            sound('tap')
            setConfirming(true)
          }}
          disabled={!round || ending !== null || confirming}
        >
          おわり
        </button>
      </div>

      <div className="sp-stage" ref={stageRef}>
        {/* まちがって押したときのために、ひとこと確認する(見出しの高さを変えないよう、絵の上に重ねる) */}
        {confirming && !ending && (
          <div className="sp-confirm" role="dialog" aria-label="おわりの かくにん">
            <div className="sp-confirm-card">
              <p className="sp-confirm-text">おわりに しますか？</p>
              <div className="sp-confirm-actions">
                <button type="button" className="btn btn-primary btn-lg" onClick={endByButton}>
                  おわる
                </button>
                <button type="button" className="btn btn-secondary btn-lg" onClick={() => setConfirming(false)}>
                  つづける
                </button>
              </div>
            </div>
          </div>
        )}
        {round && (
          <svg
            className="sp-field"
            viewBox={`0 0 ${round.field.width} ${round.field.height}`}
            preserveAspectRatio="xMidYMid meet"
            role="group"
            aria-label="え の ならび"
          >
            <rect x={0} y={0} width={round.field.width} height={round.field.height} rx={18} className="sp-bg" />
            {items.map((it, i) => {
              const isFound = found.has(i)
              const isWrong = wrong?.index === i
              const isMissed = ending === 'button' && it.isTarget && !isFound
              return (
                <g
                  key={i}
                  className={`sp-item ${isFound ? 'is-found' : ''} ${isWrong ? 'is-wrong' : ''}`}
                  onPointerDown={() => press(i)}
                >
                  {/* 当たり判定は格子の1マス全体(となりと重ならない) */}
                  <rect x={it.cell.x} y={it.cell.y} width={it.cell.width} height={it.cell.height} className="sp-hit" />
                  {(isFound || isWrong) && <circle cx={it.x} cy={it.y} r={round.ringR} className="sp-back" />}
                  <text
                    x={it.x}
                    y={it.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={round.fontSize}
                    className="sp-emoji"
                  >
                    {it.emoji}
                  </text>
                  {isFound && (
                    <circle cx={it.x} cy={it.y} r={round.ringR} className="sp-ring" strokeWidth={round.fontSize * 0.11} />
                  )}
                  {isMissed && (
                    <circle cx={it.x} cy={it.y} r={round.ringR} className="sp-missed" strokeWidth={round.fontSize * 0.09} />
                  )}
                </g>
              )
            })}
          </svg>
        )}
      </div>
    </div>
  )
}
