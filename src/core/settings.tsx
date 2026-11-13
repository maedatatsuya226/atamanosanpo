import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * 端末に保存するのはこの設定だけ。患者さんに関する情報や結果は保存しない。
 */
export interface Settings {
  fontScale: 'normal' | 'large' | 'xlarge'
  sound: boolean
  furigana: boolean
  /** 課題に「ヒント」「こたえを見る」ボタンを出す */
  assist: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  fontScale: 'normal',
  sound: true,
  furigana: true,
  assist: true,
}

const STORAGE_KEY = 'ot-cog-settings-v1'

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      fontScale: ['normal', 'large', 'xlarge'].includes(parsed.fontScale as string)
        ? (parsed.fontScale as Settings['fontScale'])
        : DEFAULT_SETTINGS.fontScale,
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULT_SETTINGS.sound,
      furigana: typeof parsed.furigana === 'boolean' ? parsed.furigana : DEFAULT_SETTINGS.furigana,
      assist: typeof parsed.assist === 'boolean' ? parsed.assist : DEFAULT_SETTINGS.assist,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // 保存できない環境(プライベートブラウズ等)でもアプリは動く
  }
}

interface SettingsContextValue {
  settings: Settings
  update: (patch: Partial<Settings>) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  useEffect(() => {
    document.documentElement.dataset.fs = settings.fontScale
    saveSettings(settings)
  }, [settings])

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, update: (patch) => setSettings((s) => ({ ...s, ...patch })) }),
    [settings],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}
