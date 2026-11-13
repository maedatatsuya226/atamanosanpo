import { defaultRng, randInt, type Rng } from './random'

/**
 * マス目(cols 列 × rows 行)の共通部品。マスの番号は 行 * cols + 列。
 * 向きは 0=上 1=右 2=下 3=左(時計回り)。
 */
export type Dir = 0 | 1 | 2 | 3
export const DIRS: readonly Dir[] = [0, 1, 2, 3]

export function opposite(d: Dir): Dir {
  return ((d + 2) % 4) as Dir
}

export function gridNeighbors(node: number, cols: number, rows: number): number[] {
  const out: number[] = []
  for (const d of DIRS) {
    const n = stepToward(node, d, cols, rows)
    if (n !== null) out.push(n)
  }
  return out
}

/** a から b へ向かう向き(となり合っていること) */
export function dirOf(a: number, b: number, cols: number): Dir {
  if (b === a - cols) return 0
  if (b === a + 1) return 1
  if (b === a + cols) return 2
  return 3
}

/** node から dir の向きにあるとなりのマス(盤の外なら null) */
export function stepToward(node: number, dir: Dir, cols: number, rows: number): number | null {
  const r = Math.floor(node / cols)
  const c = node % cols
  if (dir === 0) return r > 0 ? node - cols : null
  if (dir === 1) return c < cols - 1 ? node + 1 : null
  if (dir === 2) return r < rows - 1 ? node + cols : null
  return c > 0 ? node - 1 : null
}

/**
 * マス目全体をおおう木(ループのない道)をランダムに作る。
 * newestBias が大きいほど、くねくねした長い道になり、小さいほど分かれ道が増える。
 */
export function spanningTree(cols: number, rows: number, rng: Rng = defaultRng, newestBias = 0.5): number[][] {
  const n = cols * rows
  const adj: number[][] = Array.from({ length: n }, () => [])
  const seen = new Array<boolean>(n).fill(false)
  const first = randInt(0, n - 1, rng)
  seen[first] = true
  const active = [first]
  while (active.length > 0) {
    const i = rng() < newestBias ? active.length - 1 : randInt(0, active.length - 1, rng)
    const cur = active[i]
    const options = gridNeighbors(cur, cols, rows).filter((x) => !seen[x])
    if (options.length === 0) {
      active.splice(i, 1)
      continue
    }
    const next = options[randInt(0, options.length - 1, rng)]
    adj[cur].push(next)
    adj[next].push(cur)
    seen[next] = true
    active.push(next)
  }
  return adj
}

/** from からの区間数と、ひとつ手前のマス(たどれないマスは -1) */
export function distances(adj: number[][], from: number): { dist: number[]; parent: number[] } {
  const dist = new Array<number>(adj.length).fill(-1)
  const parent = new Array<number>(adj.length).fill(-1)
  dist[from] = 0
  const queue = [from]
  for (let q = 0; q < queue.length; q++) {
    const cur = queue[q]
    for (const nb of adj[cur]) {
      if (dist[nb] >= 0) continue
      dist[nb] = dist[cur] + 1
      parent[nb] = cur
      queue.push(nb)
    }
  }
  return { dist, parent }
}

/** parent をたどって from → to の道順を返す */
export function pathTo(parent: number[], to: number): number[] {
  const out: number[] = []
  for (let cur = to; cur !== -1; cur = parent[cur]) out.push(cur)
  return out.reverse()
}
