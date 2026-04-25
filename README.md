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

## 認証・DB設定

データ永続化と認証に Postgres + NextAuth v5 (Google) を使います。

### 必要な環境変数

`.env.local`（開発時）と Vercel の Environment Variables（本番）に以下を設定します。

```bash
DATABASE_URL=postgres://user:password@host:5432/dbname
AUTH_SECRET=$(openssl rand -base64 32)   # 本番とローカルで別値を推奨
AUTH_GOOGLE_ID=<Google OAuth Client ID>
AUTH_GOOGLE_SECRET=<Google OAuth Client Secret>
AUTH_URL=http://localhost:3000           # 本番は https://<your-domain>
AUTH_TRUST_HOST=true                     # Vercel 以外にデプロイする場合に必要
```

### Google OAuth のセットアップ

1. Google Cloud Console で OAuth 2.0 クライアント ID を作成（Web アプリケーション）。
2. 承認済みのリダイレクト URI に以下を追加:
   - `http://localhost:3000/api/auth/callback/google`（開発）
   - `https://<vercel-domain>/api/auth/callback/google`（本番）
3. 取得した Client ID / Secret を `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` に設定。

### DB マイグレーション

スキーマは `scripts/migrate.mjs` で管理します。内容は冪等 (`CREATE TABLE IF NOT EXISTS` + `CREATE EXTENSION IF NOT EXISTS pgcrypto`)。

- **ローカル**: `pnpm migrate`
- **Vercel**: デプロイ毎に `pnpm vercel-build` が走る（Vercel は `scripts.vercel-build` を自動検出）。マイグレーション → Next.js ビルドの順に実行される。Vercel のビルド環境から `DATABASE_URL` にネットワーク到達できる必要があります。

生成されるテーブル:
- NextAuth 用: `users`, `accounts`, `sessions`, `verification_token`
- アプリ用: `pfc_user_settings`, `pfc_daily_logs`, `pfc_foods`, `pfc_sports`

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
