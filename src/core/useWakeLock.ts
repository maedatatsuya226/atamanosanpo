import { useEffect } from 'react'

/** 課題中に画面が暗くならないようにする(対応ブラウザのみ。非対応なら何もしない) */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        const s = await navigator.wakeLock.request('screen')
        if (cancelled) void s.release()
        else sentinel = s
      } catch {
        // 省電力モードなどで拒否されることがある
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release()
    }
  }, [active])
}
