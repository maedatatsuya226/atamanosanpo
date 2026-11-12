import { useCallback } from 'react'
import { useSettings } from './settings'

/** 効果音は外部ファイルを使わず Web Audio で合成する(通信なし・オフライン可) */
type Tone = 'correct' | 'wrong' | 'tap' | 'done'

let ctx: AudioContext | null = null

/** iPad では最初のタップ時に呼んで音声を有効化する必要がある */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

function beep(freq: number, startOffset: number, duration: number, type: OscillatorType, gain = 0.18) {
  if (!ctx) return
  const t0 = ctx.currentTime + startOffset
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(g).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

function play(tone: Tone): void {
  unlockAudio()
  if (!ctx) return
  switch (tone) {
    case 'correct':
      beep(880, 0, 0.15, 'sine')
      beep(1320, 0.1, 0.25, 'sine')
      break
    case 'wrong':
      // 責める印象にならないよう、低く短い柔らかい音にする
      beep(330, 0, 0.22, 'triangle', 0.12)
      break
    case 'tap':
      beep(660, 0, 0.06, 'sine', 0.08)
      break
    case 'done':
      beep(660, 0, 0.15, 'sine')
      beep(880, 0.12, 0.15, 'sine')
      beep(1100, 0.24, 0.3, 'sine')
      break
  }
}

export function useSound(): (tone: Tone) => void {
  const { settings } = useSettings()
  return useCallback(
    (tone: Tone) => {
      if (settings.sound) play(tone)
    },
    [settings.sound],
  )
}
