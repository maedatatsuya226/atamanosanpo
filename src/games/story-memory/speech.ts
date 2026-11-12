import { useCallback, useEffect, useState } from 'react'

/** 端末の読み上げ(Web Speech API)。通信はしない。使えない端末では supported=false */
export function speechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  )
}

function cancelSpeech() {
  if (speechSupported()) window.speechSynthesis.cancel()
}

export function useSpeech() {
  const [supported] = useState(speechSupported)
  const [speaking, setSpeaking] = useState(false)

  const stop = useCallback(() => {
    cancelSpeech()
    setSpeaking(false)
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (!supported) return
      const synth = window.speechSynthesis
      synth.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'ja-JP'
      u.rate = 0.85
      const voice = synth.getVoices().find((v) => v.lang.replace('_', '-').startsWith('ja'))
      if (voice) u.voice = voice
      u.onend = () => setSpeaking(false)
      u.onerror = () => setSpeaking(false)
      setSpeaking(true)
      synth.speak(u)
    },
    [supported],
  )

  // 画面を離れたら読み上げを止める
  useEffect(() => cancelSpeech, [])

  return { supported, speaking, speak, stop }
}
