import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { RotateHint } from './components/RotateHint'
import { SettingsProvider } from './core/settings'
import './styles.css'

// オフラインで使えるようにアプリ本体を端末にキャッシュする(結果や患者情報は含まない)
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <App />
      <RotateHint />
    </SettingsProvider>
  </StrictMode>,
)
