import { useEffect, useLayoutEffect, useState } from 'react'
import { Feedback } from '../../components/Feedback'
import { R } from '../../components/Ruby'
import { useElementSize, usePausableTimeout } from '../../core/hooks'
import { useSettings } from '../../core/settings'
import { useSound } from '../../core/sound'
import type { DetailRow, GameProps } from '../../core/types'
import { buildSession, levelConfig, parseRuby, plainText, shortQuestion, speechText, STORY_COUNT } from './logic'
import { useSpeech } from './speech'
import './story-memory.css'

/** 正解のとき、次の問題へ進むまでの時間 */
const CORRECT_DELAY_MS = 1500

type Phase = 'read' | 'delay' | 'question'

interface AnswerRecord {
  story: number
  question: number
  text: string
  chosen: string
  answer: string
  ok: boolean
}

export default function StoryMemoryGame({ difficulty, mode, paused, onFinish }: GameProps) {
  const sound = useSound()
  const cfg = levelConfig(difficulty, mode)
  const [trials] = useState(() => buildSession(cfg, STORY_COUNT[mode]))
  const [storyIdx, setStoryIdx] = useState(0)
  const [qIdx, setQIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('read')
  const [remaining, setRemaining] = useState(cfg.delaySec)
  const [chosen, setChosen] = useState<number | null>(null)
  const [records, setRecords] = useState<AnswerRecord[]>([])
  const speech = useSpeech()
  const { stop: stopSpeech } = speech

  const trial = trials[storyIdx]
  const q = trial.questions[qIdx]
  const answered = chosen !== null
  const correct = answered && chosen === q.answerIndex

  // 一時停止したら読み上げも止める
  useEffect(() => {
    if (paused) stopSpeech()
  }, [paused, stopSpeech])

  const doneReading = () => {
    stopSpeech()
    if (cfg.delaySec > 0) {
      setRemaining(cfg.delaySec)
      setPhase('delay')
    } else {
      setPhase('question')
    }
  }

  usePausableTimeout(
    () => {
      if (remaining <= 1) setPhase('question')
      else setRemaining(remaining - 1)
    },
    phase === 'delay' ? 1000 : null,
    paused,
    `${storyIdx}-${remaining}`,
  )

  const finish = (all: AnswerRecord[]) => {
    const details: DetailRow[] = all.map((r) => ({
      label: trials.length > 1 ? `${r.story + 1}話 問${r.question + 1}` : `問${r.question + 1}`,
      value: `${r.text} → ${r.chosen}${r.ok ? '' : `(正答: ${r.answer})`}`,
      mark: r.ok ? 'correct' : 'wrong',
    }))
    const ok = all.filter((r) => r.ok).length
    onFinish({
      correct: ok,
      total: all.length,
      errors: all.length - ok,
      extra: [{ label: 'お話', value: trials.map((t) => t.story.title).join('・') }],
      details,
    })
  }

  const goNext = () => {
    if (qIdx + 1 < trial.questions.length) {
      setQIdx(qIdx + 1)
      setChosen(null)
      return
    }
    if (storyIdx + 1 < trials.length) {
      setStoryIdx(storyIdx + 1)
      setQIdx(0)
      setChosen(null)
      setPhase('read')
      return
    }
    finish(records)
  }

  usePausableTimeout(goNext, phase === 'question' && correct ? CORRECT_DELAY_MS : null, paused, `${storyIdx}-${qIdx}`)

  const choose = (i: number) => {
    if (answered) return
    const ok = i === q.answerIndex
    sound(ok ? 'correct' : 'wrong')
    setChosen(i)
    setRecords([
      ...records,
      {
        story: storyIdx,
        question: qIdx,
        text: shortQuestion(q.text),
        chosen: plainText(q.choices[i]),
        answer: plainText(q.choices[q.answerIndex]),
        ok,
      },
    ])
  }

  const progress = (
    <p className="progress-text">
      おはなし {storyIdx + 1} / {trials.length}
      {phase === 'question' && (
        <>
          {'　'}しつもん {qIdx + 1} / {trial.questions.length}
        </>
      )}
    </p>
  )

  if (phase === 'read') {
    return (
      <div className="sm">
        <div className="sm-head">
          {progress}
          <p className="task-instruction">おはなしを よんで ください</p>
        </div>
        <StoryText sentences={trial.sentences} />
        <div className="sm-foot">
          {speech.supported && (
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              onClick={() => (speech.speaking ? stopSpeech() : speech.speak(trial.sentences.map(speechText).join('')))}
            >
              {speech.speaking ? 'とめる' : 'よみあげる'}
            </button>
          )}
          <button type="button" className="btn btn-primary btn-lg" onClick={doneReading}>
            よみおわりました
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'delay') {
    return (
      <div className="sm">
        <div className="sm-head">
          {progress}
          <p className="task-instruction">すこし まって ください</p>
        </div>
        <div className="sm-wait-area">
          <div className="sm-wait" aria-live="polite">
            <span className="sm-wait-num">{remaining}</span>
            <span className="sm-wait-unit">びょう</span>
          </div>
          <p className="sm-wait-note">このあと おはなしに ついて しつもんを します</p>
        </div>
      </div>
    )
  }

  return (
    <div className="sm">
      <div className="sm-head">
        {progress}
        <p className="sm-question">
          <RubyText text={q.text} />
        </p>
        <Feedback kind={!answered ? null : correct ? 'correct' : 'wrong'}>
          {correct && '○ せいかい！'}
          {answered && !correct && (
            <>
              <span>
                ✕ こたえは 「<RubyText text={q.choices[q.answerIndex]} />」 です
              </span>
              <button type="button" className="btn btn-primary" onClick={goNext}>
                つぎへ
              </button>
            </>
          )}
        </Feedback>
      </div>
      <div className="sm-choices">
        {q.choices.map((c, i) => {
          const isAnswer = answered && i === q.answerIndex
          const isWrong = answered && i === chosen && !correct
          return (
            <button
              key={c}
              type="button"
              className={`sm-choice ${isAnswer ? 'is-answer' : ''} ${isWrong ? 'is-wrong' : ''} ${answered && !isAnswer && !isWrong ? 'is-dim' : ''}`}
              onClick={() => choose(i)}
              disabled={answered}
            >
              <RubyText text={c} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** {漢字|よみ} を R(ふりがな)に変換して表示する */
function RubyText({ text }: { text: string }) {
  return (
    <>
      {parseRuby(text).map((seg, i) =>
        seg.ruby ? (
          <R key={i} k={seg.ruby}>
            {seg.text}
          </R>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  )
}

const MAX_FONT = 48
const MIN_FONT = 18

/** 話の本文。枠に収まるいちばん大きな文字にする */
function StoryText({ sentences }: { sentences: string[] }) {
  const [boxRef, box] = useElementSize<HTMLDivElement>()
  const { settings } = useSettings()
  const [font, setFont] = useState(MAX_FONT)

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el || box.height === 0) return
    let f = MAX_FONT
    el.style.fontSize = `${f}px`
    while (f > MIN_FONT && el.scrollHeight > el.clientHeight + 1) {
      f -= 2
      el.style.fontSize = `${f}px`
    }
    setFont(f)
  }, [boxRef, sentences, box.width, box.height, settings.furigana, settings.fontScale])

  return (
    <div className="sm-text" ref={boxRef} style={{ fontSize: font }}>
      <div className="sm-text-inner">
        {sentences.map((s, i) => (
          <p key={i}>
            <RubyText text={s} />
          </p>
        ))}
      </div>
    </div>
  )
}
