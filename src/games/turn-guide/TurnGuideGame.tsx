import { useState } from 'react'
import { AssistBar } from '../../components/AssistBar'
import { CAR_ANGLE, CarIcon } from '../../components/CarIcon'
import { Feedback, Progress, type FeedbackKind } from '../../components/Feedback'
import { useElementSize, usePausableTimeout, useTrialClock } from '../../core/hooks'
import { useSound } from '../../core/sound'
import { formatDuration } from '../../core/stopwatch'
import type { DetailRow, GameProps } from '../../core/types'
import { buildQuestions, checkAnswers, incomingDir, LEVELS, MAP_COLS, MAP_ROWS, REL_NAME, type Rel } from './logic'
import './turn-guide.css'

const NEXT_MS = 1200
const RELS: readonly Rel[] = ['left', 'straight', 'right']
const REL_ARROW: Record<Rel, string> = { left: '⬅', straight: '⬆', right: '➡' }

interface QuestionRecord {
  wrong: number
  hints: number
  answered: boolean
  ms: number
}

export default function TurnGuideGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const cfg = LEVELS[difficulty]
  const multi = cfg.turns > 1
  const [routes] = useState(() => buildQuestions(difficulty, mode))
  const total = routes.length
  const [index, setIndex] = useState(0)
  const route = routes[index]
  const [picks, setPicks] = useState<(Rel | null)[]>(() => new Array(cfg.turns).fill(null))
  const [checked, setChecked] = useState<boolean[] | null>(null)
  const [phase, setPhase] = useState<'answering' | 'correct' | 'answered'>('answering')
  const [wrong, setWrong] = useState(0)
  const [hints, setHints] = useState(0)
  /** ヒントで車を置いてみせる曲がり角(0から) */
  const [hintAt, setHintAt] = useState<number | null>(null)
  const [records, setRecords] = useState<QuestionRecord[]>([])
  const [clearMs, setClearMs] = useState(0)
  const clock = useTrialClock(paused)
  const [stageRef, stage] = useElementSize<HTMLDivElement>()

  const judge = (next: (Rel | null)[]) => {
    const res = checkAnswers(route, next)
    setChecked(res)
    if (res.every(Boolean)) {
      sound('correct')
      setClearMs(clock.read())
      setPhase('correct')
    } else {
      sound('wrong')
      setWrong((w) => w + 1)
    }
  }

  const press = (rel: Rel) => {
    if (phase !== 'answering') return
    setHintAt(null)
    if (!multi) {
      const next = [rel]
      setPicks(next)
      judge(next)
      return
    }
    const at = picks.indexOf(null)
    if (at < 0) return
    sound('tap')
    const next = [...picks]
    next[at] = rel
    setPicks(next)
    setChecked(null)
  }

  const undo = () => {
    if (phase !== 'answering') return
    const filled = picks.filter((p) => p !== null).length
    if (filled === 0) return
    sound('tap')
    const next = [...picks]
    next[filled - 1] = null
    setPicks(next)
    setChecked(null)
  }

  const goNext = (answered: boolean) => {
    const all = [...records, { wrong, hints, answered, ms: clearMs }]
    if (index + 1 >= total) {
      const details = all.map((r, i): DetailRow => {
        const parts = [`まちがい${r.wrong}回`]
        if (r.hints > 0) parts.push(`ヒント${r.hints}回`)
        if (r.answered) parts.push('こたえを見た')
        parts.push(formatDuration(r.ms))
        const clean = r.wrong === 0 && r.hints === 0 && !r.answered
        return { label: `${i + 1}問目`, value: parts.join('・'), mark: clean ? 'correct' : 'partial' }
      })
      onFinish({
        correct: details.filter((d) => d.mark === 'correct').length,
        total: all.length,
        errors: all.reduce((s, r) => s + r.wrong, 0),
        extra: [
          { label: 'ヒントを使った回数', value: `${all.reduce((s, r) => s + r.hints, 0)}回` },
          { label: 'こたえを見た問題', value: `${all.filter((r) => r.answered).length}問` },
        ],
        details,
      })
      return
    }
    setRecords(all)
    setIndex(index + 1)
    setPicks(new Array(cfg.turns).fill(null))
    setChecked(null)
    setWrong(0)
    setHints(0)
    setHintAt(null)
    setPhase('answering')
    clock.restart()
  }

  usePausableTimeout(() => goNext(false), phase === 'correct' ? NEXT_MS : null, paused, index)

  const showHint = () => {
    if (phase !== 'answering') return
    sound('tap')
    setHints((h) => h + 1)
    // 最初の「まだ答えていない・まちがえた」曲がり角に、そこへ入ってくる向きの車を置いてみせる
    const k = route.answers.findIndex((a, i) => picks[i] !== a)
    setHintAt(k < 0 ? 0 : k)
  }

  const showAnswer = () => {
    if (phase !== 'answering') return
    setPicks([...route.answers])
    setChecked(null)
    setHintAt(null)
    setClearMs(clock.read())
    setPhase('answered')
  }

  // 地図: 交差点の間を1とする座標。まわりに半ブロックの余白
  const vbW = MAP_COLS
  const vbH = MAP_ROWS
  const unit = Math.max(0, Math.min(stage.width / vbW, stage.height / vbH))
  const pos = (n: number): [number, number] => [(n % MAP_COLS) + 0.5, Math.floor(n / MAP_COLS) + 0.5]
  const [cx, cy] = pos(route.nodes[0])
  const [fx, fy] = pos(route.nodes[route.nodes.length - 1])
  const corners = route.nodes.slice(1, -1)

  let message: { text: string; kind: FeedbackKind }
  if (phase === 'correct') message = { text: 'せいかい！', kind: 'correct' }
  else if (phase === 'answered') message = { text: 'これが こたえです', kind: 'info' }
  else if (hintAt !== null) message = { text: 'うすい くるまに なった つもりで かんがえましょう', kind: 'info' }
  else if (checked) message = { text: 'ちがう ところが あります', kind: 'wrong' }
  else
    message = {
      text: multi ? 'くるまから みて、かどを じゅんに こたえます' : 'くるまから みて、どちらへ まがる？',
      kind: 'info',
    }

  const filled = picks.filter((p) => p !== null).length

  return (
    <div className="tg">
      <div className="tg-stage" ref={stageRef}>
        {unit > 0 && (
          <svg className="tg-map" width={unit * vbW} height={unit * vbH} viewBox={`0 0 ${vbW} ${vbH}`} role="img" aria-label="まちの ちず">
            <rect className="tg-ground" width={vbW} height={vbH} rx={0.2} />
            <g className="tg-road">
              {Array.from({ length: MAP_ROWS }, (_, r) => (
                <line key={`r${r}`} x1={0} y1={r + 0.5} x2={vbW} y2={r + 0.5} />
              ))}
              {Array.from({ length: MAP_COLS }, (_, c) => (
                <line key={`c${c}`} x1={c + 0.5} y1={0} x2={c + 0.5} y2={vbH} />
              ))}
            </g>
            <polyline className="tg-route" points={route.nodes.map((n) => pos(n).join(',')).join(' ')} />
            {/* 曲がり角の番号(いくつか答えるとき) */}
            {multi &&
              corners.map((n, k) => {
                const [x, y] = pos(n)
                return (
                  <g key={`n${k}`} className="tg-corner-num">
                    <circle cx={x + 0.28} cy={y - 0.28} r={0.17} />
                    <text x={x + 0.28} y={y - 0.28} dy="0.35em" textAnchor="middle">
                      {k + 1}
                    </text>
                  </g>
                )
              })}
            {/* こたえ: 曲がり角ごとの曲がり方 */}
            {phase === 'answered' &&
              corners.map((n, k) => {
                const [x, y] = pos(n)
                return (
                  <g key={`a${k}`} className="tg-answer">
                    <rect x={x - 0.42} y={y + 0.2} width={0.84} height={0.26} rx={0.08} />
                    <text x={x} y={y + 0.33} dy="0.35em" textAnchor="middle">
                      {REL_NAME[route.answers[k]]}
                    </text>
                  </g>
                )
              })}
            {/* ヒント: その曲がり角に、入ってくる向きの車を置く */}
            {hintAt !== null && (
              <g
                className="tg-ghost"
                transform={`translate(${pos(corners[hintAt])[0]} ${pos(corners[hintAt])[1]}) rotate(${CAR_ANGLE[incomingDir(route, hintAt)]})`}
              >
                <CarIcon />
              </g>
            )}
            {/* ゴールの旗 */}
            <line className="tg-pole" x1={fx} y1={fy + 0.25} x2={fx} y2={fy - 0.28} />
            <path className="tg-flag" d={`M ${fx} ${fy - 0.28} L ${fx + 0.28} ${fy - 0.17} L ${fx} ${fy - 0.06} Z`} />
            <g transform={`translate(${cx} ${cy}) rotate(${CAR_ANGLE[route.heading]})`}>
              <CarIcon />
            </g>
          </svg>
        )}
      </div>

      <aside className="tg-side">
        <Progress current={index + 1} total={total} />
        <Feedback kind={message.kind}>{message.text}</Feedback>

        {multi && (
          <ol className="tg-slots">
            {picks.map((p, i) => (
              <li key={i} className={`tg-slot ${checked ? (checked[i] ? 'is-right' : 'is-wrong') : ''}`}>
                <span className="tg-slot-num">{i + 1}</span>
                <span className="tg-slot-val">{p ? `${REL_ARROW[p]} ${REL_NAME[p]}` : ''}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="tg-buttons">
          {RELS.map((r) => (
            <button
              key={r}
              type="button"
              className={`btn tg-rel ${!multi && checked && picks[0] === r && !checked[0] ? 'is-wrong' : ''}`}
              onClick={() => press(r)}
              disabled={phase !== 'answering' || (multi && filled >= cfg.turns)}
            >
              <span className="tg-rel-arrow" aria-hidden="true">
                {REL_ARROW[r]}
              </span>
              {REL_NAME[r]}
            </button>
          ))}
        </div>

        {multi && phase === 'answering' && (
          <div className="tg-multi-actions">
            <button type="button" className="btn btn-ghost" onClick={undo} disabled={filled === 0}>
              ひとつ けす
            </button>
            <button type="button" className="btn btn-primary" onClick={() => judge(picks)} disabled={filled < cfg.turns}>
              こたえあわせ
            </button>
          </div>
        )}

        <AssistBar
          answered={phase === 'answered'}
          disabled={phase !== 'answering'}
          onHint={showHint}
          onAnswer={showAnswer}
          onNext={() => goNext(true)}
        />
      </aside>
    </div>
  )
}
