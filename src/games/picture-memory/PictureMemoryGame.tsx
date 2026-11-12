import { useEffect, useState } from 'react'
import { Feedback, Progress } from '../../components/Feedback'
import { useElementSize, usePausableTimeout } from '../../core/hooks'
import { useSound } from '../../core/sound'
import type { DetailRow, GameProps } from '../../core/types'
import {
  buildRound,
  fitGrid,
  levelConfig,
  roundMark,
  ROUNDS,
  scoreRound,
  studyMs,
  type Picture,
  type RoundScore,
} from './logic'
import './picture-memory.css'

type Phase = 'study' | 'delay' | 'recall' | 'review'

const GAP = 12
/** カードの高さ = 幅 × CARD_RATIO(絵の下に名前を入れるぶん縦長) */
const CARD_RATIO = 1.25

type CardState = 'plain' | 'selected' | 'hit' | 'miss' | 'false' | 'faded'

export default function PictureMemoryGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const cfg = levelConfig(difficulty, mode)
  const total = ROUNDS[mode]
  const [rounds] = useState(() => Array.from({ length: total }, () => buildRound(cfg)))
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('study')
  const [remaining, setRemaining] = useState(cfg.delaySec)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [scores, setScores] = useState<RoundScore[]>([])
  const [stageRef, stage] = useElementSize<HTMLDivElement>()

  const round = rounds[index]
  const last = scores[scores.length - 1]

  // 待っている途中で一時停止したら、再開時に待ち時間を最初から数え直す
  // (覚える時間は usePausableTimeout が再開時に最初から数え直す)
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

  const toggle = (p: Picture) => {
    if (phase !== 'recall') return
    sound('tap')
    const next = new Set(selected)
    if (next.has(p.name)) next.delete(p.name)
    else next.add(p.name)
    setSelected(next)
  }

  const submit = () => {
    const s = scoreRound(round, selected)
    if (s.hits === s.total && s.falseAlarms === 0) sound('correct')
    setScores([...scores, s])
    setPhase('review')
  }

  const finish = (all: RoundScore[]) => {
    const details: DetailRow[] = all.map((s, i) => ({
      label: `${i + 1}回目`,
      value: `${s.total}枚中${s.hits}枚・まちがい${s.falseAlarms}枚`,
      mark: roundMark(s),
    }))
    onFinish({
      correct: all.reduce((n, s) => n + s.hits, 0),
      total: all.reduce((n, s) => n + s.total, 0),
      errors: all.reduce((n, s) => n + s.falseAlarms, 0),
      extra: [{ label: '見落とし', value: `${all.reduce((n, s) => n + s.misses, 0)}枚` }],
      details,
    })
  }

  const next = () => {
    if (index + 1 >= total) {
      finish(scores)
      return
    }
    setIndex(index + 1)
    setSelected(new Set())
    setPhase('study')
  }

  const targetNames = new Set(round.targets.map((t) => t.name))
  const cardState = (p: Picture): CardState => {
    const isSel = selected.has(p.name)
    if (phase !== 'review') return isSel ? 'selected' : 'plain'
    if (targetNames.has(p.name)) return isSel ? 'hit' : 'miss'
    return isSel ? 'false' : 'faded'
  }

  const cards = phase === 'study' ? round.targets : phase === 'recall' || phase === 'review' ? round.choices : []
  const grid = fitGrid(cards.length, stage.width, stage.height, GAP, CARD_RATIO, phase === 'study' ? 230 : 200)
  const perfect = last && last.hits === last.total && last.falseAlarms === 0

  let instruction = ''
  if (phase === 'study') instruction = 'よく みて おぼえて ください'
  else if (phase === 'delay') instruction = 'すこし まって ください'
  else if (phase === 'recall') instruction = 'さっき みた えを ぜんぶ えらんで ください'

  return (
    <div className="pm">
      <div className="pm-head">
        <Progress current={index + 1} total={total} />
        {phase === 'review' ? (
          <Feedback kind={perfect ? 'correct' : 'info'}>
            {perfect ? 'ぜんぶ せいかい！' : `${last.total}まい ちゅう ${last.hits}まい えらべました`}
          </Feedback>
        ) : (
          <p className="task-instruction">{instruction}</p>
        )}
      </div>

      <div className="pm-stage" ref={stageRef}>
        {phase === 'delay' ? (
          <div className="pm-wait" aria-live="polite">
            <span className="pm-wait-num">{remaining}</span>
            <span className="pm-wait-unit">びょう</span>
          </div>
        ) : (
          grid.card > 0 && (
            <div
              className={`pm-grid ${phase === 'recall' ? 'is-recall' : ''}`}
              style={{ gridTemplateColumns: `repeat(${grid.cols}, ${grid.card}px)`, gap: GAP }}
            >
              {cards.map((p) => (
                <Card
                  key={p.name}
                  picture={p}
                  size={grid.card}
                  state={cardState(p)}
                  interactive={phase === 'recall'}
                  onTap={() => toggle(p)}
                />
              ))}
            </div>
          )
        )}
      </div>

      <div className="pm-foot">
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
            <p className="pm-legend">
              <span className="pm-legend-ok">○</span> さっき みた え
              <span className="pm-legend-ng">✕</span> ちがう え
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

function Card({
  picture,
  size,
  state,
  interactive,
  onTap,
}: {
  picture: Picture
  size: number
  state: CardState
  interactive: boolean
  onTap: () => void
}) {
  const nameFont = Math.min(size * 0.17, (size - 14) / picture.name.length)
  const style = { width: size, height: Math.floor(size * CARD_RATIO) }
  const body = (
    <>
      <span className="pm-emoji" style={{ fontSize: size * 0.5 }} aria-hidden="true">
        {picture.emoji}
      </span>
      <span className="pm-name" style={{ fontSize: nameFont }}>
        {picture.name}
      </span>
      {state === 'selected' && <span className="pm-badge pm-badge-sel">✓</span>}
      {(state === 'hit' || state === 'miss') && <span className="pm-badge pm-badge-ok">○</span>}
      {state === 'false' && <span className="pm-badge pm-badge-ng">✕</span>}
    </>
  )
  if (!interactive) {
    return (
      <div className={`pm-card is-${state}`} style={style}>
        {body}
      </div>
    )
  }
  return (
    <button
      type="button"
      className={`pm-card is-${state}`}
      style={style}
      onClick={onTap}
      aria-pressed={state === 'selected'}
      aria-label={picture.name}
    >
      {body}
    </button>
  )
}
