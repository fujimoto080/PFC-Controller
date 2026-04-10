import 'server-only';

import { Pool, PoolClient } from 'pg';
import { BackupPayload } from '@/lib/backup';

interface PersistentData {
  payload: BackupPayload | null;
  updatedAt: number;
}

interface CloudDataStore {
  get(syncKey: string): Promise<PersistentData>;
  set(syncKey: string, payload: BackupPayload, updatedAt: number): Promise<void>;
}

interface SnapshotRow {
  version: number;
  created_at_ms: string | number;
  updated_at_ms: string | number;
}

interface SettingsRow {
  target_protein: number;
  target_fat: number;
  target_carbs: number;
  target_calories: number;
  cloud_sync_key: string | null;
  profile_json: unknown;
  favorite_food_ids_json: unknown;
}

interface LogRow {
  date: string;
  total_protein: number;
  total_fat: number;
  total_carbs: number;
  total_calories: number;
  items_json: unknown;
  activities_json: unknown;
}

interface FoodRow {
  food_id: string;
  position: number;
  name: string;
  protein: number;
  fat: number;
  carbs: number;
  calories: number;
  timestamp_ms: string | number;
  store: string | null;
  store_group: string | null;
  image: string | null;
}

interface SportRow {
  sport_id: string;
  position: number;
  name: string;
  calories_burned: number;
}

function normalizeSyncKey(syncKey: string): string {
  return syncKey.trim();
}

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL が未設定です');
  }

  return databaseUrl;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value !== 'number') return fallback;
  return Number.isFinite(value) ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

class PostgresCloudDataStore implements CloudDataStore {
  private readonly pool: Pool;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.pool = new Pool({ connectionString: getDatabaseUrl() });
  }

  private async ensureTables() {
    if (!this.initPromise) {
      this.initPromise = this.pool
        .query(`
          CREATE TABLE IF NOT EXISTS pfc_cloud_snapshots (
            sync_key TEXT PRIMARY KEY,
            version INT NOT NULL,
            created_at_ms BIGINT NOT NULL,
            updated_at_ms BIGINT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS pfc_cloud_settings (
            sync_key TEXT PRIMARY KEY REFERENCES pfc_cloud_snapshots(sync_key) ON DELETE CASCADE,
            target_protein DOUBLE PRECISION NOT NULL,
            target_fat DOUBLE PRECISION NOT NULL,
            target_carbs DOUBLE PRECISION NOT NULL,
            target_calories DOUBLE PRECISION NOT NULL,
            cloud_sync_key TEXT,
            profile_json JSONB,
            favorite_food_ids_json JSONB
          );

          CREATE TABLE IF NOT EXISTS pfc_cloud_daily_logs (
            sync_key TEXT NOT NULL REFERENCES pfc_cloud_snapshots(sync_key) ON DELETE CASCADE,
            date TEXT NOT NULL,
            total_protein DOUBLE PRECISION NOT NULL,
            total_fat DOUBLE PRECISION NOT NULL,
            total_carbs DOUBLE PRECISION NOT NULL,
            total_calories DOUBLE PRECISION NOT NULL,
            items_json JSONB NOT NULL,
            activities_json JSONB,
            PRIMARY KEY (sync_key, date)
          );

          CREATE TABLE IF NOT EXISTS pfc_cloud_foods (
            sync_key TEXT NOT NULL REFERENCES pfc_cloud_snapshots(sync_key) ON DELETE CASCADE,
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
            PRIMARY KEY (sync_key, food_id)
          );

          CREATE TABLE IF NOT EXISTS pfc_cloud_sports (
            sync_key TEXT NOT NULL REFERENCES pfc_cloud_snapshots(sync_key) ON DELETE CASCADE,
            sport_id TEXT NOT NULL,
            position INT NOT NULL,
            name TEXT NOT NULL,
            calories_burned DOUBLE PRECISION NOT NULL,
            PRIMARY KEY (sync_key, sport_id)
          );
        `)
        .then(() => undefined);
    }

    await this.initPromise;
  }

  private async replaceSettings(
    client: PoolClient,
    syncKey: string,
    settings: Record<string, unknown>,
  ) {
    const target = asRecord(settings.targetPFC);

    await client.query('DELETE FROM pfc_cloud_settings WHERE sync_key = $1', [syncKey]);
    await client.query(
      `
      INSERT INTO pfc_cloud_settings (
        sync_key,
        target_protein,
        target_fat,
        target_carbs,
        target_calories,
        cloud_sync_key,
        profile_json,
        favorite_food_ids_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
      `,
      [
        syncKey,
        toFiniteNumber(target.protein),
        toFiniteNumber(target.fat),
        toFiniteNumber(target.carbs),
        toFiniteNumber(target.calories),
        typeof settings.cloudSyncKey === 'string' ? settings.cloudSyncKey : null,
        JSON.stringify(settings.profile ?? null),
        JSON.stringify(asArray(settings.favoriteFoodIds)),
      ],
    );
  }

  private async replaceLogs(
    client: PoolClient,
    syncKey: string,
    logs: Record<string, unknown>,
  ) {
    await client.query('DELETE FROM pfc_cloud_daily_logs WHERE sync_key = $1', [syncKey]);

    for (const [date, logRaw] of Object.entries(logs)) {
      const log = asRecord(logRaw);
      const total = asRecord(log.total);
      const items = asArray(log.items);
      const activities = asArray(log.activities);

      await client.query(
        `
        INSERT INTO pfc_cloud_daily_logs (
          sync_key,
          date,
          total_protein,
          total_fat,
          total_carbs,
          total_calories,
          items_json,
          activities_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
        `,
        [
          syncKey,
          date,
          toFiniteNumber(total.protein),
          toFiniteNumber(total.fat),
          toFiniteNumber(total.carbs),
          toFiniteNumber(total.calories),
          JSON.stringify(items),
          JSON.stringify(activities),
        ],
      );
    }
  }

  private async replaceFoods(client: PoolClient, syncKey: string, foods: unknown[]) {
    await client.query('DELETE FROM pfc_cloud_foods WHERE sync_key = $1', [syncKey]);

    for (const [position, foodRaw] of foods.entries()) {
      const food = asRecord(foodRaw);
      const foodId =
        typeof food.id === 'string' && food.id.trim() ? food.id.trim() : `food-${position}`;

      await client.query(
        `
        INSERT INTO pfc_cloud_foods (
          sync_key,
          food_id,
          position,
          name,
          protein,
          fat,
          carbs,
          calories,
          timestamp_ms,
          store,
          store_group,
          image
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (sync_key, food_id)
        DO UPDATE SET
          position = EXCLUDED.position,
          name = EXCLUDED.name,
          protein = EXCLUDED.protein,
          fat = EXCLUDED.fat,
          carbs = EXCLUDED.carbs,
          calories = EXCLUDED.calories,
          timestamp_ms = EXCLUDED.timestamp_ms,
          store = EXCLUDED.store,
          store_group = EXCLUDED.store_group,
          image = EXCLUDED.image
        `,
        [
          syncKey,
          foodId,
          position,
          typeof food.name === 'string' ? food.name : '',
          toFiniteNumber(food.protein),
          toFiniteNumber(food.fat),
          toFiniteNumber(food.carbs),
          toFiniteNumber(food.calories),
          toFiniteNumber(food.timestamp),
          typeof food.store === 'string' ? food.store : null,
          typeof food.storeGroup === 'string' ? food.storeGroup : null,
          typeof food.image === 'string' ? food.image : null,
        ],
      );
    }
  }

  private async replaceSports(client: PoolClient, syncKey: string, sports: unknown[]) {
    await client.query('DELETE FROM pfc_cloud_sports WHERE sync_key = $1', [syncKey]);

    for (const [position, sportRaw] of sports.entries()) {
      const sport = asRecord(sportRaw);
      const sportId =
        typeof sport.id === 'string' && sport.id.trim() ? sport.id.trim() : `sport-${position}`;

      await client.query(
        `
        INSERT INTO pfc_cloud_sports (
          sync_key,
          sport_id,
          position,
          name,
          calories_burned
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (sync_key, sport_id)
        DO UPDATE SET
          position = EXCLUDED.position,
          name = EXCLUDED.name,
          calories_burned = EXCLUDED.calories_burned
        `,
        [
          syncKey,
          sportId,
          position,
          typeof sport.name === 'string' ? sport.name : '',
          toFiniteNumber(sport.caloriesBurned),
        ],
      );
    }
  }

  private buildSettings(row?: SettingsRow): Record<string, unknown> {
    if (!row) return {};

    return {
      targetPFC: {
        protein: row.target_protein,
        fat: row.target_fat,
        carbs: row.target_carbs,
        calories: row.target_calories,
      },
      cloudSyncKey: row.cloud_sync_key ?? undefined,
      profile: row.profile_json ?? undefined,
      favoriteFoodIds: asArray(row.favorite_food_ids_json),
    };
  }

  private buildLog(row: LogRow): Record<string, unknown> {
    return {
      date: row.date,
      total: {
        protein: row.total_protein,
        fat: row.total_fat,
        carbs: row.total_carbs,
        calories: row.total_calories,
      },
      items: asArray(row.items_json),
      activities: asArray(row.activities_json),
    };
  }

  private buildFood(row: FoodRow): Record<string, unknown> {
    return {
      id: row.food_id,
      name: row.name,
      protein: row.protein,
      fat: row.fat,
      carbs: row.carbs,
      calories: row.calories,
      timestamp: Number(row.timestamp_ms),
      store: row.store ?? undefined,
      storeGroup: row.store_group ?? undefined,
      image: row.image ?? undefined,
    };
  }

  private buildSport(row: SportRow): Record<string, unknown> {
    return {
      id: row.sport_id,
      name: row.name,
      caloriesBurned: row.calories_burned,
    };
  }

  async get(syncKey: string): Promise<PersistentData> {
    await this.ensureTables();

    const normalizedKey = normalizeSyncKey(syncKey);
    const snapshotResult = await this.pool.query<SnapshotRow>(
      `
      SELECT version, created_at_ms, updated_at_ms
      FROM pfc_cloud_snapshots
      WHERE sync_key = $1
      LIMIT 1
      `,
      [normalizedKey],
    );

    const snapshot = snapshotResult.rows[0];
    if (!snapshot) {
      return { payload: null, updatedAt: 0 };
    }

    const [settingsResult, logsResult, foodsResult, sportsResult] = await Promise.all([
      this.pool.query<SettingsRow>(
        `
        SELECT
          target_protein,
          target_fat,
          target_carbs,
          target_calories,
          cloud_sync_key,
          profile_json,
          favorite_food_ids_json
        FROM pfc_cloud_settings
        WHERE sync_key = $1
        LIMIT 1
        `,
        [normalizedKey],
      ),
      this.pool.query<LogRow>(
        `
        SELECT
          date,
          total_protein,
          total_fat,
          total_carbs,
          total_calories,
          items_json,
          activities_json
        FROM pfc_cloud_daily_logs
        WHERE sync_key = $1
        ORDER BY date ASC
        `,
        [normalizedKey],
      ),
      this.pool.query<FoodRow>(
        `
        SELECT
          food_id,
          position,
          name,
          protein,
          fat,
          carbs,
          calories,
          timestamp_ms,
          store,
          store_group,
          image
        FROM pfc_cloud_foods
        WHERE sync_key = $1
        ORDER BY position ASC
        `,
        [normalizedKey],
      ),
      this.pool.query<SportRow>(
        `
        SELECT
          sport_id,
          position,
          name,
          calories_burned
        FROM pfc_cloud_sports
        WHERE sync_key = $1
        ORDER BY position ASC
        `,
        [normalizedKey],
      ),
    ]);

    const logs = logsResult.rows.reduce<Record<string, unknown>>((acc, row) => {
      acc[row.date] = this.buildLog(row);
      return acc;
    }, {});

    const payload: BackupPayload = {
      version: 1,
      createdAt: Number(snapshot.created_at_ms),
      logs,
      settings: this.buildSettings(settingsResult.rows[0]),
      foods: foodsResult.rows.map(row => this.buildFood(row)),
      sports: sportsResult.rows.map(row => this.buildSport(row)),
    };

    return {
      payload,
      updatedAt: Number(snapshot.updated_at_ms),
    };
  }

  async set(syncKey: string, payload: BackupPayload, updatedAt: number) {
    await this.ensureTables();

    const normalizedKey = normalizeSyncKey(syncKey);
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `
        INSERT INTO pfc_cloud_snapshots (sync_key, version, created_at_ms, updated_at_ms)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (sync_key)
        DO UPDATE SET
          version = EXCLUDED.version,
          created_at_ms = EXCLUDED.created_at_ms,
          updated_at_ms = EXCLUDED.updated_at_ms,
          modified_at = NOW()
        `,
        [normalizedKey, payload.version, payload.createdAt, updatedAt],
      );

      await this.replaceSettings(client, normalizedKey, asRecord(payload.settings));
      await this.replaceLogs(client, normalizedKey, asRecord(payload.logs));
      await this.replaceFoods(client, normalizedKey, asArray(payload.foods));
      await this.replaceSports(client, normalizedKey, asArray(payload.sports));

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

let store: CloudDataStore | null = null;

export function getCloudDataStore(): CloudDataStore {
  if (!store) {
    store = new PostgresCloudDataStore();
  }

  return store;
}
