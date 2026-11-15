import { useEffect, useState } from 'react'
import { Feedback, Progress } from '../../components/Feedback'
import { usePausableTimeout } from '../../core/hooks'
import { useSound } from '../../core/sound'
import type { DetailRow, GameProps } from '../../core/types'
import { buildRound, configFor, ROUNDS, scoreRound, studyMs, type Item, type RoundScore } from './logic'
import './shopping-memo.css'

type Phase = 'study' | 'delay' | 'recall' | 'review'

export default function ShoppingMemoGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const cfg = configFor(difficulty, mode)
  const total = ROUNDS[mode]
  const [rounds] = useState(() => Array.from({ length: total }, () => buildRound(cfg)))
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('study')
  const [remaining, setRemaining] = useState(cfg.delaySec)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [scores, setScores] = useState<RoundScore[]>([])
  const round = rounds[index]
  const last = scores[scores.length - 1]

  // 待っている途中で一時停止したら、再開時に待ち時間を最初から数え直す
  useEffect(() => {
    if (paused && phase === 'delay') setRemaining(cfg.delaySec)
  }, [paused, phase, cfg.delaySec])

  const endStudy = () => {
    if (cfg.delaySec > 0) {
      setRemaining(cfg.delaySec)
      setPhase('delay')
    } else {
      setPhase('recall')
    }
  }

  usePausableTimeout(endStudy, phase === 'study' ? studyMs(cfg) : null, paused, `${index}-study`)
  usePausableTimeout(
    () => {
      if (remaining <= 1) setPhase('recall')
      else setRemaining(remaining - 1)
    },
    phase === 'delay' ? 1000 : null,
    paused,
    `${index}-${remaining}`,
  )

  const toggle = (it: Item) => {
    if (phase !== 'recall') return
    sound('tap')
    // すばやく続けて押しても取りこぼさないよう、直前の状態から更新する
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(it.name)) next.delete(it.name)
      else next.add(it.name)
      return next
    })
  }

  const submit = () => {
    const s = scoreRound(round, selected)
    if (s.hits === s.total && s.falseAlarms === 0) sound('correct')
    setScores([...scores, s])
    setPhase('review')
  }

  const next = () => {
    if (index + 1 >= total) {
      const details: DetailRow[] = scores.map((s, i) => ({
        label: `${i + 1}回目`,
        value: `${s.total}こ中${s.hits}こ・まちがい${s.falseAlarms}こ`,
        mark: s.hits === s.total && s.falseAlarms === 0 ? 'correct' : s.hits > 0 ? 'partial' : 'wrong',
      }))
      onFinish({
        correct: scores.reduce((n, s) => n + s.hits, 0),
        total: scores.reduce((n, s) => n + s.total, 0),
        errors: scores.reduce((n, s) => n + s.falseAlarms, 0),
        extra: [
          { label: '見落とし', value: `${scores.reduce((n, s) => n + s.misses, 0)}こ` },
          { label: '待ち時間', value: cfg.delaySec > 0 ? `${cfg.delaySec}秒` : 'なし' },
        ],
        details,
      })
      return
    }
    setIndex(index + 1)
    setSelected(new Set())
    setPhase('study')
  }

  const memoNames = new Set(round.memo.map((m) => m.name))
  const stateOf = (it: Item): string => {
    const sel = selected.has(it.name)
    if (phase !== 'review') return sel ? 'is-selected' : ''
    if (memoNames.has(it.name)) return sel ? 'is-hit' : 'is-miss'
    return sel ? 'is-false' : 'is-faded'
  }
  const perfect = last && last.hits === last.total && last.falseAlarms === 0

  let instruction = ''
  if (phase === 'study') instruction = 'かいもの メモを おぼえて ください'
  else if (phase === 'delay') instruction = 'すこし まって ください'
  else if (phase === 'recall') instruction = 'メモに あった しなものを ぜんぶ えらんで ください'

  return (
    <div className="sm">
      <div className="sm-head">
        <Progress current={index + 1} total={total} />
        {phase === 'review' ? (
          <Feedback kind={perfect ? 'correct' : 'info'}>
            {perfect ? 'ぜんぶ せいかい！' : `${last.total}こ ちゅう ${last.hits}こ えらべました`}
          </Feedback>
        ) : (
          <p className="task-instruction">{instruction}</p>
        )}
      </div>

      <div className="sm-stage">
        {phase === 'study' && (
          <div className="sm-memo" aria-label="かいもの メモ">
            <p className="sm-memo-title">かいもの メモ</p>
            <ul>
              {round.memo.map((m) => (
                <li key={m.name}>{m.name}</li>
              ))}
            </ul>
          </div>
        )}
        {phase === 'delay' && (
          <div className="sm-wait" aria-live="polite">
            <span className="sm-wait-num">{remaining}</span>
            <span className="sm-wait-unit">びょう</span>
          </div>
        )}
        {(phase === 'recall' || phase === 'review') && (
          <div
            className="sm-shelf"
            key={`${index}-shelf`}
            // 2段にそろえて並べる(8こなら 4こ×2段)
            style={{ gridTemplateColumns: `repeat(${Math.ceil(round.shelf.length / 2)}, minmax(0, 1fr))` }}
          >
            {round.shelf.map((it) =>
              phase === 'recall' ? (
                <button
                  key={it.name}
                  type="button"
                  className={`sm-item ${stateOf(it)}`}
                  onClick={() => toggle(it)}
                  aria-pressed={selected.has(it.name)}
                >
                  <ItemFace it={it} />
                  {selected.has(it.name) && <span className="sm-badge sm-badge-sel">✓</span>}
                </button>
              ) : (
                <div key={it.name} className={`sm-item ${stateOf(it)}`}>
                  <ItemFace it={it} />
                  {memoNames.has(it.name) && <span className="sm-badge sm-badge-ok">○</span>}
                  {!memoNames.has(it.name) && selected.has(it.name) && <span className="sm-badge sm-badge-ng">✕</span>}
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <div className="sm-foot">
        {phase === 'study' && (
          <button type="button" className="btn btn-secondary btn-lg" onClick={endStudy}>
            おぼえました
          </button>
        )}
        {phase === 'recall' && (
          <button type="button" className="btn btn-primary btn-lg" onClick={submit}>
            これで おわり
          </button>
        )}
        {phase === 'review' && (
          <>
            <p className="sm-legend">
              <span className="sm-legend-ok">○</span> メモに あった もの
              <span className="sm-legend-ng">✕</span> ちがう もの
            </p>
            <button type="button" className="btn btn-primary btn-lg" onClick={next}>
              つぎへ
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ItemFace({ it }: { it: Item }) {
  return (
    <>
      <span className="sm-item-icon" aria-hidden="true">
        {it.e}
      </span>
      <span className="sm-item-name">{it.name}</span>
    </>
  )
}
