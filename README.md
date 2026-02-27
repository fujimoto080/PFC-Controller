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

## 外部連携MCPサーバー（摂取履歴の登録）

外部のAIや自動化ツールとは、HTTP API ではなく MCP サーバー経由で連携できます。

- 起動: `pnpm mcp:intake`
- 利用ツール:
  - `register_intakes`（摂取履歴の一括登録）
  - `list_intakes`（登録済み履歴の取得。`limit/startAt/endAt` 指定可）

`register_intakes` の入力例（arguments）:

```json
{
  "entries": [
    {
      "name": "サラダチキン",
      "protein": 23,
      "fat": 2,
      "carbs": 1.5,
      "calories": 120,
      "store": "コンビニ",
      "source": "external-ai",
      "consumedAt": "2026-02-26T12:30:00+09:00"
    }
  ]
}
```

`consumedAt` は未指定時に現在時刻が使われます。

## テスト・Lint

```bash
pnpm test
pnpm lint
```
