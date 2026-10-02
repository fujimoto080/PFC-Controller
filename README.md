# PFC Balance

PFC Balance は、日々の食事を記録して P（タンパク質）/ F（脂質）/ C（炭水化物）とカロリーを管理する Next.js アプリです。

## ドキュメント

- 全機能ドキュメント: [`docs/features.md`](docs/features.md)
- Android リリース手順: [`docs/android-release-guide.md`](docs/android-release-guide.md)
- 商品カタログへの店舗の追加手順: [`docs/catalog-stores.md`](docs/catalog-stores.md)

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
4. 食事提案の Google カレンダー連携を使う場合は、同じプロジェクトで Google Calendar API を有効にし、OAuth 同意画面のスコープに `https://www.googleapis.com/auth/calendar.readonly` を追加する（同意画面が「テスト」のままだとリフレッシュトークンが7日で失効するため、定期実行で使い続けるなら「本番」に公開する）。

### DB マイグレーション

スキーマは `scripts/migrate.mjs` で管理します。内容は冪等 (`CREATE TABLE IF NOT EXISTS` + `CREATE EXTENSION IF NOT EXISTS pgcrypto`)。

- **ローカル**: `pnpm migrate`
- **Vercel**: デプロイ毎に `pnpm vercel-build` が走る（Vercel は `scripts.vercel-build` を自動検出）。マイグレーション → Next.js ビルドの順に実行される。Vercel のビルド環境から `DATABASE_URL` にネットワーク到達できる必要があります。

生成されるテーブル:

- NextAuth 用: `users`, `accounts`, `sessions`, `verification_token`
- アプリ用: `pfc_user_settings`, `pfc_log_items`, `pfc_log_activities`, `pfc_foods`, `pfc_sports`
- MCP 連携の OAuth 用: `mcp_oauth_codes`, `mcp_oauth_tokens`

## AI 連携設定（AIでPFC推定）

記録フォームと食品リストの編集画面では、栄養成分表示の写真から OpenAI で **P/F/C とカロリーを読み取り**できます（成分表示が無い料理写真は推定）。記録フォームでは食べた内容をテキストで入力して OpenAI（Web 検索付き）で推定することもできます。

- サーバー側API: `POST /api/ai-nutrition`（テキスト推定・OpenAI）, `POST /api/ai-nutrition/image`（写真から読み取り・OpenAI）
- 使用モデル: `lib/server/openai.ts` の各呼び出しの `model`
- 必要な環境変数: `OPENAI_API_KEY`

ローカルで確認する場合は `.env.local` に以下を設定してください。

```bash
OPENAI_API_KEY=your_openai_api_key
```

GitHub Actions で運用する場合は、リポジトリの **Settings > Secrets and variables > Actions** に
`OPENAI_API_KEY` を登録して管理してください。

## 食事の提案（朝昼晩の通知）

提案画面（`/suggest`）で、今日の残り・直近10日の食事・予定・端末の現在地・周辺のお店をもとに OpenAI（Web 検索付き）が朝昼晩の食事をまとめて提案します（提案し直しは食事ごと）。毎朝 7:00（JST）に Vercel Cron が今日の朝昼晩の提案を作り、Web Push で通知します。

- 周辺のお店・最寄り駅: OpenStreetMap の Overpass API（キー不要）
- 予定（自宅・会社の位置、勤務時間、在宅の曜日）と通知のオン/オフ: 設定画面の「食事の提案」
- 苦手な食材・お店ごとの定番メニュー: 設定画面の「食の好み」
- 定期実行: `vercel.json` の `crons` → `GET /api/cron/meal-suggestions?slot=...`（Vercel Hobby では起動が指定時刻から最大1時間ずれることがある）
- 必要な環境変数:
  - `OPENAI_API_KEY`
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`（例: `mailto:you@example.com`）。鍵は `pnpm exec web-push generate-vapid-keys` で生成
  - `CRON_SECRET`（Vercel が Cron 呼び出し時に Bearer トークンとして付与する）
- 通知は Service Worker が必要なため本番ビルド（PWA / TWA）でのみ動作する

## スマホの消費カロリー連携

Android の Health Connect（Samsung Health などの活動消費）を、`PUT /api/health-sync` で 1 日 1 件の運動記録として同期できます。

- 認証はセッションではなく共有トークン: `Authorization: Bearer <HEALTH_SYNC_TOKEN>`（環境変数 `HEALTH_SYNC_TOKEN` が未設定なら無効）
- body: `{ "email": "<ログインメール>", "date": "YYYY-MM-DD", "caloriesBurned": 数値 }`。同じ日は上書きされ、0 kcal なら記録を消す
- 送るのはアクティブ消費のみ（基礎代謝分は目標カロリーに含まれるため）
- Android 側の送信は `twa/` のアプリが行う（`twa/app/src/main/java/app/vercel/pfc_controller/twa/`）

## ChatGPT 連携（MCP サーバー）

`/api/mcp` がリモート MCP サーバーになっており、ChatGPT から今日の摂取状況・食事履歴・登録食品を読み取って献立を提案させたり、食べた物や運動を記録させたりできます。
認証は OAuth で、認可サーバーもこのアプリ自身です（Google ログイン + 同意画面）。追加の環境変数は不要です。

### ChatGPT への登録

1. ChatGPT の **設定 > アプリ > 詳細設定** で開発者モードを有効にする
2. **アプリを作成** で以下を入力する
   - MCP サーバー URL: `https://<your-domain>/api/mcp`
   - 認証: OAuth
3. 表示される PFC Balance の同意画面で「許可」を押す

### 毎日の献立ルーティン

ChatGPT のタスク（スケジュール実行）などで、例えば次のように依頼します。

```text
PFC Balance で今日の摂取状況と直近の食事履歴を確認して、目標 PFC・カロリーの残りに収まる昼食と夕食の献立を提案して。
最近食べた物とはかぶらないようにして、登録食品にある店のメニューも候補に入れて。
```

### 提供ツール

| ツール                 | 内容                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `get_nutrition_status` | 指定日（既定は今日）の上限（目標 + 運動消費 − 前日までの繰越）・摂取済み・残り、食べた物、運動、プロフィール |
| `get_meal_history`     | 直近 1〜31 日の食事・運動記録（日ごとの合計・運動消費付き）                                                  |
| `list_foods`           | 登録食品（店舗メニュー等）と栄養値、お気に入りかどうか。キーワードで絞り込み可                               |
| `get_frequent_foods`   | 直近 N 日（既定 60 日）によく食べた食品の回数・最後に食べた日と、お気に入り食品                              |
| `list_sports`          | 登録スポーツと消費の単位 METs                                                                                |
| `log_meal`             | 食べた物（名前・PFC・kcal・店舗、日時は省略可）を食事記録に追加し、記録後の摂取状況を返す                    |
| `log_activity`         | 登録スポーツを強度・時間(分)つきで運動記録に追加し、記録後の摂取状況を返す                                   |

### OAuth の構成

- メタデータ: `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource/api/mcp`
- 認可（同意画面）: `/oauth/authorize` / トークン: `POST /api/oauth/token`
- クライアント登録は Client ID Metadata Document（CIMD）のみ対応。公開クライアント + PKCE (S256)
- アクセストークン 1 時間、リフレッシュトークン 90 日（使用ごとにローテーション）。DB にはハッシュのみ保存

## テスト・Lint

```bash
pnpm test
pnpm lint
```

### E2E テスト

Playwright でビルドしたアプリを起動し、モバイル端末（Pixel 7）の画面で主要な操作を確かめます（`e2e/`）。
Google ログインは経由せず、テストごとに DB にユーザーを作り、アプリと同じ `AUTH_SECRET` で発行したセッション Cookie でログインします。
接続先・認証設定は `e2e/env.ts` に固定しており、`.env.local` の DB は使いません。

```bash
# テスト用 Postgres（初回のみ作成。2 回目以降は docker start pfc-e2e-postgres）
docker run -d --name pfc-e2e-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pfc_e2e -p 54329:5432 postgres:17
pnpm exec playwright install chromium
pnpm test:e2e
```
