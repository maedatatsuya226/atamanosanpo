import { useEffect, useRef, useState } from 'react'
import { Feedback, Progress } from '../../components/Feedback'
import { useSound } from '../../core/sound'
import { Stopwatch } from '../../core/stopwatch'
import type { DetailRow, GameProps } from '../../core/types'
import {
  classifyTendency,
  describeDiff,
  formatSigned,
  isDisplayVisible,
  isWithinTolerance,
  LEVELS,
  roundTenth,
  summarizeErrors,
  toleranceSec,
  TRIALS,
} from './logic'
import './stopwatch.css'

type Phase = 'ready' | 'running' | 'result'

/** ストップを押した指がそのまま「つぎへ」を押してしまわないよう、少しのあいだ受け付けない */
const NEXT_GUARD_MS = 600

interface TrialRecord {
  /** 0.1秒に丸めた実際の秒数 */
  actualSec: number
  ok: boolean
}

export default function StopwatchGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const cfg = LEVELS[difficulty]
  const target = cfg.targetSec
  const total = TRIALS[mode]
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('ready')
  const [records, setRecords] = useState<TrialRecord[]>([])
  /** 表示用の経過時間(0.1秒単位の整数) */
  const [tenths, setTenths] = useState(0)
  /** 一時停止で測り直しになったことを知らせる */
  const [restarted, setRestarted] = useState(false)
  const swRef = useRef<Stopwatch | null>(null)
  const resultAtRef = useRef(0)
  if (swRef.current === null) swRef.current = new Stopwatch()

  // 測っている途中で一時停止したら、その回は取り消してスタートからやり直す
  useEffect(() => {
    if (paused && phase === 'running') {
      swRef.current!.reset()
      setTenths(0)
      setPhase('ready')
      setRestarted(true)
    }
  }, [paused, phase])

  // 数字を表示している間だけ、requestAnimationFrame で描き直す
  useEffect(() => {
    if (phase !== 'running' || paused) return
    let raf = 0
    const tick = () => {
      const ms = swRef.current!.elapsedMs()
      setTenths(Math.floor(ms / 100))
      if (isDisplayVisible(cfg, ms / 1000)) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, paused, cfg])

  const start = () => {
    if (phase !== 'ready' || paused) return
    sound('tap')
    const sw = swRef.current!
    sw.reset()
    sw.start()
    setTenths(0)
    setRestarted(false)
    setPhase('running')
  }

  const stop = () => {
    if (phase !== 'running' || paused) return
    const sw = swRef.current!
    const ms = sw.elapsedMs()
    sw.pause()
    const actualSec = roundTenth(ms / 1000)
    const ok = isWithinTolerance(actualSec, target)
    sound(ok ? 'correct' : 'tap')
    setRecords([...records, { actualSec, ok }])
    resultAtRef.current = performance.now()
    setPhase('result')
  }

  const finish = (all: TrialRecord[]) => {
    const errs = all.map((r) => r.actualSec - target)
    const s = summarizeErrors(errs)
    const details: DetailRow[] = all.map((r, i) => ({
      label: `${i + 1}回目`,
      value: `${r.actualSec.toFixed(1)}秒(${formatSigned(r.actualSec - target)})`,
      mark: r.ok ? 'correct' : 'wrong',
    }))
    const correct = all.filter((r) => r.ok).length
    onFinish({
      correct,
      total: all.length,
      errors: all.length - correct,
      extra: [
        { label: '目標', value: `${target}秒(±${toleranceSec(target).toFixed(1)}秒で成功)` },
        ...(s
          ? [
              { label: '平均のずれ', value: `${s.meanAbs.toFixed(2)}秒` },
              { label: '傾向', value: `${classifyTendency(errs, target)}(平均 ${formatSigned(s.meanSigned)}秒)` },
            ]
          : []),
      ],
      details,
    })
  }

  const next = () => {
    if (phase !== 'result' || performance.now() - resultAtRef.current < NEXT_GUARD_MS) return
    if (index + 1 >= total) {
      finish(records)
      return
    }
    setIndex(index + 1)
    setTenths(0)
    setPhase('ready')
  }

  const last = records[records.length - 1]
  const diffText = last ? describeDiff(last.actualSec, target) : ''
  const elapsedSec = tenths / 10
  const visible = phase === 'running' ? isDisplayVisible(cfg, elapsedSec) : isDisplayVisible(cfg, 0)

  let display: string
  if (phase === 'result' && last) display = last.actualSec.toFixed(1)
  else if (!visible) display = '？'
  else display = elapsedSec.toFixed(1)

  let hint = ''
  if (phase === 'ready') {
    if (cfg.hideAfterSec === 0) hint = 'すうじは でません。こころの なかで かぞえます'
    else if (cfg.hideAfterSec !== null) hint = `とちゅうで すうじが「？」に かわります`
  } else if (phase === 'running' && !visible) {
    hint = 'こころの なかで かぞえて ください'
  }

  return (
    <div className="sw">
      <div className="sw-head">
        <Progress current={index + 1} total={total} />
        <p className="task-instruction">
          <span className="sw-target">{target}</span>びょう で とめて ください
        </p>
        <Feedback
          kind={phase === 'result' && last ? (last.ok ? 'correct' : 'info') : phase === 'ready' && restarted ? 'info' : null}
        >
          {phase === 'result' && last && (last.ok ? 'じょうずです！' : 'おしい！ つぎも やってみましょう')}
          {phase === 'ready' && restarted && 'とちゅうで とまったので、もういちど はじめから です'}
        </Feedback>
      </div>

      <div className="sw-body">
        <div className={`sw-display ${phase === 'result' ? 'is-result' : ''} ${!visible && phase !== 'result' ? 'is-hidden' : ''}`}>
          <span className="sw-digits" aria-live="off">
            {display}
          </span>
          {display !== '？' && <span className="sw-unit">びょう</span>}
        </div>
        <p className="sw-sub">
          {phase === 'result' && last ? (
            <span className={`sw-diff ${last.ok ? 'is-ok' : ''}`}>
              {diffText === 'ぴったり' ? 'ぴったり！' : `${target}びょう より ${diffText}`}
            </span>
          ) : (
            hint
          )}
        </p>
      </div>

      <div className="sw-actions">
        {phase === 'ready' && (
          <button key="start" type="button" className="btn sw-btn sw-btn-start" onPointerDown={start} disabled={paused}>
            スタート
          </button>
        )}
        {phase === 'running' && (
          <button key="stop" type="button" className="btn sw-btn sw-btn-stop" onPointerDown={stop}>
            ストップ
          </button>
        )}
        {phase === 'result' && (
          <button key="next" type="button" className="btn btn-primary btn-xl sw-btn-next" onClick={next}>
            つぎへ
          </button>
        )}
      </div>
    </div>
  )
}
