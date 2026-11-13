import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { RotateHint } from './components/RotateHint'
import { startAppUpdates } from './core/appUpdate'
import { SettingsProvider } from './core/settings'
import './styles.css'

// オフラインで使えるようにアプリ本体を端末にキャッシュし、新しい版が出ていないか確かめる
// (キャッシュするのはアプリ本体だけで、結果や患者情報は含まない)
startAppUpdates()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <App />
      <RotateHint />
    </SettingsProvider>
  </StrictMode>,
)
