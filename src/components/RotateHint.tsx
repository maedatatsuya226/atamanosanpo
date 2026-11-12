import { useEffect, useState } from 'react'

/** タッチ端末(iPad)を縦に持っているとき */
const PORTRAIT_TOUCH = '(orientation: portrait) and (pointer: coarse)'

function matches(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(PORTRAIT_TOUCH).matches === true
}

/**
 * iPadを縦に持っているときに「よこむきに してください」と案内する。
 * Safari では画面の向きをアプリから固定できないため、案内だけ出す。
 * 「このまま たてで つかう」を押したら、アプリを開き直すまで出さない(端末には保存しない)。
 */
export function RotateHint() {
  const [portrait, setPortrait] = useState(matches)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia?.(PORTRAIT_TOUCH)
    if (!mq) return
    const onChange = () => setPortrait(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  if (!portrait || dismissed) return null

  return (
    <div className="rotate-hint" role="dialog" aria-modal="true" aria-labelledby="rotate-title">
      <div className="rotate-card">
        <svg className="rotate-icon" viewBox="0 0 120 90" aria-hidden="true">
          {/* 縦のiPad → 横のiPad */}
          <rect x={8} y={14} width={34} height={50} rx={5} fill="#fff" stroke="#4a524d" strokeWidth={3} />
          <path d="M52 40 q14 -16 28 0" fill="none" stroke="#2f6f5e" strokeWidth={4} strokeLinecap="round" />
          <path d="M76 32 l5 9 l-10 1 z" fill="#2f6f5e" />
          <rect x={64} y={50} width={50} height={34} rx={5} fill="#dcebe5" stroke="#2f6f5e" strokeWidth={3} />
        </svg>
        <h2 id="rotate-title">iPadを よこむきに して ください</h2>
        <p className="rotate-note">
          よこむきの ほうが みやすく なります。
          <br />
          向きが変わらないときは、コントロールセンターの「画面の向きのロック」を解除してください。
        </p>
        <button type="button" className="btn btn-ghost btn-lg" onClick={() => setDismissed(true)}>
          このまま たてで つかう
        </button>
      </div>
    </div>
  )
}
