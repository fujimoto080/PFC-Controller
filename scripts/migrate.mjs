#!/usr/bin/env node
import pg from 'pg';

const { Pool } = pg;

const AUTH_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    email TEXT UNIQUE,
    "emailVerified" TIMESTAMPTZ,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at BIGINT,
    id_token TEXT,
    scope TEXT,
    session_state TEXT,
    token_type TEXT,
    UNIQUE (provider, "providerAccountId")
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires TIMESTAMPTZ NOT NULL,
    "sessionToken" TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS verification_token (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL,
    expires TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (identifier, token)
  );
`;

const APP_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS pfc_user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    target_protein DOUBLE PRECISION NOT NULL,
    target_fat DOUBLE PRECISION NOT NULL,
    target_carbs DOUBLE PRECISION NOT NULL,
    target_calories DOUBLE PRECISION NOT NULL,
    profile_json JSONB,
    favorite_food_ids_json JSONB
  );

  CREATE TABLE IF NOT EXISTS pfc_foods (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_id TEXT NOT NULL,
    position INT NOT NULL,
    name TEXT NOT NULL,
    protein DOUBLE PRECISION NOT NULL,
    fat DOUBLE PRECISION NOT NULL,
    carbs DOUBLE PRECISION NOT NULL,
    calories DOUBLE PRECISION NOT NULL,
    timestamp_ms BIGINT NOT NULL,
    store TEXT,
    store_group TEXT,
    image TEXT,
    PRIMARY KEY (user_id, food_id)
  );


  CREATE TABLE IF NOT EXISTS pfc_log_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    name TEXT NOT NULL,
    protein DOUBLE PRECISION NOT NULL,
    fat DOUBLE PRECISION NOT NULL,
    carbs DOUBLE PRECISION NOT NULL,
    calories DOUBLE PRECISION NOT NULL,
    timestamp_ms BIGINT NOT NULL,
    store TEXT,
    store_group TEXT,
    image TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_pfc_log_items_user_date
    ON pfc_log_items (user_id, date);
  CREATE INDEX IF NOT EXISTS idx_pfc_log_items_user_timestamp
    ON pfc_log_items (user_id, timestamp_ms DESC);

  CREATE TABLE IF NOT EXISTS pfc_sports (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sport_id TEXT NOT NULL,
    position INT NOT NULL,
    name TEXT NOT NULL,
    calories_burned DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (user_id, sport_id)
  );

  CREATE TABLE IF NOT EXISTS pfc_log_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    sport_id TEXT NOT NULL,
    name TEXT NOT NULL,
    calories_burned DOUBLE PRECISION NOT NULL,
    timestamp_ms BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pfc_log_activities_user_date
    ON pfc_log_activities (user_id, date);

  -- MCP 連携（ChatGPT など）向け OAuth。コード・トークンは SHA-256 ハッシュのみ保存する。
  CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
    code_hash TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    code_challenge TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
    token_hash TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('access', 'refresh')),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
  );

  -- 食事提案。居場所の推定に使う予定・食の好み、最後に取得した現在地、提案結果、Web Push の購読
  ALTER TABLE pfc_user_settings
    ADD COLUMN IF NOT EXISTS meal_schedule_json JSONB;
  ALTER TABLE pfc_user_settings
    ADD COLUMN IF NOT EXISTS meal_preferences_json JSONB;

  -- 超過・不足を繰り越さない日（記録を入れ忘れた日など）
  ALTER TABLE pfc_user_settings
    ADD COLUMN IF NOT EXISTS carryover_excluded_dates_json JSONB;

  CREATE TABLE IF NOT EXISTS pfc_user_locations (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- やり直した提案も残すため、食事枠ごとに作成時刻つきで何件でも持つ
  CREATE TABLE IF NOT EXISTS pfc_meal_suggestions (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    slot TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner')),
    suggestion_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  -- 食事枠ごとに 1 件だった頃のテーブルからの移行
  ALTER TABLE pfc_meal_suggestions
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  ALTER TABLE pfc_meal_suggestions
    DROP CONSTRAINT IF EXISTS pfc_meal_suggestions_pkey;
  CREATE INDEX IF NOT EXISTS pfc_meal_suggestions_user_date_idx
    ON pfc_meal_suggestions (user_id, date, created_at);

  -- 食事提案に使うその日の予定・気分。やり直しや定期実行でも使うため日ごとに保存する
  CREATE TABLE IF NOT EXISTS pfc_meal_notes (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    note TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, date)
  );

  CREATE TABLE IF NOT EXISTS pfc_push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_pfc_push_subscriptions_user
    ON pfc_push_subscriptions (user_id);

  -- 使われていない機能を見つけるための利用状況（画面表示・操作・MCP のツール呼び出し）
  CREATE TABLE IF NOT EXISTS pfc_usage_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('page', 'click', 'swipe', 'mcp')),
    name TEXT NOT NULL,
    path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_pfc_usage_events_user
    ON pfc_usage_events (user_id);
`;

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    if (process.env.SKIP_MIGRATE_WHEN_NO_DB === '1') {
      console.log('[migrate] DATABASE_URL 未設定のためスキップします');
      return;
    }
    throw new Error('DATABASE_URL が未設定です');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    console.log('[migrate] 拡張/テーブルを作成中...');
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await pool.query(AUTH_SCHEMA_SQL);
    await pool.query(APP_SCHEMA_SQL);
    console.log('[migrate] 完了');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[migrate] 失敗:', error);
  process.exit(1);
});
