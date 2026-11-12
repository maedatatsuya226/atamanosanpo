# あたまのさんぽ(OT認知トレーニング)

作業療法で使う高次脳機能の訓練教材(iPad向けWebアプリ)。計画は [計画書.md](計画書.md) を参照。

- 患者さんの情報は入力・保存・送信しない。結果は画面に表示するだけ。
- 端末に保存するのは表示設定(文字サイズ・効果音・ふりがな)のみ。
- 一度読み込めばオフラインで動く(PWA)。

## 開発

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

開発中は `http://localhost:5173/?game=<課題ID>` でその課題の準備画面から始められる(本番ビルドでは無効)。

```bash
npm run build
```

## Cloudflare Pages への公開

初回だけ、Cloudflare アカウントでログインする(ブラウザが開く)。

```bash
npx wrangler login
```

公開(ビルドしてアップロード)。初回はプロジェクト `atama-no-sanpo` が作られ、`https://atama-no-sanpo.pages.dev` のようなURLになる(同じ名前が使われていれば、Cloudflareが別の文字を付け足す)。

```bash
npm run deploy
```

`public/_headers` で次を設定している。

- 検索エンジンに載せない(`X-Robots-Tag: noindex`)
- 外部への通信を禁止(`Content-Security-Policy: connect-src 'self'`)
- カメラ・マイク・位置情報を禁止(`Permissions-Policy`)

院内からだけ開けるようにする場合は、Cloudflare の管理画面で Zero Trust → Access を使い、病院のIPアドレスからのみ許可する。

## iPad での使い方

1. Safari で公開URLを開く
2. 共有ボタン →「ホーム画面に追加」
3. 以後はホーム画面のアイコンから起動する(オフラインでも動く)

更新を公開すると、次に起動したときに自動で新しい版に切り替わる。

## 構成

| 場所 | 内容 |
|---|---|
| `src/core/` | 型、設定、効果音、計測タイマー、乱数など共通部品 |
| `src/screens/` | ホーム・難易度選択・実施・結果・設定の各画面 |
| `src/components/` | 数字パッド、ふりがななど共通の部品 |
| `src/games/registry.ts` | 全14課題の一覧(未実装は「準備中」表示) |
| `src/games/<課題ID>/` | 各課題。`logic.ts`(問題生成・判定)とテスト、画面コンポーネント |
| `public/_headers` | Cloudflare Pages の応答ヘッダー |
| `scripts/make-icons.mjs` | アプリアイコンの生成(`node scripts/make-icons.mjs`) |

### 課題の追加方法

1. `src/games/<課題ID>/` に `GameProps` を受け取るコンポーネントを作る
2. 終了時に `onFinish({ correct, total, errors, extra, details })` を呼ぶ(所要時間は共通側で計測)
3. `paused` が true の間は、時間で進む処理を止める
4. 説明文は課題フォルダの `meta.ts`(`summary`・`howTo`・`levels`)に書き、`registry.ts` で読み込んで `component: lazy(() => import(...))` を追加する。ホームのカードには短い `summary`、準備画面には詳しい `description` を出す
5. 問題生成・正誤判定は `logic.ts` に分けてテストを書く
6. 盤面などは `flex: 1; min-height: 0` で課題画面の高さに収め、1180×820・1024×768・820×1180(縦)で、はみ出さないことを確認する
