/** 0以上1未満を返す乱数関数。テストでは seededRng を渡して結果を固定する。 */
export type Rng = () => number

export const defaultRng: Rng = Math.random

/** min以上max以下の整数 */
export function randInt(min: number, max: number, rng: Rng = defaultRng): number {
  return min + Math.floor(rng() * (max - min + 1))
}

export function shuffle<T>(items: readonly T[], rng: Rng = defaultRng): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 重複なしで n 個取り出す */
export function sample<T>(items: readonly T[], n: number, rng: Rng = defaultRng): T[] {
  return shuffle(items, rng).slice(0, n)
}

/** 再現可能な乱数(mulberry32) */
export function seededRng(seed: number): Rng {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
