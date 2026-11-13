import type { CSSProperties } from 'react'
import { GameThumb } from '../components/GameThumb'
import { UpdateNotice } from '../components/UpdateNotice'
import { DOMAINS } from '../core/domains'
import { gamesByDomain } from '../games/registry'

interface Props {
  onSelectGame: (id: string) => void
  onOpenSettings: () => void
}

/** いちばん課題の多い領域の課題数(縦に並ぶ段の数) */
const MAX_ROWS = Math.max(...DOMAINS.map((d) => gamesByDomain(d.id).length))

/** 5つの領域を列に並べ、全課題をひと目で見渡せるようにする */
export function HomeScreen({ onSelectGame, onOpenSettings }: Props) {
  return (
    <div className="screen home">
      <header className="topbar">
        <h1 className="app-title">
          あたまのさんぽ<span className="app-subtitle">OT認知トレーニング</span>
        </h1>
        <UpdateNotice />
        <button type="button" className="btn btn-ghost" onClick={onOpenSettings}>
          設定
        </button>
      </header>

      <main className="home-body" style={{ '--rows': MAX_ROWS } as CSSProperties}>
        {DOMAINS.map((d) => (
          <section key={d.id} className="domain-section" aria-labelledby={`dom-${d.id}`}>
            <h2 id={`dom-${d.id}`} className="domain-heading" style={{ background: `var(${d.colorVar})` }}>
              {d.label}
            </h2>
            <div className="card-list">
              {gamesByDomain(d.id).map((g) => {
                const ready = Boolean(g.component)
                return (
                  <button
                    key={g.id}
                    type="button"
                    className="game-card"
                    onClick={() => onSelectGame(g.id)}
                    disabled={!ready}
                    title={g.summary}
                  >
                    <span
                      className="game-card-thumb"
                      style={{ background: `color-mix(in srgb, var(${d.colorVar}) 9%, #fff)` }}
                    >
                      <GameThumb id={g.id} />
                    </span>
                    <span className="game-card-title">{g.title}</span>
                    {!ready && <span className="badge-soon">準備中</span>}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </main>
      <p className="privacy-note">このアプリは患者さんの情報を入力・保存・送信しません。</p>
    </div>
  )
}
