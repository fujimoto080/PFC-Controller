# PFC Balance

PFC Balance は、日々の食事を記録して P（タンパク質）/ F（脂質）/ C（炭水化物）とカロリーを管理する Next.js アプリです。

## ドキュメント

- 全機能ドキュメント: [`docs/features.md`](docs/features.md)
- Android リリース手順: [`docs/android-release-guide.md`](docs/android-release-guide.md)

## 開発環境の起動

```bash
pnpm install
pnpm dev
```

ブラウザで `http://localhost:3000` を開いて確認できます。

## Gemini 連携設定（AIでPFC推定）

追加画面の「写真」タブでは、食べた内容をテキスト入力して Gemini で **P/F/C とカロリーを推定**できます。

- サーバー側API: `POST /api/ai-nutrition`
- 必要な環境変数: `GEMINI_API_KEY`

ローカルで確認する場合は `.env.local` に以下を設定してください。

```bash
GEMINI_API_KEY=your_gemini_api_key
```

GitHub Actions で運用する場合は、リポジトリの **Settings > Secrets and variables > Actions** に
`GEMINI_API_KEY` を登録して管理してください。


## 過去1週間のテストデータ投入 + UIチェック

履歴画面とホーム画面（過去日のグラフ表示）確認用に、過去1週間分のログを `localStorage` に投入して `/log` と `/` の表示を検証するスクリプトを用意しています。

```bash
pnpm exec playwright install chromium
pnpm seed:week-ui-check
```

- デフォルトURL: `http://127.0.0.1:3000`
- 別URLを使う場合: `BASE_URL=http://127.0.0.1:3001 pnpm seed:week-ui-check`
- 成功時スクリーンショット:
  - `artifacts/seed-week-log-ui-check.png`
  - `artifacts/seed-week-home-graph-check.png`

## テスト・Lint

```bash
pnpm test
pnpm lint
```
