import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import { FIELD_LANDSCAPE, FIELD_PORTRAIT, fieldFor, labelsFor, layoutTargets, LEVELS, PRACTICE_COUNT } from './logic'

describe('labelsFor', () => {
  it('数字だけのレベルは 1 から順に', () => {
    expect(labelsFor(1, 'main')).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
  })

  it('交互のレベルは 1→あ→2→い… で 25 個(13 で終わる)', () => {
    const labels = labelsFor(5, 'main')
    expect(labels).toHaveLength(25)
    expect(labels.slice(0, 6)).toEqual(['1', 'あ', '2', 'い', '3', 'う'])
    expect(labels[24]).toBe('13')
    expect(new Set(labels).size).toBe(25)
  })

  it('練習は短い', () => {
    for (const lv of DIFFICULTIES) expect(labelsFor(lv, 'practice')).toHaveLength(PRACTICE_COUNT)
    expect(labelsFor(5, 'practice')).toEqual(['1', 'あ', '2', 'い', '3'])
  })
})

describe('layoutTargets', () => {
  it('iPadの向きで画面の形を選ぶ', () => {
    expect(fieldFor(1180, 700)).toBe(FIELD_LANDSCAPE)
    expect(fieldFor(780, 1000)).toBe(FIELD_PORTRAIT)
  })

  it.each([
    ['横向き', FIELD_LANDSCAPE],
    ['縦向き', FIELD_PORTRAIT],
  ])('%s: 全レベルで、丸が画面内に収まり重ならない', (_, FIELD) => {
    for (const lv of DIFFICULTIES) {
      const cfg = LEVELS[lv]
      for (let seed = 0; seed < 40; seed++) {
        const ts = layoutTargets(labelsFor(lv, 'main'), cfg, FIELD, seededRng(seed))
        expect(ts).toHaveLength(cfg.count)
        for (const t of ts) {
          expect(t.x - cfg.radius).toBeGreaterThanOrEqual(0)
          expect(t.y - cfg.radius).toBeGreaterThanOrEqual(0)
          expect(t.x + cfg.radius).toBeLessThanOrEqual(FIELD.width)
          expect(t.y + cfg.radius).toBeLessThanOrEqual(FIELD.height)
        }
        for (let i = 0; i < ts.length; i++) {
          for (let j = i + 1; j < ts.length; j++) {
            expect(Math.hypot(ts[i].x - ts[j].x, ts[i].y - ts[j].y)).toBeGreaterThanOrEqual(cfg.radius * 2 + cfg.gap)
          }
        }
      }
    }
  })
})
