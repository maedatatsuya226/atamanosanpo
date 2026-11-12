import { describe, expect, it } from 'vitest'
import { seededRng } from '../../core/random'
import { DIFFICULTIES } from '../../core/types'
import {
  buildSession,
  buildTrial,
  LEVELS,
  levelConfig,
  parseRuby,
  plainText,
  PRACTICE_LEVEL,
  selectQuestions,
  shortQuestion,
  speechText,
  STORY_COUNT,
} from './logic'
import { STORIES } from './stories'

describe('STORIES', () => {
  it('8話あり、idも題名も重複しない', () => {
    expect(STORIES.length).toBeGreaterThanOrEqual(8)
    expect(new Set(STORIES.map((s) => s.id)).size).toBe(STORIES.length)
    expect(new Set(STORIES.map((s) => s.title)).size).toBe(STORIES.length)
  })

  it('どの話も5文・4問で、問いの文番号が正しい', () => {
    for (const s of STORIES) {
      expect(s.sentences).toHaveLength(5)
      expect(s.questions).toHaveLength(4)
      for (const q of s.questions) {
        expect(Number.isInteger(q.sentence)).toBe(true)
        expect(q.sentence).toBeGreaterThanOrEqual(0)
        expect(q.sentence).toBeLessThan(s.sentences.length)
      }
      const order = s.questions.map((q) => q.sentence)
      expect(order).toEqual([...order].sort((a, b) => a - b))
    }
  })

  it('選択肢は4つで、答えを含み、重複しない', () => {
    for (const s of STORIES) {
      for (const q of s.questions) {
        const all = [q.answer, ...q.wrong].map(plainText)
        expect(all).toHaveLength(4)
        expect(new Set(all).size).toBe(4)
        for (const c of all) expect(c.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('ふりがなの書き方がくずれていない', () => {
    const texts = STORIES.flatMap((s) => [
      ...s.sentences,
      ...s.questions.flatMap((q) => [q.text, q.answer, ...q.wrong]),
    ])
    for (const t of texts) {
      expect(plainText(t)).not.toMatch(/[{}|]/)
      expect(speechText(t)).not.toMatch(/[{}|]/)
    }
  })

  it('どのレベルでも必要な問題数をそろえられる', () => {
    for (const s of STORIES) {
      for (const cfg of [...DIFFICULTIES.map((d) => LEVELS[d]), PRACTICE_LEVEL]) {
        expect(selectQuestions(s, cfg.sentences, cfg.questions)).toHaveLength(cfg.questions)
      }
    }
  })
})

describe('buildTrial', () => {
  it('見せていない文についての問題は出さない', () => {
    for (const s of STORIES) {
      for (const cfg of [...DIFFICULTIES.map((d) => LEVELS[d]), PRACTICE_LEVEL]) {
        const t = buildTrial(s, cfg, seededRng(1))
        expect(t.sentences).toEqual(s.sentences.slice(0, cfg.sentences))
        expect(t.questions).toHaveLength(cfg.questions)
        for (const q of t.questions) expect(q.sentence).toBeLessThan(cfg.sentences)
      }
    }
  })

  it('正解の位置は選択肢の中の答えを指す', () => {
    for (let seed = 0; seed < 50; seed++) {
      const t = buildTrial(STORIES[seed % STORIES.length], LEVELS[4], seededRng(seed))
      t.questions.forEach((q, i) => {
        expect(q.choices).toHaveLength(4)
        expect(q.choices[q.answerIndex]).toBe(t.story.questions[i].answer)
      })
    }
  })

  it('選択肢の並びは seed で決まり、seed が違えば変わることがある', () => {
    const a = buildTrial(STORIES[0], LEVELS[4], seededRng(7))
    const b = buildTrial(STORIES[0], LEVELS[4], seededRng(7))
    expect(a).toEqual(b)
    const positions = new Set<number>()
    for (let seed = 0; seed < 40; seed++) {
      positions.add(buildTrial(STORIES[0], LEVELS[4], seededRng(seed)).questions[0].answerIndex)
    }
    expect(positions.size).toBe(4)
  })
})

describe('buildSession', () => {
  it('本番は2話・練習は1話(2文・1問)で、同じ話をくり返さない', () => {
    for (let seed = 0; seed < 30; seed++) {
      const main = buildSession(levelConfig(3, 'main'), STORY_COUNT.main, seededRng(seed))
      expect(main).toHaveLength(2)
      expect(main[0].story.id).not.toBe(main[1].story.id)

      const practice = buildSession(levelConfig(5, 'practice'), STORY_COUNT.practice, seededRng(seed))
      expect(practice).toHaveLength(1)
      expect(practice[0].sentences).toHaveLength(2)
      expect(practice[0].questions).toHaveLength(1)
    }
  })
})

describe('ふりがな記法', () => {
  it('漢字とよみに分ける', () => {
    expect(parseRuby('{今日|きょう}は{雨|あめ}です')).toEqual([
      { text: '今日', ruby: 'きょう' },
      { text: 'は' },
      { text: '雨', ruby: 'あめ' },
      { text: 'です' },
    ])
    expect(parseRuby('ひらがなだけ')).toEqual([{ text: 'ひらがなだけ' }])
  })

  it('表示用・読み上げ用・結果用の文字', () => {
    expect(plainText('{山田|やまだ}さん')).toBe('山田さん')
    expect(speechText('{山田|やまだ}さん')).toBe('やまださん')
    expect(shortQuestion('どこへ {行|い}きましたか？')).toBe('どこへ 行きましたか')
  })
})
