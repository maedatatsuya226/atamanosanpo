import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import {
  buildBoard,
  cellOfNumber,
  checkStep,
  completeFrom,
  hamiltonianPath,
  isAdjacent,
  isComplete,
  isStuck,
  LEVELS,
  neighbors,
  numberPositions,
  strokeHint,
  validatePath,
  type Board,
} from './logic'

function isHamiltonian(path: readonly number[], size: number): boolean {
  if (path.length !== size * size || new Set(path).size !== size * size) return false
  return path.every((c, i) => i === 0 || isAdjacent(path[i - 1], c, size))
}

describe('hamiltonianPath', () => {
  it('3〜6マス四方で、すべてのマスを1回ずつ、となりへ進む道になる', () => {
    for (const size of [3, 4, 5, 6]) {
      for (let seed = 0; seed < 80; seed++) {
        expect(isHamiltonian(hamiltonianPath(size, seededRng(seed * 7 + size)), size)).toBe(true)
      }
    }
  })

  it('奇数の盤では両端が市松の多い方の色になる', () => {
    for (let seed = 0; seed < 50; seed++) {
      const p = hamiltonianPath(5, seededRng(seed))
      for (const c of [p[0], p[p.length - 1]]) expect((Math.floor(c / 5) + (c % 5)) % 2).toBe(0)
    }
  })

  it('乱数で形が変わる', () => {
    const shapes = new Set<string>()
    for (let seed = 0; seed < 30; seed++) shapes.add(hamiltonianPath(5, seededRng(seed)).join(','))
    expect(shapes.size).toBeGreaterThan(20)
  })
})

describe('numberPositions', () => {
  it('最初と最後を含み、途中は2マス以上あく', () => {
    for (let seed = 0; seed < 100; seed++) {
      const pos = numberPositions(25, 5, seededRng(seed))
      expect(pos).toHaveLength(5)
      expect(pos[0]).toBe(0)
      expect(pos[4]).toBe(24)
      for (let i = 1; i < pos.length; i++) expect(pos[i] - pos[i - 1]).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('buildBoard', () => {
  it('全レベルで、数字 1〜k が道の順に1個ずつ置かれ、作った道がルールを満たす', () => {
    for (const lv of DIFFICULTIES) {
      const cfg = LEVELS[lv]
      for (let seed = 0; seed < 60; seed++) {
        const b = buildBoard(lv, 'main', seededRng(seed * 31 + lv))
        expect(b.size).toBe(cfg.size)
        expect(b.last).toBe(cfg.numbers)
        expect(isHamiltonian(b.solution, cfg.size)).toBe(true)
        const placed = b.numbers.filter((n) => n > 0).sort((x, y) => x - y)
        expect(placed).toEqual(Array.from({ length: cfg.numbers }, (_, i) => i + 1))
        expect(b.numbers[b.solution[0]]).toBe(1)
        expect(b.numbers[b.solution[b.solution.length - 1]]).toBe(cfg.numbers)
        expect(validatePath(b, b.solution)).toBe(true)
      }
    }
  })

  it('練習は 3×3・数字3個', () => {
    const b = buildBoard(5, 'practice', seededRng(1))
    expect(b.size).toBe(3)
    expect(b.last).toBe(3)
  })
})

/**
 * 3×3 の固定盤面
 *  1 . .
 *  . 2 .
 *  . . 3
 * 道の例: 0→1→2→5→4→3→6→7→8
 */
const fixed: Board = {
  size: 3,
  numbers: [1, 0, 0, 0, 2, 0, 0, 0, 3],
  last: 3,
  solution: [0, 1, 2, 5, 4, 3, 6, 7, 8],
}

describe('validatePath', () => {
  it('作った道と違っても、ルールを満たせば正解', () => {
    expect(validatePath(fixed, fixed.solution)).toBe(true)
    expect(validatePath(fixed, [0, 3, 6, 7, 4, 1, 2, 5, 8])).toBe(true)
  })

  it('通っていないマスがあると不正解', () => {
    expect(validatePath(fixed, [0, 1, 2, 5, 4, 7, 8])).toBe(false)
  })

  it('同じマスを2回通ると不正解', () => {
    expect(validatePath(fixed, [0, 1, 2, 5, 4, 1, 4, 7, 8])).toBe(false)
  })

  it('数字の順番がちがうと不正解', () => {
    // 1 . 2 / . . . / 3 . 4
    const b: Board = { size: 3, numbers: [1, 0, 2, 0, 0, 0, 3, 0, 4], last: 4, solution: [0, 1, 2, 5, 4, 3, 6, 7, 8] }
    expect(validatePath(b, b.solution)).toBe(true)
    // 3 を 2 より先に通る(全マスを通り 4 で終わってはいる)
    expect(validatePath(b, [0, 3, 6, 7, 4, 1, 2, 5, 8])).toBe(false)
  })

  it('となりでないマスへ飛ぶと不正解', () => {
    expect(validatePath(fixed, [0, 1, 2, 4, 5, 3, 6, 7, 8])).toBe(false)
  })

  it('最後の数字で終わらないと不正解', () => {
    expect(validatePath(fixed, [0, 1, 2, 5, 8, 7, 4, 3, 6])).toBe(false)
  })

  it('1 から始まらないと不正解', () => {
    expect(validatePath(fixed, [1, 0, 3, 4, 2, 5, 6, 7, 8])).toBe(false)
  })
})

describe('checkStep', () => {
  it('となりの空きマスへは進める', () => {
    expect(checkStep(fixed, [0], 1)).toBe('ok')
    expect(checkStep(fixed, [0], 3)).toBe('ok')
  })
  it('ひとつ前のマスは「もどる」', () => {
    expect(checkStep(fixed, [0, 1], 0)).toBe('back')
  })
  it('となりでないマス・通ったマス', () => {
    expect(checkStep(fixed, [0], 4)).toBe('not-adjacent')
    expect(checkStep(fixed, [0, 1, 2, 5, 4, 3], 0)).toBe('visited')
  })
  it('数字の順番がちがうマスには入れない', () => {
    const b: Board = { ...fixed, numbers: [1, 3, 0, 0, 2, 0, 0, 0, 0] }
    expect(checkStep(b, [0], 1)).toBe('wrong-order')
  })
  it('ほかのマスが残っているうちは最後の数字に入れない', () => {
    expect(checkStep(fixed, [0, 1, 4, 5], 8)).toBe('goal-too-early')
    expect(checkStep(fixed, [0, 1, 2, 5, 4, 3, 6, 7], 8)).toBe('ok')
  })
  it('行き止まりを検出する', () => {
    // 0→1→2→5 : 8 にはまだ入れないが、4(数字2)へ進める
    expect(isStuck(fixed, [0, 1, 2, 5])).toBe(false)
    // 0→3→4→1→2→5 : 5 のとなりは 2(済),4(済),8(早すぎ) → 行き止まり
    expect(isStuck(fixed, [0, 3, 4, 1, 2, 5])).toBe(true)
  })
  it('全部通って最後の数字で終われば完成', () => {
    expect(isComplete(fixed, fixed.solution)).toBe(true)
    expect(isComplete(fixed, fixed.solution.slice(0, -1))).toBe(false)
  })
})

describe('ヒント', () => {
  it('作った道をたどっている途中なら、作った道の次のマスを指す', () => {
    for (let seed = 0; seed < 30; seed++) {
      const b = buildBoard(5, 'main', seededRng(seed))
      for (const len of [1, 3, 7]) {
        const h = strokeHint(b, b.solution.slice(0, len))
        expect(h).toEqual({ kind: 'next', cell: b.solution[len] })
      }
    }
  })

  it('ちがう道でも最後まで行けるなら、その続きのマスを指し、指すとおりに進めば必ずゴールできる', () => {
    for (let seed = 0; seed < 30; seed++) {
      const b = buildBoard(4, 'main', seededRng(seed))
      let trail = [cellOfNumber(b, 1)]
      // ヒントのとおりに最後まで進む
      for (let guard = 0; guard < 40 && !isComplete(b, trail); guard++) {
        const h = strokeHint(b, trail)
        if (h.kind === 'next') {
          expect(checkStep(b, trail, h.cell)).toBe('ok')
          trail = [...trail, h.cell]
        } else {
          trail = trail.slice(0, h.length)
        }
      }
      expect(isComplete(b, trail)).toBe(true)
      expect(validatePath(b, trail)).toBe(true)
    }
  })

  it('行き詰まる道では、最後まで行ける所まで戻るよう指す', () => {
    let checked = 0
    for (let seed = 0; seed < 60; seed++) {
      const b = buildBoard(3, 'main', seededRng(seed))
      // 作った道から外れて、行き詰まる道をさがす
      const start = cellOfNumber(b, 1)
      for (const first of neighbors(start, b.size)) {
        if (first === b.solution[1] || checkStep(b, [start], first) !== 'ok') continue
        const trail = [start, first]
        if (completeFrom(b, trail)) continue
        const h = strokeHint(b, trail)
        expect(h.kind).toBe('back')
        if (h.kind === 'back') {
          expect(h.length).toBeLessThan(trail.length)
          expect(completeFrom(b, trail.slice(0, h.length))).not.toBeNull()
        }
        checked++
      }
    }
    expect(checked).toBeGreaterThan(0)
  })
})
