import { useEffect, useMemo, useRef, useState } from 'react'
import { CAR_ANGLE, CarIcon } from '../../components/CarIcon'
import { Feedback, Progress, type FeedbackKind } from '../../components/Feedback'
import { useElementSize, usePausableTimeout, useTrialClock } from '../../core/hooks'
import { useSound } from '../../core/sound'
import { formatDuration } from '../../core/stopwatch'
import type { DetailRow, GameProps } from '../../core/types'
import {
  advanceCar,
  buildCourse,
  carPose,
  chooseAtJunction,
  COURSES,
  DIRS,
  dirOf,
  exitsFrom,
  LEVELS,
  startCar,
  stepToward,
  upcomingJunction,
  type Car,
  type CarEvent,
  type Course,
  type Dir,
  type Plan,
} from './logic'
import './drive-maze.css'

const CLEAR_MS = 1500
const NOTICE_MS = 1600

const DIR_NAME = ['うえ', 'みぎ', 'した', 'ひだり'] as const
const DIR_MARK = ['▲', '▶', '▼', '◀'] as const
const DIR_VEC = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const

interface CourseRecord {
  wrong: number
  stops: number
  deadEnds: number
  ms: number
}

const EMPTY_STATS = { wrong: 0, stops: 0, deadEnds: 0 }

function center(node: number, cols: number): [number, number] {
  return [(node % cols) + 0.5, Math.floor(node / cols) + 0.5]
}

export default function DriveMazeGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const cfg = LEVELS[difficulty]
  const total = COURSES[mode]
  const [courses] = useState(() => Array.from({ length: total }, () => buildCourse(difficulty)))
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'ready' | 'driving' | 'goal'>('ready')
  const [records, setRecords] = useState<CourseRecord[]>([])
  const [notice, setNotice] = useState<{ text: string; kind: FeedbackKind; n: number } | null>(null)
  const [, setFrame] = useState(0)
  const clock = useTrialClock(paused)
  const [stageRef, stage] = useElementSize<HTMLDivElement>()

  // 車の位置は毎フレーム変わるので ref に持ち、描きなおしだけ state で起こす
  const carRef = useRef<Car>(startCar(courses[0]))
  const planRef = useRef<Plan | null>(null)
  const statsRef = useRef({ ...EMPTY_STATS })
  const clearMsRef = useRef(0)
  const rerender = () => setFrame((f) => f + 1)

  const course = courses[index]
  const { cols, rows } = course

  const showNotice = (text: string, kind: FeedbackKind) =>
    setNotice((prev) => ({ text, kind, n: (prev?.n ?? 0) + 1 }))

  const handleEvents = (events: CarEvent[]) => {
    for (const e of events) {
      if (e.type === 'goal') {
        sound('correct')
        clearMsRef.current = clock.read()
        setNotice(null)
        setPhase('goal')
      } else if (e.type === 'deadEnd') {
        statsRef.current.deadEnds++
        sound('wrong')
        showNotice('いきどまり。もどります', 'info')
      } else if (e.type === 'wait') {
        statsRef.current.stops++
        setNotice(null)
      } else if (e.type === 'turn') {
        if (!e.correct) statsRef.current.wrong++
      }
    }
  }

  // 車を走らせる(一時停止中・分かれ道で待っている間は止まる)
  useEffect(() => {
    if (phase !== 'driving' || paused) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(100, now - last)
      last = now
      const car = carRef.current
      if (!car.waiting && !car.arrived) {
        const r = advanceCar(course, car, dt, cfg.segmentMs, planRef.current)
        carRef.current = r.car
        if (r.usedPlan) planRef.current = null
        handleEvents(r.events)
        rerender()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // handleEvents は ref と安定した関数だけを使う
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, index])

  // ゴールしたら次のコースへ
  usePausableTimeout(
    () => {
      const s = statsRef.current
      const all = [...records, { ...s, ms: clearMsRef.current }]
      if (index + 1 >= total) {
        onFinish({
          correct: all.filter((r) => r.wrong === 0).length,
          total: all.length,
          errors: all.reduce((n, r) => n + r.wrong, 0),
          extra: [
            { label: '止まって待った回数(間に合わなかった)', value: `${all.reduce((n, r) => n + r.stops, 0)}回` },
            { label: '行き止まりでUターンした回数', value: `${all.reduce((n, r) => n + r.deadEnds, 0)}回` },
          ],
          details: all.map(
            (r, i): DetailRow => ({
              label: `${i + 1}コース`,
              value: `まちがい${r.wrong}回・止まった${r.stops}回・${formatDuration(r.ms)}`,
              mark: r.wrong === 0 ? 'correct' : 'partial',
            }),
          ),
        })
        return
      }
      setRecords(all)
      statsRef.current = { ...EMPTY_STATS }
      carRef.current = startCar(courses[index + 1])
      planRef.current = null
      setIndex(index + 1)
      setPhase('ready')
    },
    phase === 'goal' ? CLEAR_MS : null,
    paused,
    index,
  )

  usePausableTimeout(() => setNotice(null), notice?.kind === 'info' ? NOTICE_MS : null, paused, notice?.n)

  const depart = () => {
    sound('tap')
    clock.restart()
    setPhase('driving')
  }

  const car = carRef.current
  const plan = planRef.current
  const upcoming = phase === 'goal' ? null : upcomingJunction(course, car)
  const validDirs: Dir[] = upcoming
    ? exitsFrom(course, upcoming.node, upcoming.from).map((n) => dirOf(upcoming.node, n, cols))
    : []
  const planDir = plan && upcoming && plan.node === upcoming.node ? dirOf(plan.node, plan.next, cols) : null

  const press = (dir: Dir) => {
    if (phase === 'goal' || !upcoming || !validDirs.includes(dir)) return
    const next = stepToward(upcoming.node, dir, cols, rows)
    if (next === null) return
    sound('tap')
    if (car.waiting) {
      const r = chooseAtJunction(course, car, next)
      if (!r) return
      carRef.current = r.car
      planRef.current = null
      handleEvents([r.event])
    } else {
      // 着く前なら何度でも選びなおせる
      planRef.current = { node: upcoming.node, next }
    }
    rerender()
  }

  const edges = useMemo(() => roadEdges(course), [course])
  const unit = Math.max(0, Math.min(stage.width / cols, stage.height / rows))
  const pose = carPose(course, car)

  let message: { text: string; kind: FeedbackKind }
  if (phase === 'goal') message = { text: 'ゴール！', kind: 'correct' }
  else if (notice) message = notice
  else if (phase === 'ready') message = { text: 'ちずを みて、ゴールまでの みちを たしかめましょう', kind: 'info' }
  else if (car.waiting) message = { text: 'どちらに まがりますか？', kind: 'info' }
  else if (!upcoming) message = { text: 'このまま ゴールへ', kind: 'info' }
  else if (planDir !== null) message = { text: `つぎの かどで ${DIR_NAME[planDir]}へ`, kind: 'info' }
  else message = { text: 'つぎの かどで どちらに まがる？', kind: 'info' }

  return (
    <div className="dm">
      <aside className="dm-side">
        <Progress current={index + 1} total={total} />
        <Feedback kind={message.kind}>{message.text}</Feedback>

        <div className="dm-pad" role="group" aria-label="まがる ほうこう">
          {DIRS.map((d) => (
            <button
              key={d}
              type="button"
              className={`dm-pad-btn dm-pad-${d} ${planDir === d ? 'is-selected' : ''} ${car.waiting && validDirs.includes(d) ? 'is-urgent' : ''}`}
              disabled={!validDirs.includes(d) || phase === 'goal'}
              onPointerDown={() => press(d)}
              aria-label={DIR_NAME[d]}
              aria-pressed={planDir === d}
            >
              {DIR_MARK[d]}
            </button>
          ))}
          <span className="dm-pad-center" aria-hidden="true">
            かど
          </span>
        </div>

        {phase === 'ready' && (
          <button type="button" className="btn btn-primary btn-lg" onClick={depart}>
            しゅっぱつ
          </button>
        )}
      </aside>

      <div className="dm-stage" ref={stageRef}>
        {unit > 0 && (
          <svg
            className="dm-map"
            width={unit * cols}
            height={unit * rows}
            viewBox={`0 0 ${cols} ${rows}`}
            role="img"
            aria-label="みちの ちず"
          >
            <rect className="dm-ground" x={0} y={0} width={cols} height={rows} rx={0.25} />
            <g className="dm-road">
              {edges.map(([a, b]) => (
                <Segment key={`${a}-${b}`} a={a} b={b} cols={cols} />
              ))}
            </g>
            <g className="dm-lane">
              {edges.map(([a, b]) => (
                <Segment key={`${a}-${b}`} a={a} b={b} cols={cols} />
              ))}
            </g>

            <Label node={course.start} cols={cols} text="スタート" />
            <GoalFlag node={course.goal} cols={cols} />

            {upcoming && (
              <circle
                className={`dm-corner ${car.waiting ? 'is-waiting' : ''}`}
                cx={center(upcoming.node, cols)[0]}
                cy={center(upcoming.node, cols)[1]}
                r={0.4}
              />
            )}
            {upcoming && planDir !== null && <PlanArrow node={upcoming.node} dir={planDir} cols={cols} />}

            <g transform={`translate(${pose.x} ${pose.y}) rotate(${CAR_ANGLE[pose.dir]})`}>
              <CarIcon />
            </g>
          </svg>
        )}
      </div>
    </div>
  )
}

function roadEdges(course: Course): [number, number][] {
  const out: [number, number][] = []
  course.adj.forEach((nbs, a) => nbs.forEach((b) => a < b && out.push([a, b])))
  return out
}

function Segment({ a, b, cols }: { a: number; b: number; cols: number }) {
  const [x1, y1] = center(a, cols)
  const [x2, y2] = center(b, cols)
  return <line x1={x1} y1={y1} x2={x2} y2={y2} />
}

function Label({ node, cols, text }: { node: number; cols: number; text: string }) {
  const [x, y] = center(node, cols)
  return (
    <g className="dm-label">
      <rect x={x - 0.4} y={y - 0.47} width={0.8} height={0.22} rx={0.08} />
      <text x={x} y={y - 0.36} dy="0.35em" textAnchor="middle">
        {text}
      </text>
    </g>
  )
}

function GoalFlag({ node, cols }: { node: number; cols: number }) {
  const [x, y] = center(node, cols)
  return (
    <g className="dm-goal">
      <circle cx={x} cy={y} r={0.3} />
      <line x1={x - 0.08} y1={y + 0.2} x2={x - 0.08} y2={y - 0.24} />
      <path d={`M ${x - 0.08} ${y - 0.24} L ${x + 0.18} ${y - 0.14} L ${x - 0.08} ${y - 0.04} Z`} />
      <g className="dm-label">
        <rect x={x - 0.32} y={y - 0.6} width={0.64} height={0.22} rx={0.08} />
        <text x={x} y={y - 0.49} dy="0.35em" textAnchor="middle">
          ゴール
        </text>
      </g>
    </g>
  )
}

function PlanArrow({ node, dir, cols }: { node: number; dir: Dir; cols: number }) {
  const [x, y] = center(node, cols)
  const [dx, dy] = DIR_VEC[dir]
  const tipX = x + dx * 0.46
  const tipY = y + dy * 0.46
  const baseX = x + dx * 0.24
  const baseY = y + dy * 0.24
  // 矢じりの左右
  const px = -dy * 0.16
  const py = dx * 0.16
  return (
    <g className="dm-plan">
      <line x1={x} y1={y} x2={baseX} y2={baseY} />
      <path d={`M ${tipX} ${tipY} L ${baseX + px} ${baseY + py} L ${baseX - px} ${baseY - py} Z`} />
    </g>
  )
}
