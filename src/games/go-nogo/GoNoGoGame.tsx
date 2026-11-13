import { useEffect, useState } from 'react'
import { Progress } from '../../components/Feedback'
import { average, usePausableTimeout, useTrialClock } from '../../core/hooks'
import { useSound } from '../../core/sound'
import type { GameProps } from '../../core/types'
import { buildItems, configFor, score, type Response } from './logic'
import './go-nogo.css'

const FIRST_MS = 1200

type Phase = 'ready' | 'show' | 'gap'
type Flash = 'hit' | 'commission' | 'omission' | null

export default function GoNoGoGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const [cfg] = useState(() => configFor(difficulty, mode))
  const [items] = useState(() => buildItems(cfg))
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('ready')
  const [responses, setResponses] = useState<Response[]>([])
  const [flash, setFlash] = useState<Flash>(null)
  const clock = useTrialClock(paused)

  useEffect(() => {
    if (phase === 'show') clock.restart()
  }, [phase, index, clock])

  const finish = (all: Response[]) => {
    const s = score(items, all)
    const rt = average(all.filter((r, i) => r.pressed && items[i].go && r.rtMs !== null).map((r) => r.rtMs!))
    const goCount = items.filter((it) => it.go).length
    onFinish({
      correct: s.hits + s.correctRejections,
      total: items.length,
      errors: s.commissions,
      extra: [
        { label: '押してしまった(押さない絵で)', value: `${s.commissions}回 / ${items.length - goCount}回中` },
        { label: '押しわすれ(押す絵で)', value: `${s.omissions}回 / ${goCount}回中` },
        { label: '平均反応時間(押す絵)', value: rt === null ? '—' : `${(rt / 1000).toFixed(2)}秒` },
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
        const all = [...responses]
        if (!all[index]) all[index] = { pressed: false, rtMs: null }
        setResponses(all)
        if (!all[index].pressed && items[index].go) setFlash('omission')
        setPhase('gap')
        return
      }
      if (index + 1 >= items.length) {
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
    if (items[index].go) {
      sound('tap')
      setFlash('hit')
    } else {
      sound('wrong')
      setFlash('commission')
    }
  }

  const pressed = responses[index]?.pressed ?? false
  const note =
    flash === 'commission' ? 'おさない えでした' : flash === 'omission' ? 'おして よい えでした' : flash === 'hit' ? 'いいですね' : ''
  // きまりの絵(押す絵が少ないときは押す絵、多いときは押さない絵を見せる)
  const showGo = cfg.go.length <= cfg.nogo.length || cfg.go.length <= 4

  return (
    <div className="gn">
      <div className="gn-head">
        <Progress current={Math.min(index + 1, items.length)} total={items.length} />
        <p className="gn-rule">
          <span className="gn-rule-pics" aria-hidden="true">
            {(showGo ? cfg.go : cfg.nogo).join(' ')}
          </span>
          {cfg.rule}
        </p>
      </div>

      <div className={`gn-card ${flash ? `is-${flash}` : ''}`}>
        {phase === 'show' && <span className="gn-picture">{items[index].picture}</span>}
        {phase === 'ready' && <span className="gn-ready">はじめます</span>}
      </div>
      <p className={`gn-note ${flash ? `is-${flash}` : ''}`} role="status" aria-live="polite">
        {note}
      </p>

      <button type="button" className="btn btn-primary gn-press" onPointerDown={press} disabled={phase !== 'show' || pressed}>
        おす
      </button>
    </div>
  )
}
