import type { ReactNode } from 'react'
import { useSettings } from '../core/settings'

/** 設定「ふりがな」がオンのときだけ読みがなを付ける。 例: <R k="きょう">今日</R> */
export function R({ k, children }: { k: string; children: ReactNode }) {
  const { settings } = useSettings()
  if (!settings.furigana) return <>{children}</>
  return (
    <ruby>
      {children}
      <rt>{k}</rt>
    </ruby>
  )
}
