import { defaultRng, sample, shuffle, type Rng } from '../../core/random'
import type { Difficulty, PlayMode } from '../../core/types'
import { STORIES, type Story } from './stories'

export interface LevelConfig {
  /** 見せる文の数(話の最初から) */
  sentences: number
  /** 1話あたりの問題数 */
  questions: number
  /** 読み終わってから問題を出すまでの待ち時間(秒) */
  delaySec: number
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  1: { sentences: 2, questions: 2, delaySec: 0 },
  2: { sentences: 3, questions: 3, delaySec: 0 },
  3: { sentences: 4, questions: 3, delaySec: 0 },
  4: { sentences: 5, questions: 4, delaySec: 0 },
  5: { sentences: 5, questions: 4, delaySec: 30 },
}

export const PRACTICE_LEVEL: LevelConfig = { sentences: 2, questions: 1, delaySec: 0 }

/** 1回に読む話の数 */
export const STORY_COUNT: Record<PlayMode, number> = { main: 2, practice: 1 }

export function levelConfig(difficulty: Difficulty, mode: PlayMode): LevelConfig {
  return mode === 'practice' ? PRACTICE_LEVEL : LEVELS[difficulty]
}

// ---- ふりがな記法 {漢字|よみ} ----

export interface Segment {
  text: string
  ruby?: string
}

const RUBY_RE = /\{([^|{}]+)\|([^|{}]+)\}/g

export function parseRuby(s: string): Segment[] {
  const out: Segment[] = []
  let last = 0
  for (const m of s.matchAll(RUBY_RE)) {
    const i = m.index ?? 0
    if (i > last) out.push({ text: s.slice(last, i) })
    out.push({ text: m[1], ruby: m[2] })
    last = i + m[0].length
  }
  if (last < s.length) out.push({ text: s.slice(last) })
  return out
}

/** 画面に出る文字(漢字のまま) */
export function plainText(s: string): string {
  return s.replace(RUBY_RE, '$1')
}

/** 読み上げ用(漢字はよみに置き換える) */
export function speechText(s: string): string {
  return s.replace(RUBY_RE, '$2')
}

// ---- 出題 ----

export interface Question {
  text: string
  choices: string[]
  answerIndex: number
  /** 答えが書いてある文の番号 */
  sentence: number
}

export interface StoryTrial {
  story: Story
  /** 見せる文 */
  sentences: string[]
  questions: Question[]
}

/** 見せた文の中に答えがある問いだけを、話の順に count 問選ぶ */
export function selectQuestions(story: Story, sentenceCount: number, count: number) {
  return story.questions.filter((q) => q.sentence < sentenceCount).slice(0, count)
}

export function buildTrial(story: Story, cfg: LevelConfig, rng: Rng = defaultRng): StoryTrial {
  const questions = selectQuestions(story, cfg.sentences, cfg.questions).map((q) => {
    const choices = shuffle([q.answer, ...q.wrong], rng)
    return { text: q.text, choices, answerIndex: choices.indexOf(q.answer), sentence: q.sentence }
  })
  return { story, sentences: story.sentences.slice(0, cfg.sentences), questions }
}

/** 1回分(同じ話は使わない) */
export function buildSession(cfg: LevelConfig, count: number, rng: Rng = defaultRng): StoryTrial[] {
  return sample(STORIES, count, rng).map((s) => buildTrial(s, cfg, rng))
}

/** 結果画面用に問いを短くする(ふりがな・「？」を外す) */
export function shortQuestion(text: string): string {
  return plainText(text).replace(/[？?。]$/, '')
}
