/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      // 新しい版は勝手に切り替えず、ホーム画面の「更新する」で切り替える(課題の途中で読み込みなおさない)
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'あたまのさんぽ ― OT認知トレーニング',
        short_name: 'あたまのさんぽ',
        description: '作業療法で使う高次脳機能の訓練教材(患者情報を入力しない設計)',
        lang: 'ja',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#f6f4ef',
        theme_color: '#2f6f5e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
