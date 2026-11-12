import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import { FIELD_LANDSCAPE, FIELD_PORTRAIT, gridLayout } from '../number-order/logic'
import { GOJUON, labelsFor, LEVELS, PRACTICE_COUNT } from './logic'

describe('labelsFor', () => {
  it('「あ」から五十音順に、レベルの文字数だけ', () => {
    expect(labelsFor(1, 'main')).toEqual(['あ', 'い', 'う', 'え', 'お'])
    expect(labelsFor(2, 'main').slice(5)).toEqual(['か', 'き', 'く', 'け', 'こ'])
    expect(labelsFor(5, 'main')).toEqual([...GOJUON])
    for (const lv of DIFFICULTIES) expect(labelsFor(lv, 'practice')).toHaveLength(PRACTICE_COUNT)
  })
})

describe('gridLayout', () => {
  it.each([
    ['横向き', FIELD_LANDSCAPE],
    ['縦向き', FIELD_PORTRAIT],
  ])('%s: 画面内に収まり、丸が重ならない', (_, field) => {
    for (const lv of DIFFICULTIES) {
      const { radius } = LEVELS[lv]
      for (let seed = 0; seed < 30; seed++) {
        const ts = gridLayout(labelsFor(lv, 'main'), radius, field, seededRng(seed))
        for (const t of ts) {
          expect(t.x - radius).toBeGreaterThanOrEqual(0)
          expect(t.y - radius).toBeGreaterThanOrEqual(0)
          expect(t.x + radius).toBeLessThanOrEqual(field.width)
          expect(t.y + radius).toBeLessThanOrEqual(field.height)
        }
        for (let i = 0; i < ts.length; i++) {
          for (let j = i + 1; j < ts.length; j++) {
            expect(Math.hypot(ts[i].x - ts[j].x, ts[i].y - ts[j].y)).toBeGreaterThan(radius * 2)
          }
        }
      }
    }
  })
})
