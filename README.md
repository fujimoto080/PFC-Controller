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

## テスト・Lint

```bash
pnpm test
pnpm lint
```

## 外部投稿用MCPサーバー

外部クライアントからバックアップデータを投稿・取得する用途は、HTTP API ではなく MCP サーバーとして利用できます。

- 起動コマンド: `pnpm mcp:backup`
- 提供ツール:
  - `create_temp_backup`: バックアップデータを投稿して `backupId` と `expiresAt` を取得
  - `get_temp_backup`: `backupId` を指定してバックアップを取得

MCPサーバーは Upstash Redis を利用するため、既存APIと同様に Redis 用の環境変数設定が必要です。
