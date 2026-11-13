import { useEffect, useState } from 'react'
import { Progress } from '../../components/Feedback'
import { average, usePausableTimeout, useTrialClock } from '../../core/hooks'
import { useSound } from '../../core/sound'
import type { GameProps } from '../../core/types'
import { buildSequence, configFor, isTarget, score, type Response } from './logic'
import './n-back.css'

/** 最初の絵の前の待ち時間 */
const FIRST_MS = 1200

const N_WORD = ['', 'ひとつ', 'ふたつ', 'みっつ'] as const

type Phase = 'ready' | 'show' | 'gap'
type Flash = 'hit' | 'false-alarm' | 'miss' | null

export default function NBackGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const [cfg] = useState(() => configFor(difficulty, mode))
  const { n } = cfg
  const [seq] = useState(() => buildSequence(cfg.n, cfg.items))
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('ready')
  const [responses, setResponses] = useState<Response[]>([])
  const [flash, setFlash] = useState<Flash>(null)
  const clock = useTrialClock(paused)

  // 絵が出たときから反応時間を測る
  useEffect(() => {
    if (phase === 'show') clock.restart()
  }, [phase, index, clock])

  const finish = (all: Response[]) => {
    const s = score(seq, n, all)
    const rt = average(all.filter((r, i) => r.pressed && r.rtMs !== null && isTarget(seq, i, n)).map((r) => r.rtMs!))
    onFinish({
      correct: s.hits,
      total: s.targets,
      errors: s.falseAlarms,
      extra: [
        { label: `${n}つまえと比べる`, value: `${seq.length}枚` },
        { label: '見のがし(おなじなのに押さなかった)', value: `${s.misses}回` },
        { label: 'まちがって押した', value: `${s.falseAlarms}回` },
        { label: '平均反応時間(当たり)', value: rt === null ? '—' : `${(rt / 1000).toFixed(2)}秒` },
      ],
    })
  }

  usePausableTimeout(
    () => {
      if (phase === 'ready') {
        setPhase('show')
        return
      }
      if (phase === 'show') {
        // 絵が消えるとき: 押さなかったら記録し、当たりなら見のがしを知らせる
        const all = [...responses]
        if (!all[index]) all[index] = { pressed: false, rtMs: null }
        setResponses(all)
        if (!all[index].pressed && isTarget(seq, index, n)) setFlash('miss')
        setPhase('gap')
        return
      }
      if (index + 1 >= seq.length) {
        finish(responses)
        return
      }
      setFlash(null)
      setIndex(index + 1)
      setPhase('show')
    },
    phase === 'ready' ? FIRST_MS : phase === 'show' ? cfg.showMs : cfg.gapMs,
    paused,
    `${index}-${phase}`,
  )

  const press = () => {
    if (phase !== 'show' || paused || responses[index]?.pressed) return
    const all = [...responses]
    all[index] = { pressed: true, rtMs: clock.read() }
    setResponses(all)
    const hit = isTarget(seq, index, n)
    sound(hit ? 'correct' : 'wrong')
    setFlash(hit ? 'hit' : 'false-alarm')
  }

  const pressed = responses[index]?.pressed ?? false
  const note =
    flash === 'hit'
      ? 'あたり！'
      : flash === 'false-alarm'
        ? 'ちがいました'
        : flash === 'miss'
          ? 'いまのは おなじでした'
          : index < n && phase !== 'ready'
            ? 'おぼえて ください'
            : ''

  return (
    <div className="nb">
      <div className="nb-head">
        <Progress current={Math.min(index + 1, seq.length)} total={seq.length} />
        <p className="task-instruction">
          {N_WORD[n]} まえと おなじ えなら「おなじ！」を おします
        </p>
      </div>

      <div className={`nb-card ${flash ? `is-${flash}` : ''}`}>
        {phase === 'show' && (
          <span className="nb-picture" aria-label="いまの え">
            {seq[index]}
          </span>
        )}
        {phase === 'ready' && <span className="nb-ready">はじめます</span>}
      </div>
      <p className={`nb-note ${flash ? `is-${flash}` : ''}`} role="status" aria-live="polite">
        {note}
      </p>

      <button type="button" className="btn btn-primary nb-press" onPointerDown={press} disabled={phase !== 'show' || pressed}>
        おなじ！
      </button>
    </div>
  )
}
