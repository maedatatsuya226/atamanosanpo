import { defaultRng, randInt, sample, shuffle, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

/**
 * 同じ絵さがし(抹消課題に似た訓練課題)
 * 絵(絵文字)をすき間なく画面いっぱいに並べ、上の見本と同じ絵をすべてタップする。
 * 見落としを左右別に数える(半側空間無視の評価のため、正解は左右の半分に同じくらいずつ置く)。
 * 画像ファイルは使わず、端末の絵文字フォントで表示する。
 */

export type Category = 'food' | 'animal' | 'vehicle' | 'nature' | 'thing'

/**
 * 似た絵のグループ。同じグループの絵どうしは「似た絵」として扱う。
 * 旗・人物(肌の色)・合成絵文字・異体字セレクタが必要な絵文字は使わない(古い iOS や Windows で崩れるため)。
 * どれも Unicode 8.0 までの絵文字。
 */
export interface PictureGroup {
  category: Category
  items: readonly string[]
}

export const GROUPS: readonly PictureGroup[] = [
  { category: 'food', items: ['🍎', '🍏', '🍅', '🍒'] },
  { category: 'food', items: ['🍊', '🍋', '🍑', '🍐'] },
  { category: 'food', items: ['🍦', '🍧', '🍨'] },
  { category: 'food', items: ['🍙', '🍘', '🍚'] },
  { category: 'animal', items: ['🐶', '🐱', '🐻', '🐼'] },
  { category: 'animal', items: ['🐭', '🐹', '🐰', '🐨'] },
  { category: 'animal', items: ['🐔', '🐤', '🐧', '🐦'] },
  { category: 'animal', items: ['🐟', '🐠', '🐡', '🐬'] },
  { category: 'vehicle', items: ['🚗', '🚕', '🚙', '🚌'] },
  { category: 'vehicle', items: ['🚃', '🚄', '🚅'] },
  { category: 'vehicle', items: ['🚢', '⛵', '🚤'] },
  { category: 'nature', items: ['🌸', '🌺', '🌼', '🌻'] },
  { category: 'nature', items: ['🌲', '🌳', '🌴', '🌵'] },
  { category: 'thing', items: ['⚽', '⚾', '🏀', '🏐'] },
  { category: 'thing', items: ['🎩', '👒', '🎓'] },
  { category: 'thing', items: ['👟', '👞', '👠', '👢'] },
  { category: 'thing', items: ['🎸', '🎻', '🎺', '🎷'] },
  { category: 'thing', items: ['🏠', '🏡', '🏫'] },
]

export function groupOf(emoji: string): PictureGroup | undefined {
  return GROUPS.find((g) => g.items.includes(emoji))
}

export interface LevelConfig {
  /** 絵の数 */
  count: number
  /** はずれの絵の種類の数(似た絵を含む) */
  kinds: number
  /** 似た絵(見本と同じグループ)の種類の数。0 = 似た絵なし */
  similarKinds: number
  /** はずれの絵のうち似た絵の割合 */
  similarRatio: number
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { count: 20, kinds: 3, similarKinds: 0, similarRatio: 0 },
  2: { count: 30, kinds: 4, similarKinds: 0, similarRatio: 0 },
  3: { count: 40, kinds: 5, similarKinds: 1, similarRatio: 0.25 },
  4: { count: 50, kinds: 6, similarKinds: 2, similarRatio: 0.5 },
  5: { count: 60, kinds: 6, similarKinds: 3, similarRatio: 0.6 },
}

export const PRACTICE_COUNT = 12

/** 正解(見本と同じ絵)の数: 全体の約2割、最低4個 */
export function targetCount(count: number): number {
  return Math.max(4, Math.round(count * 0.2))
}

export function itemCountFor(level: Difficulty, mode: PlayMode): number {
  return mode === 'practice' ? PRACTICE_COUNT : LEVELS[level].count
}

export interface Field {
  width: number
  height: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Picture {
  emoji: string
  /** 絵の中心 */
  x: number
  y: number
  isTarget: boolean
  /** 見本と似た絵(同じグループ)か */
  similar: boolean
  /** タップの当たり判定(格子の1マス。となりと重ならない) */
  cell: Rect
}

export interface Round {
  field: Field
  sample: string
  items: Picture[]
  /** 絵文字の大きさ(field の単位) */
  fontSize: number
  /** 見つけた印(○)の半径 */
  ringR: number
}

/** 画面のふちの余白 */
const PAD = 8
/** マスに対する絵文字の大きさ */
const FONT_RATIO = 0.64
const MAX_FONT = 96
/** 絵文字に対する○の半径 */
const RING_RATIO = 0.64

/** 絵が一番大きくなる列数・行数を選ぶ(画面の縦横に合わせて変わる) */
export function gridFor(count: number, field: Field): { cols: number; rows: number } {
  const w = field.width - PAD * 2
  const h = field.height - PAD * 2
  let best = { cols: 1, rows: count, cell: 0, waste: 0 }
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols)
    const cell = Math.min(w / cols, h / rows)
    const waste = cols * rows - count
    if (cell > best.cell + 0.01 || (Math.abs(cell - best.cell) <= 0.01 && waste < best.waste)) {
      best = { cols, rows, cell, waste }
    }
  }
  return { cols: best.cols, rows: best.rows }
}

export interface Slot {
  x: number
  y: number
  cell: Rect
}

/**
 * 格子の各マスに1つずつ、少しずらして置く(ずれても○が自分のマスからはみ出さない)。
 * マスが余るときは、余るマスをランダムに選んで空ける。
 */
export function layoutSlots(
  count: number,
  field: Field,
  rng: Rng = defaultRng,
): { slots: Slot[]; fontSize: number; ringR: number } {
  const { cols, rows } = gridFor(count, field)
  const cw = (field.width - PAD * 2) / cols
  const ch = (field.height - PAD * 2) / rows
  const fontSize = Math.min(MAX_FONT, Math.min(cw, ch) * FONT_RATIO)
  const ringR = fontSize * RING_RATIO
  const jx = Math.max(0, cw / 2 - ringR - 3)
  const jy = Math.max(0, ch / 2 - ringR - 3)
  const cells = Array.from({ length: cols * rows }, (_, i) => i)
  const empty = new Set(sample(cells, cols * rows - count, rng))
  const slots: Slot[] = []
  for (const i of cells) {
    if (empty.has(i)) continue
    const r = Math.floor(i / cols)
    const c = i % cols
    const cell = { x: PAD + c * cw, y: PAD + r * ch, width: cw, height: ch }
    slots.push({
      x: cell.x + cw / 2 + (rng() * 2 - 1) * jx,
      y: cell.y + ch / 2 + (rng() * 2 - 1) * jy,
      cell,
    })
  }
  return { slots, fontSize, ringR }
}

export function sideOf(x: number, field: Field): 'left' | 'right' {
  return x < field.width / 2 ? 'left' : 'right'
}

/** 見本と、はずれの絵の種類を選ぶ */
export function choosePictures(
  cfg: LevelConfig,
  rng: Rng = defaultRng,
): { target: string; siblings: string[]; others: string[] } {
  const group = GROUPS[randInt(0, GROUPS.length - 1, rng)]
  const target = group.items[randInt(0, group.items.length - 1, rng)]
  const siblings = sample(
    group.items.filter((e) => e !== target),
    cfg.similarKinds,
    rng,
  )
  // 似ていない絵: 見本と別の分類(食べ物・動物…)のグループから1つずつ
  const otherGroups = shuffle(
    GROUPS.filter((g) => g.category !== group.category),
    rng,
  ).slice(0, Math.max(1, cfg.kinds - siblings.length))
  const others = otherGroups.map((g) => g.items[randInt(0, g.items.length - 1, rng)])
  return { target, siblings, others }
}

/** list の絵を順に繰り返して n 個にする */
function repeatTo(list: readonly string[], n: number): string[] {
  return Array.from({ length: n }, (_, i) => list[i % list.length])
}

export function buildRound(level: Difficulty, mode: PlayMode, field: Field, rng: Rng = defaultRng): Round {
  const cfg = LEVELS[level]
  const count = itemCountFor(level, mode)
  const nTargets = targetCount(count)
  const nDistractors = count - nTargets
  const { target, siblings, others } = choosePictures(cfg, rng)

  const nSimilar = siblings.length === 0 ? 0 : Math.max(siblings.length, Math.round(nDistractors * cfg.similarRatio))
  const distractors = shuffle(
    [
      ...repeatTo(siblings, nSimilar).map((emoji) => ({ emoji, similar: true })),
      ...repeatTo(others, nDistractors - nSimilar).map((emoji) => ({ emoji, similar: false })),
    ],
    rng,
  )

  const { slots, fontSize, ringR } = layoutSlots(count, field, rng)

  // 正解は左右の半分に同じくらいずつ(奇数のときはどちらかに1個多く)
  const left = shuffle(
    slots.map((_, i) => i).filter((i) => sideOf(slots[i].x, field) === 'left'),
    rng,
  )
  const right = shuffle(
    slots.map((_, i) => i).filter((i) => sideOf(slots[i].x, field) === 'right'),
    rng,
  )
  let nLeft = nTargets % 2 === 0 ? nTargets / 2 : (nTargets - 1) / 2 + (rng() < 0.5 ? 1 : 0)
  nLeft = Math.min(nLeft, left.length)
  const nRight = Math.min(nTargets - nLeft, right.length)
  nLeft = nTargets - nRight
  const targetSlots = new Set([...left.slice(0, nLeft), ...right.slice(0, nRight)])

  let d = 0
  const items: Picture[] = slots.map((s, i) => {
    if (targetSlots.has(i)) return { emoji: target, x: s.x, y: s.y, isTarget: true, similar: false, cell: s.cell }
    const pic = distractors[d++]
    return { emoji: pic.emoji, x: s.x, y: s.y, isTarget: false, similar: pic.similar, cell: s.cell }
  })
  return { field, sample: target, items, fontSize, ringR }
}

export interface SideCount {
  found: number
  total: number
}

/** 左右それぞれの、見つけた正解の数と正解の数 */
export function countBySide(round: Round, found: ReadonlySet<number>): Record<'left' | 'right', SideCount> {
  const out = { left: { found: 0, total: 0 }, right: { found: 0, total: 0 } }
  round.items.forEach((it, i) => {
    if (!it.isTarget) return
    const s = out[sideOf(it.x, round.field)]
    s.total += 1
    if (found.has(i)) s.found += 1
  })
  return out
}
