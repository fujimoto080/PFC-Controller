#!/usr/bin/env node
import pg from 'pg';

const { Pool } = pg;

/**
 * pfc_daily_logs の items_json / activities_json を
 * 正規化テーブル pfc_log_items / pfc_log_activities に展開する
 * 1 回きりの移行スクリプト。
 *
 * 冪等性:
 *   - すでに pfc_daily_logs_legacy_* が存在する場合は skip。
 *   - pfc_daily_logs が存在しない場合も skip。
 *
 * 運用手順:
 *   1. `pnpm migrate` で新スキーマを作成 (pfc_log_items / pfc_log_activities)
 *   2. `pnpm migrate:logs` で本スクリプトを 1 度だけ実行
 *   3. アプリをデプロイ
 */

function yyyymmdd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

async function tableExists(client, name) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1 LIMIT 1`,
    [name],
  );
  return rows.length > 0;
}

async function legacyTableExists(client) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = current_schema()
       AND table_name LIKE 'pfc_daily_logs_legacy_%'
     LIMIT 1`,
  );
  return rows.length > 0;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    if (process.env.SKIP_MIGRATE_WHEN_NO_DB === '1') {
      console.log('[migrate-logs] DATABASE_URL 未設定のためスキップします');
      return;
    }
    throw new Error('DATABASE_URL が未設定です');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    if (!(await tableExists(client, 'pfc_daily_logs'))) {
      console.log('[migrate-logs] pfc_daily_logs が存在しないためスキップ');
      return;
    }

    if (await legacyTableExists(client)) {
      console.log('[migrate-logs] pfc_daily_logs_legacy_* が既に存在するためスキップ (実行済み)');
      return;
    }

    if (!(await tableExists(client, 'pfc_log_items'))) {
      throw new Error(
        'pfc_log_items テーブルがありません。先に `pnpm migrate` を実行してください',
      );
    }
    if (!(await tableExists(client, 'pfc_log_activities'))) {
      throw new Error(
        'pfc_log_activities テーブルがありません。先に `pnpm migrate` を実行してください',
      );
    }

    const legacyName = `pfc_daily_logs_legacy_${yyyymmdd()}`;
    console.log(`[migrate-logs] 開始: pfc_daily_logs -> ${legacyName}`);

    await client.query('BEGIN');

    // items_json を pfc_log_items に展開
    const itemsRes = await client.query(`
      INSERT INTO pfc_log_items (
        id, user_id, date, name,
        protein, fat, carbs, calories,
        timestamp_ms, store, store_group, image
      )
      SELECT
        CASE
          WHEN item->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN (item->>'id')::uuid
          ELSE gen_random_uuid()
        END,
        d.user_id,
        d.date::date,
        COALESCE(item->>'name', ''),
        COALESCE((item->>'protein')::float, 0),
        COALESCE((item->>'fat')::float, 0),
        COALESCE((item->>'carbs')::float, 0),
        COALESCE((item->>'calories')::float, 0),
        COALESCE((item->>'timestamp')::bigint, 0),
        item->>'store',
        item->>'storeGroup',
        item->>'image'
      FROM pfc_daily_logs d, jsonb_array_elements(d.items_json) AS item
      WHERE jsonb_typeof(d.items_json) = 'array'
    `);
    console.log(`[migrate-logs] pfc_log_items に ${itemsRes.rowCount} 行 INSERT`);

    // activities_json を pfc_log_activities に展開
    // 旧 activities の id は SportDefinition.id (= 種目 ID)。新 id は常に UUID 新規発行。
    const actsRes = await client.query(`
      INSERT INTO pfc_log_activities (
        id, user_id, date, sport_id, name, calories_burned, timestamp_ms
      )
      SELECT
        gen_random_uuid(),
        d.user_id,
        d.date::date,
        COALESCE(activity->>'id', ''),
        COALESCE(activity->>'name', ''),
        COALESCE((activity->>'caloriesBurned')::float, 0),
        COALESCE((activity->>'timestamp')::bigint, 0)
      FROM pfc_daily_logs d, jsonb_array_elements(d.activities_json) AS activity
      WHERE jsonb_typeof(d.activities_json) = 'array'
    `);
    console.log(`[migrate-logs] pfc_log_activities に ${actsRes.rowCount} 行 INSERT`);

    // 旧テーブルをリネーム (削除はしない)
    await client.query(`ALTER TABLE pfc_daily_logs RENAME TO ${legacyName}`);
    console.log(`[migrate-logs] pfc_daily_logs を ${legacyName} にリネーム`);

    await client.query('COMMIT');
    console.log('[migrate-logs] 完了');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[migrate-logs] 失敗:', error);
  process.exit(1);
});
