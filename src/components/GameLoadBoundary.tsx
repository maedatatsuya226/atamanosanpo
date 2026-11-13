import { Component, type ReactNode } from 'react'

interface Props {
  onQuit: () => void
  children: ReactNode
}

interface State {
  failed: boolean
}

/**
 * 課題の画面を読み込めなかったとき(通信が切れた・アプリが新しい版に更新された直後など)に、
 * 真っ白な画面のままにせず、読み込みなおす手段を出す。
 */
export class GameLoadBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="load-error" role="alert">
        <p className="load-error-title">課題を表示できませんでした</p>
        <p className="dialog-note">通信の状態を確かめてから、読み込みなおしてください。</p>
        <div className="intro-actions">
          <button type="button" className="btn btn-ghost btn-lg" onClick={this.props.onQuit}>
            もどる
          </button>
          {/* 新しい版に更新された直後でも確実に直るよう、アプリごと読み込みなおす */}
          <button type="button" className="btn btn-primary btn-lg" onClick={() => location.reload()}>
            読み込みなおす
          </button>
        </div>
      </div>
    )
  }
}
