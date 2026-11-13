import { defaultRng, sample, shuffle, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'
import { SCENES, type Scene, type Step } from './scenes'

/**
 * 手順ならべ
 * 生活の場面(お茶をいれる、など)の手順カードがばらばらに置いてある。
 * 正しい順に 1, 2, 3 … の枠へ並べ、「こたえあわせ」で確かめる。
 * 上のレベルでは、その場面と関係ないカード(おとり)が混ざり、それは使わない。
 */
export interface LevelConfig {
  /** 並べる手順の数 */
  steps: number
  /** 関係ないカードの数 */
  decoys: number
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { steps: 3, decoys: 0 },
  2: { steps: 4, decoys: 0 },
  3: { steps: 5, decoys: 0 },
  4: { steps: 4, decoys: 1 },
  5: { steps: 5, decoys: 2 },
}

export const PRACTICE_LEVEL: LevelConfig = { steps: 3, decoys: 0 }

export const PROBLEMS: Record<PlayMode, number> = { main: 4, practice: 1 }

export interface Card {
  id: string
  step: Step
  /** おとりのカード */
  decoy: boolean
}

export interface Problem {
  scene: Scene
  /** 正しい順に並べたカード */
  answer: Card[]
  /** 画面に置くカード(ばらばら。おとりを含む) */
  cards: Card[]
}

/** 手順から n 個を、順番を保ったまま選ぶ(最初と最後は必ず入れて、場面がわかるようにする) */
export function pickSteps(steps: readonly Step[], n: number, rng: Rng = defaultRng): number[] {
  if (n >= steps.length) return steps.map((_, i) => i)
  const middle = sample(
    Array.from({ length: steps.length - 2 }, (_, i) => i + 1),
    n - 2,
    rng,
  )
  return [0, ...middle.sort((a, b) => a - b), steps.length - 1]
}

function buildProblem(scene: Scene, cfg: LevelConfig, rng: Rng): Problem {
  const answer: Card[] = pickSteps(scene.steps, cfg.steps, rng).map((i) => ({
    id: `${scene.id}-${i}`,
    step: scene.steps[i],
    decoy: false,
  }))
  // おとりは、ほかの場面の手順のうち、この場面の手順と文も絵も重ならないもの
  const usedText = new Set(scene.steps.map((s) => s.t))
  const usedIcon = new Set(answer.map((c) => c.step.e))
  const pool: Card[] = []
  for (const other of SCENES) {
    if (other.id === scene.id) continue
    other.steps.forEach((s, i) => {
      if (!usedText.has(s.t) && !usedIcon.has(s.e)) pool.push({ id: `${other.id}-${i}`, step: s, decoy: true })
    })
  }
  const decoys: Card[] = []
  for (const c of shuffle(pool, rng)) {
    if (decoys.length >= cfg.decoys) break
    // おとりどうしも絵が重ならないように
    if (decoys.some((d) => d.step.e === c.step.e)) continue
    decoys.push(c)
  }
  // 最初から正しい順に並んで見えることがないよう、混ぜなおす
  let cards = shuffle([...answer, ...decoys], rng)
  for (let k = 0; k < 20 && cards.slice(0, answer.length).every((c, i) => c.id === answer[i].id); k++) {
    cards = shuffle(cards, rng)
  }
  return { scene, answer, cards }
}

export function buildProblems(level: Difficulty, mode: PlayMode, rng: Rng = defaultRng): Problem[] {
  const cfg = mode === 'practice' ? PRACTICE_LEVEL : LEVELS[level]
  const count = PROBLEMS[mode]
  const scenes = shuffle(
    SCENES.filter((s) => s.steps.length >= cfg.steps),
    rng,
  ).slice(0, count)
  return scenes.map((s) => buildProblem(s, cfg, rng))
}

/** 枠ごとに、置いたカードが正しいか(空いている枠は false) */
export function checkSlots(problem: Problem, slots: readonly (string | null)[]): boolean[] {
  return problem.answer.map((c, i) => slots[i] === c.id)
}

/** ヒント: 最初の「空いている・まちがっている」枠と、そこに入る正しいカード。全部合っていれば null */
export function slotHint(problem: Problem, slots: readonly (string | null)[]): { slot: number; cardId: string } | null {
  const i = problem.answer.findIndex((c, k) => slots[k] !== c.id)
  return i < 0 ? null : { slot: i, cardId: problem.answer[i].id }
}

