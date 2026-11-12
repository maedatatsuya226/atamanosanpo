import { useSettings, type Settings } from '../core/settings'

const FONT_OPTIONS: { value: Settings['fontScale']; label: string }[] = [
  { value: 'normal', label: '標準' },
  { value: 'large', label: '大' },
  { value: 'xlarge', label: '特大' },
]

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="setting-row">
      <span className="setting-label">{label}</span>
      <div className="segmented segmented-sm" role="radiogroup" aria-label={label}>
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={checked === v}
            className={`segment ${checked === v ? 'is-selected' : ''}`}
            onClick={() => onChange(v)}
          >
            {v ? 'オン' : 'オフ'}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { settings, update } = useSettings()

  return (
    <div className="screen settings">
      <header className="topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ‹ もどる
        </button>
        <div className="topbar-title">
          <h1>設定</h1>
        </div>
        <span />
      </header>

      <main className="settings-body">
        <div className="setting-row">
          <span className="setting-label">文字の大きさ</span>
          <div className="segmented segmented-sm" role="radiogroup" aria-label="文字の大きさ">
            {FONT_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={settings.fontScale === o.value}
                className={`segment ${settings.fontScale === o.value ? 'is-selected' : ''}`}
                onClick={() => update({ fontScale: o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <Toggle label="効果音" checked={settings.sound} onChange={(v) => update({ sound: v })} />
        <Toggle label="ふりがな" checked={settings.furigana} onChange={(v) => update({ furigana: v })} />

        <section className="about">
          <h2>このアプリについて</h2>
          <ul>
            <li>作業療法で使う高次脳機能の訓練教材です。診断や評価を目的としたものではありません。</li>
            <li>患者さんの氏名・ID などは入力しません。結果は画面に表示するだけで保存しません。</li>
            <li>端末に保存するのは、この画面の設定だけです。外部への送信は行いません。</li>
            <li>見当識の課題は端末の時計を正解として使います。端末の日付が正しいことを確認してください。</li>
          </ul>
          <p className="version">バージョン {__APP_VERSION__}</p>
        </section>
      </main>
    </div>
  )
}
