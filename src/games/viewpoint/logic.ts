import { defaultRng, randInt, sample, shuffle, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

/**
 * 視点あて
 *
 * 机(3×3のマス)を真上から見た図(見取り図)。行0が奥(うしろ側)、行2が手前(まえ側)。
 * 列0が左(ひだり側)、列2が右(みぎ側)。患者さんは「まえ」に立っている想定。
 *
 * 4つの立ち位置から机の中央を向いて見たときの「見え方」(立面図)を作る。
 *   まえ  : 下の辺に立ち、奥(行0)を向く。  見る人の左 = 列0
 *   うしろ: 上の辺に立ち、手前(行2)を向く。見る人の左 = 列2(左右が入れ替わる)
 *   ひだり: 左の辺に立ち、右を向く。        見る人の左 = 行0(奥)
 *   みぎ  : 右の辺に立ち、左を向く。        見る人の左 = 行2(手前)
 */

export type Direction = 'front' | 'right' | 'back' | 'left'

/** 表示順(見取り図のまわりの並び) */
export const DIRECTIONS: readonly Direction[] = ['front', 'right', 'back', 'left']

export const DIRECTION_LABEL: Record<Direction, string> = {
  front: 'まえ',
  right: 'みぎ',
  back: 'うしろ',
  left: 'ひだり',
}

/** 結果画面(OT向け)の表記 */
export const DIRECTION_LABEL_OT: Record<Direction, string> = {
  front: '前',
  right: '右',
  back: '後',
  left: '左',
}

export function isOpposite(a: Direction, b: Direction): boolean {
  return (DIRECTIONS.indexOf(a) + 2) % 4 === DIRECTIONS.indexOf(b)
}

/** 机の上のマスの数(一辺) */
export const GRID = 3

/** 積み木の色の数(=1問に置ける最大個数) */
export const COLOR_COUNT = 5

export interface Block {
  row: number
  col: number
  /** 高さ(段) */
  height: number
  /** 色番号 0〜COLOR_COUNT-1。1問の中で重複しない */
  color: number
}

/**
 * none   : 正解の方向から見て、積み木どうしが前後に重ならない
 * partial: 重なってもよいが、どの積み木も少しは見える
 * any    : 奥の積み木が完全に隠れてもよい
 */
export type Occlusion = 'none' | 'partial' | 'any'

export interface LevelConfig {
  blocks: number
  choices: 2 | 4
  maxHeight: number
  occlusion: Occlusion
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { blocks: 2, choices: 2, maxHeight: 2, occlusion: 'none' },
  2: { blocks: 3, choices: 2, maxHeight: 2, occlusion: 'none' },
  3: { blocks: 3, choices: 4, maxHeight: 2, occlusion: 'none' },
  4: { blocks: 4, choices: 4, maxHeight: 2, occlusion: 'partial' },
  5: { blocks: 5, choices: 4, maxHeight: 3, occlusion: 'any' },
}

export const TRIALS: Record<PlayMode, number> = { main: 6, practice: 2 }

/** 立ち位置から見たときの、ある積み木の横の位置(slot: 見る人の左から0,1,2)と奥行き(depth: 手前が0) */
export function project(block: Pick<Block, 'row' | 'col'>, dir: Direction): { slot: number; depth: number } {
  const { row, col } = block
  const last = GRID - 1
  switch (dir) {
    case 'front':
      return { slot: col, depth: last - row }
    case 'back':
      return { slot: last - col, depth: row }
    case 'left':
      return { slot: row, depth: col }
    case 'right':
      return { slot: last - row, depth: last - col }
  }
}

/** 見え方の中の1個の積み木 */
export interface ViewBlock {
  color: number
  height: number
  slot: number
  depth: number
  /** 同じ列(slot)の中で手前から何番目か(0=いちばん手前)。奥ほど細く描く */
  rank: number
  /** 見えている部分(下端・上端、段)。完全に隠れていれば null */
  visible: { from: number; to: number } | null
}

export interface View {
  /** 奥から手前の順(この順に描くと手前が奥を隠す) */
  blocks: ViewBlock[]
}

/** 立ち位置 dir から見た見え方を作る(正面から見た立面図。遠近は付けない) */
export function computeView(blocks: readonly Block[], dir: Direction): View {
  const out: ViewBlock[] = []
  for (let slot = 0; slot < GRID; slot++) {
    const inSlot = blocks
      .map((b) => ({ b, p: project(b, dir) }))
      .filter((x) => x.p.slot === slot)
      .sort((a, z) => a.p.depth - z.p.depth)
    // 手前から順に、見えている高さの上限を更新していく
    let covered = 0
    inSlot.forEach(({ b, p }, rank) => {
      const visible = b.height > covered ? { from: covered, to: b.height } : null
      covered = Math.max(covered, b.height)
      out.push({ color: b.color, height: b.height, slot, depth: p.depth, rank, visible })
    })
  }
  // 奥(depth が大きい)から描く
  out.sort((a, z) => z.depth - a.depth || a.slot - z.slot)
  return { blocks: out }
}

/** 列(slot)ごとの、見えている色の並び(下から上) */
function slotProfiles(view: View): string[] {
  const profiles: string[] = Array.from({ length: GRID }, () => '')
  const bySlot: ViewBlock[][] = Array.from({ length: GRID }, () => [])
  for (const vb of view.blocks) if (vb.visible) bySlot[vb.slot].push(vb)
  bySlot.forEach((list, slot) => {
    profiles[slot] = list
      .sort((a, z) => a.visible!.from - z.visible!.from)
      .map((vb) => `${vb.color}:${vb.visible!.from}-${vb.visible!.to}`)
      .join('|')
  })
  return profiles
}

/** 見え方の正確な署名(列の位置・色・見えている高さ)。同じ署名なら同じ絵になる */
export function viewSignature(view: View): string {
  return slotProfiles(view).join('/')
}

/**
 * 粗い署名: 空いている列を詰めた、左から右への色と高さの並び。
 * 「すきまの位置だけが違う」絵は見分けにくいので、選択肢どうしはこの署名でも違うものにする。
 */
export function coarseSignature(view: View): string {
  return slotProfiles(view)
    .filter((p) => p !== '')
    .join('/')
}

/** すべての積み木が見えているか / 前後の重なりが無いか */
export function occlusionOk(view: View, rule: Occlusion): boolean {
  if (rule === 'any') return view.blocks.some((vb) => vb.visible)
  if (rule === 'partial') return view.blocks.every((vb) => vb.visible)
  return view.blocks.every((vb) => vb.rank === 0)
}

export interface Trial {
  blocks: Block[]
  answer: Direction
  /** 選べる立ち位置(DIRECTIONS の順) */
  choices: Direction[]
  /** 正解の方向から見た絵 */
  view: View
}

/** 選択肢の方向どうしで、見え方が(粗い署名でも)すべて違うか */
export function choicesDistinguishable(blocks: readonly Block[], choices: readonly Direction[]): boolean {
  const sigs = choices.map((d) => coarseSignature(computeView(blocks, d)))
  return new Set(sigs).size === sigs.length
}

export function buildTrial(level: Difficulty, rng: Rng = defaultRng): Trial {
  const cfg = LEVELS[level]
  const cells = Array.from({ length: GRID * GRID }, (_, i) => i)
  for (;;) {
    const positions = sample(cells, cfg.blocks, rng)
    const colors = sample(
      Array.from({ length: COLOR_COUNT }, (_, i) => i),
      cfg.blocks,
      rng,
    )
    const blocks: Block[] = positions.map((p, i) => ({
      row: Math.floor(p / GRID),
      col: p % GRID,
      height: randInt(1, cfg.maxHeight, rng),
      color: colors[i],
    }))
    // 高さが選べるレベルでは、高さがすべて同じにならないようにする(高さも手がかりにする)
    if (cfg.maxHeight >= 3 && new Set(blocks.map((b) => b.height)).size === 1) continue

    const answer = DIRECTIONS[randInt(0, DIRECTIONS.length - 1, rng)]
    const others = shuffle(
      DIRECTIONS.filter((d) => d !== answer),
      rng,
    ).slice(0, cfg.choices - 1)
    const choices = DIRECTIONS.filter((d) => d === answer || others.includes(d))

    const view = computeView(blocks, answer)
    if (!occlusionOk(view, cfg.occlusion)) continue
    if (!choicesDistinguishable(blocks, choices)) continue
    return { blocks, answer, choices, view }
  }
}

export function buildTrials(level: Difficulty, mode: PlayMode, rng: Rng = defaultRng): Trial[] {
  return Array.from({ length: TRIALS[mode] }, () => buildTrial(level, rng))
}
