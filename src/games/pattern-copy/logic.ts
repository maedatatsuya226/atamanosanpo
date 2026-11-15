import { defaultRng, randInt, shuffle, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'

/**
 * 模様づくり
 * 左の見本と同じ模様になるよう、右のマスを色で塗る(構成・空間の位置関係を写しとる力)。
 * 色を選んでからマスを押すと塗れる。「けす」を選んで押すと白に戻る。
 * 「できた」で確かめ、ちがうマスは示されるので直してやり直せる。
 * 検査用の積み木模様の図版はまねず、模様は毎回ランダムに作る。
 */
export interface LevelConfig {
  size: number
  /** 使う色の数 */
  colors: 1 | 2 | 3
  /** 塗るマスの数の範囲 */
  minFill: number
  maxFill: number
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { size: 3, colors: 1, minFill: 3, maxFill: 4 },
  2: { size: 3, colors: 2, minFill: 4, maxFill: 5 },
  3: { size: 4, colors: 2, minFill: 6, maxFill: 8 },
  4: { size: 4, colors: 3, minFill: 7, maxFill: 9 },
  5: { size: 5, colors: 3, minFill: 10, maxFill: 13 },
}

export const PROBLEMS: Record<PlayMode, number> = { main: 4, practice: 1 }

/** 0 = 白(塗らない)、1〜3 = 色 */
export type Pattern = number[]

export function buildPattern(cfg: LevelConfig, rng: Rng = defaultRng): Pattern {
  const n = cfg.size * cfg.size
  for (let attempt = 0; attempt < 200; attempt++) {
    const fill = randInt(cfg.minFill, cfg.maxFill, rng)
    const cells = shuffle(
      Array.from({ length: n }, (_, i) => i),
      rng,
    ).slice(0, fill)
    const p: Pattern = new Array(n).fill(0)
    // どの色も1マス以上使う
    cells.forEach((c, i) => (p[c] = i < cfg.colors ? i + 1 : randInt(1, cfg.colors, rng)))
    // 1行・1列まるごと同じ、のような単純すぎる形や、まったく同じ模様の連続は避ける(ゆるい条件)
    const rows = Array.from({ length: cfg.size }, (_, r) => p.slice(r * cfg.size, (r + 1) * cfg.size))
    if (rows.every((row) => row.every((v) => v === 0) || row.every((v) => v !== 0)) && cfg.size > 3) continue
    return p
  }
  throw new Error('模様を作れませんでした')
}

export function buildProblems(level: Difficulty, mode: PlayMode, rng: Rng = defaultRng): Pattern[] {
  const cfg = LEVELS[level]
  const out: Pattern[] = []
  for (let guard = 0; out.length < PROBLEMS[mode] && guard < 100; guard++) {
    const p = buildPattern(cfg, rng)
    if (out.some((q) => q.join() === p.join())) continue
    out.push(p)
  }
  return out
}

/** マスごとに、見本と同じか */
export function checkCells(model: Pattern, work: Pattern): boolean[] {
  return model.map((v, i) => work[i] === v)
}

/** ヒント: 最初のちがうマス(上の行から)と、そこに塗る色。全部同じなら null */
export function cellHint(model: Pattern, work: Pattern): { cell: number; color: number } | null {
  const i = model.findIndex((v, k) => work[k] !== v)
  return i < 0 ? null : { cell: i, color: model[i] }
}
