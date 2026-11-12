import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import {
  collapse,
  configFor,
  countBlocks,
  findGroup,
  generateBoard,
  gridFromRows,
  gridToRows,
  hasMoves,
  LEVELS,
  PRACTICE,
  removeCells,
} from './logic'

const sortPos = (ps: readonly (readonly [number, number])[]) => ps.map(([r, c]) => `${r},${c}`).sort()

describe('findGroup', () => {
  const g = gridFromRows([
    'AAB', //
    'BAB',
    'BBA',
  ])

  it('上下左右でつながった同じ色をすべて見つける', () => {
    expect(sortPos(findGroup(g, 0, 0))).toEqual(['0,0', '0,1', '1,1'])
    expect(sortPos(findGroup(g, 1, 0))).toEqual(['1,0', '2,0', '2,1'])
  })

  it('ななめはつながりとみなさない', () => {
    // (2,2) の A は (1,1) の A とななめにしか接していない
    expect(sortPos(findGroup(g, 2, 2))).toEqual(['2,2'])
    expect(sortPos(findGroup(g, 0, 2))).toEqual(['0,2', '1,2'])
  })

  it('空きマスは空の配列', () => {
    expect(findGroup(gridFromRows(['.A', 'AA']), 0, 0)).toEqual([])
  })
})

describe('removeCells / collapse', () => {
  it('消えた所に上のブロックが落ちる', () => {
    const g = gridFromRows([
      'AB', //
      'BB',
      'CA',
    ])
    const next = removeCells(g, findGroup(g, 0, 1))
    expect(gridToRows(next)).toEqual(['..', 'A.', 'CA'])
  })

  it('空になった列は左に詰める', () => {
    const g = gridFromRows([
      'ABC', //
      'ABC',
    ])
    const next = removeCells(g, findGroup(g, 0, 1))
    expect(gridToRows(next)).toEqual(['AC.', 'AC.'])
  })

  it('落下と左詰めが同時に起きても正しい', () => {
    const g = gridFromRows([
      'CB.', //
      'AB.',
      'ABB',
    ])
    // A を消すと C が下に落ちる(列は残る)
    const next = removeCells(g, findGroup(g, 1, 0))
    expect(gridToRows(next)).toEqual(['.B.', '.B.', 'CBB'])
    // B をまとめて消すと、残りは C だけになり左下へ
    const after = removeCells(next, findGroup(next, 0, 1))
    expect(gridToRows(after)).toEqual(['...', '...', 'C..'])

    // 左の列がまるごと消える → 右の列が左へ詰まる
    const g2 = gridFromRows([
      '.B.', //
      'AB.',
      'ABC',
    ])
    expect(gridToRows(removeCells(g2, findGroup(g2, 1, 0)))).toEqual(['B..', 'B..', 'BC.'])
  })

  it('ブロックの id は落ちても保たれる', () => {
    const g = gridFromRows(['B', 'A', 'A'])
    const topId = g[0][0]!.id
    const next = removeCells(g, findGroup(g, 2, 0))
    expect(next[2][0]!.id).toBe(topId)
  })

  it('何も消えていない盤面は変わらない', () => {
    const g = gridFromRows(['AB', 'BA'])
    expect(gridToRows(collapse(g))).toEqual(['AB', 'BA'])
  })
})

describe('hasMoves', () => {
  it('2個以上つながった所があれば true', () => {
    expect(hasMoves(gridFromRows(['AB', 'AC']))).toBe(true)
    expect(hasMoves(gridFromRows(['AA', 'BC']))).toBe(true)
  })

  it('市松模様や空の盤面は false', () => {
    expect(hasMoves(gridFromRows(['AB', 'BA']))).toBe(false)
    expect(hasMoves(gridFromRows(['..', '..']))).toBe(false)
    expect(hasMoves(gridFromRows(['A.', '.A']))).toBe(false)
  })
})

describe('generateBoard', () => {
  it('全レベルと練習で、指定どおりの大きさ・色数で、消せる所がある', () => {
    for (const cfg of [...DIFFICULTIES.map((lv) => LEVELS[lv]), PRACTICE]) {
      for (let seed = 0; seed < 50; seed++) {
        const g = generateBoard(cfg, seededRng(seed))
        expect(g).toHaveLength(cfg.rows)
        for (const row of g) expect(row).toHaveLength(cfg.cols)
        expect(countBlocks(g)).toBe(cfg.cols * cfg.rows)
        const colors = new Set(g.flat().map((b) => b!.color))
        expect(colors.size).toBe(cfg.colors)
        expect(Math.max(...colors)).toBe(cfg.colors - 1)
        const ids = new Set(g.flat().map((b) => b!.id))
        expect(ids.size).toBe(cfg.cols * cfg.rows)
        expect(hasMoves(g)).toBe(true)
      }
    }
  })

  it('同じ seed なら同じ盤面', () => {
    const a = generateBoard(LEVELS[3], seededRng(42))
    const b = generateBoard(LEVELS[3], seededRng(42))
    expect(gridToRows(a)).toEqual(gridToRows(b))
  })

  it('練習は 4×4・3色', () => {
    expect(configFor(5, 'practice')).toEqual({ cols: 4, rows: 4, colors: 3 })
    expect(configFor(5, 'main')).toEqual({ cols: 10, rows: 8, colors: 5 })
  })

  it('消し続けると必ず終わり、ブロック数は減るだけ', () => {
    for (let seed = 0; seed < 30; seed++) {
      const rng = seededRng(seed)
      let g = generateBoard(LEVELS[5], rng)
      let n = countBlocks(g)
      let guard = 0
      while (hasMoves(g) && guard++ < 200) {
        // 消せるグループを1つ探して消す
        let done = false
        for (let r = 0; r < g.length && !done; r++) {
          for (let c = 0; c < g[0].length && !done; c++) {
            const grp = findGroup(g, r, c)
            if (grp.length >= 2) {
              g = removeCells(g, grp)
              const m = countBlocks(g)
              expect(m).toBe(n - grp.length)
              n = m
              done = true
            }
          }
        }
      }
      expect(hasMoves(g)).toBe(false)
      // 浮いているブロックや、途中の空き列がない
      const { length: rows } = g
      for (let c = 0; c < g[0].length; c++) {
        for (let r = 0; r < rows - 1; r++) if (g[r][c]) expect(g[r + 1][c]).not.toBeNull()
        if (c > 0 && g[rows - 1][c]) expect(g[rows - 1][c - 1]).not.toBeNull()
      }
    }
  })
})
