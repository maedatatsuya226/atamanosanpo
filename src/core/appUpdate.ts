import { useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'

/**
 * アプリの更新(新しい版)の確認と切り替え。
 *
 * - 起動したとき・アプリが前面に戻ったとき・開いている間は30分ごとに、新しい版が公開されていないか確かめる。
 *   (iPad のホーム画面アプリは閉じずに前面へ戻ることが多く、そのままだと更新に気づけないため)
 * - 新しい版が届いても勝手には切り替えない。課題の途中で画面が読み込みなおされないよう、
 *   ホーム画面などに「更新する」ボタンを出し、押したときに切り替える。
 * - 通信するのは自分のサイトの sw.js だけ(外部への通信はしない)。
 */
const CHECK_INTERVAL_MS = 30 * 60 * 1000

let updateAvailable = false
let applyFn: (() => Promise<void>) | null = null
const listeners = new Set<() => void>()

function setUpdateAvailable(v: boolean) {
  updateAvailable = v
  listeners.forEach((l) => l())
}

export function startAppUpdates(): void {
  applyFn = registerSW({
    immediate: true,
    onNeedRefresh: () => setUpdateAvailable(true),
    onRegisteredSW: (_url, registration) => {
      if (!registration) return
      const check = () => {
        if (navigator.onLine === false) return
        registration.update().catch(() => {
          // 院内Wi-Fiが切れているときなどは、次の機会にまた確かめる
        })
      }
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.setInterval(check, CHECK_INTERVAL_MS)
    },
  })
}

/** 新しい版に切り替える(画面を読み込みなおす) */
export function applyAppUpdate(): void {
  void applyFn?.()
}

/** 新しい版が届いていて、切り替えを待っているか */
export function useUpdateAvailable(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => updateAvailable,
  )
}
