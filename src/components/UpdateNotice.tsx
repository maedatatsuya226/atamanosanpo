import { useState } from 'react'
import { applyAppUpdate, useUpdateAvailable } from '../core/appUpdate'

/** 新しい版が届いたときだけ出る「更新する」ボタン(課題の途中には出さない画面に置く) */
export function UpdateNotice() {
  const available = useUpdateAvailable()
  const [applying, setApplying] = useState(false)
  if (!available) return null
  return (
    <div className="update-notice" role="status">
      <span className="update-notice-text">新しい版が あります</span>
      <button
        type="button"
        className="btn btn-primary"
        disabled={applying}
        onClick={() => {
          setApplying(true)
          applyAppUpdate()
        }}
      >
        {applying ? '更新中…' : '更新する'}
      </button>
    </div>
  )
}
