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

  CREATE TABLE IF NOT EXISTS pfc_daily_logs (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    total_protein DOUBLE PRECISION NOT NULL,
    total_fat DOUBLE PRECISION NOT NULL,
    total_carbs DOUBLE PRECISION NOT NULL,
    total_calories DOUBLE PRECISION NOT NULL,
    items_json JSONB NOT NULL,
    activities_json JSONB,
    PRIMARY KEY (user_id, date)
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

  CREATE TABLE IF NOT EXISTS pfc_sports (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sport_id TEXT NOT NULL,
    position INT NOT NULL,
    name TEXT NOT NULL,
    calories_burned DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (user_id, sport_id)
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
