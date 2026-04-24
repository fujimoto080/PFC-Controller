import 'server-only';

import { PoolClient } from 'pg';
import { getPool } from '@/lib/pg-pool';

interface UserDataPayload {
  logs: Record<string, unknown>;
  settings: Record<string, unknown>;
  foods: unknown[];
  sports: unknown[];
}

interface CloudDataStore {
  get(userId: string): Promise<UserDataPayload>;
  replaceSettings(userId: string, settings: Record<string, unknown>): Promise<void>;
  replaceLogs(userId: string, logs: Record<string, unknown>): Promise<void>;
  replaceFoods(userId: string, foods: unknown[]): Promise<void>;
  replaceSports(userId: string, sports: unknown[]): Promise<void>;
}

interface SettingsRow {
  target_protein: number;
  target_fat: number;
  target_carbs: number;
  target_calories: number;
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

  private buildSettings(row?: SettingsRow): Record<string, unknown> {
    if (!row) return {};

    return {
      targetPFC: {
        protein: row.target_protein,
        fat: row.target_fat,
        carbs: row.target_carbs,
        calories: row.target_calories,
      },
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

  private async writeSettings(
    client: PoolClient,
    userId: string,
    settings: Record<string, unknown>,
  ) {
    const target = asRecord(settings.targetPFC);
    const params = [
      userId,
      toFiniteNumber(target.protein),
      toFiniteNumber(target.fat),
      toFiniteNumber(target.carbs),
      toFiniteNumber(target.calories),
      JSON.stringify(settings.profile ?? null),
      JSON.stringify(asArray(settings.favoriteFoodIds)),
    ];

    await client.query(
      `
      INSERT INTO pfc_user_settings (
        user_id,
        target_protein,
        target_fat,
        target_carbs,
        target_calories,
        profile_json,
        favorite_food_ids_json
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
      ON CONFLICT (user_id) DO UPDATE SET
        target_protein = EXCLUDED.target_protein,
        target_fat = EXCLUDED.target_fat,
        target_carbs = EXCLUDED.target_carbs,
        target_calories = EXCLUDED.target_calories,
        profile_json = EXCLUDED.profile_json,
        favorite_food_ids_json = EXCLUDED.favorite_food_ids_json
      `,
      params,
    );
  }

  private async writeLogs(
    client: PoolClient,
    userId: string,
    logs: Record<string, unknown>,
  ) {
    await client.query(`DELETE FROM pfc_daily_logs WHERE user_id = $1`, [userId]);

    for (const [date, logRaw] of Object.entries(logs)) {
      const log = asRecord(logRaw);
      const total = asRecord(log.total);
      const items = asArray(log.items);
      const activities = asArray(log.activities);

      await client.query(
        `
        INSERT INTO pfc_daily_logs (
          user_id,
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
          userId,
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

  private async writeFoods(
    client: PoolClient,
    userId: string,
    foods: unknown[],
  ) {
    await client.query(`DELETE FROM pfc_foods WHERE user_id = $1`, [userId]);

    for (const [position, foodRaw] of foods.entries()) {
      const food = asRecord(foodRaw);
      const foodId =
        typeof food.id === 'string' && food.id.trim() ? food.id.trim() : `food-${position}`;

      await client.query(
        `
        INSERT INTO pfc_foods (
          user_id,
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
        `,
        [
          userId,
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

  private async writeSports(
    client: PoolClient,
    userId: string,
    sports: unknown[],
  ) {
    await client.query(`DELETE FROM pfc_sports WHERE user_id = $1`, [userId]);

    for (const [position, sportRaw] of sports.entries()) {
      const sport = asRecord(sportRaw);
      const sportId =
        typeof sport.id === 'string' && sport.id.trim() ? sport.id.trim() : `sport-${position}`;

      await client.query(
        `
        INSERT INTO pfc_sports (
          user_id,
          sport_id,
          position,
          name,
          calories_burned
        ) VALUES ($1, $2, $3, $4, $5)
        `,
        [
          userId,
          sportId,
          position,
          typeof sport.name === 'string' ? sport.name : '',
          toFiniteNumber(sport.caloriesBurned),
        ],
      );
    }
  }

  async get(userId: string): Promise<UserDataPayload> {

    const pool = getPool();
    const [settingsResult, logsResult, foodsResult, sportsResult] = await Promise.all([
      pool.query<SettingsRow>(
        `
        SELECT
          target_protein,
          target_fat,
          target_carbs,
          target_calories,
          profile_json,
          favorite_food_ids_json
        FROM pfc_user_settings
        WHERE user_id = $1
        LIMIT 1
        `,
        [userId],
      ),
      pool.query<LogRow>(
        `
        SELECT
          date,
          total_protein,
          total_fat,
          total_carbs,
          total_calories,
          items_json,
          activities_json
        FROM pfc_daily_logs
        WHERE user_id = $1
        ORDER BY date ASC
        `,
        [userId],
      ),
      pool.query<FoodRow>(
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
        FROM pfc_foods
        WHERE user_id = $1
        ORDER BY position ASC
        `,
        [userId],
      ),
      pool.query<SportRow>(
        `
        SELECT
          sport_id,
          position,
          name,
          calories_burned
        FROM pfc_sports
        WHERE user_id = $1
        ORDER BY position ASC
        `,
        [userId],
      ),
    ]);

    const logs = logsResult.rows.reduce<Record<string, unknown>>((acc, row) => {
      acc[row.date] = this.buildLog(row);
      return acc;
    }, {});

    return {
      logs,
      settings: this.buildSettings(settingsResult.rows[0]),
      foods: foodsResult.rows.map((row) => this.buildFood(row)),
      sports: sportsResult.rows.map((row) => this.buildSport(row)),
    };
  }

  async replaceSettings(userId: string, settings: Record<string, unknown>) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await this.writeSettings(client, userId, settings);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async replaceLogs(userId: string, logs: Record<string, unknown>) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await this.writeLogs(client, userId, logs);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async replaceFoods(userId: string, foods: unknown[]) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await this.writeFoods(client, userId, foods);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async replaceSports(userId: string, sports: unknown[]) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await this.writeSports(client, userId, sports);
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
