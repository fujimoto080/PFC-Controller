import 'server-only';

import { PoolClient } from 'pg';
import { getPool } from '@/lib/pg-pool';
import type { CloudResource } from '@/lib/cloud-data';
import { roundPFC } from '@/lib/utils';

interface UserDataPayload {
  logs: Record<string, unknown>;
  settings: Record<string, unknown>;
  foods: unknown[];
  sports: unknown[];
}

interface CloudDataStore {
  get(userId: string): Promise<UserDataPayload>;
  replace(userId: string, resource: CloudResource, value: unknown): Promise<void>;
}

interface SettingsRow {
  target_protein: number;
  target_fat: number;
  target_carbs: number;
  target_calories: number;
  profile_json: unknown;
  favorite_food_ids_json: unknown;
}

interface LogItemRow {
  id: string;
  date: string;
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

interface LogActivityRow {
  id: string;
  date: string;
  sport_id: string;
  name: string;
  calories_burned: number;
  timestamp_ms: string | number;
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

interface AggregatedLog {
  date: string;
  items: unknown[];
  activities: unknown[];
  total: { protein: number; fat: number; carbs: number; calories: number };
}

function aggregateLogs(
  itemsRows: LogItemRow[],
  activitiesRows: LogActivityRow[],
): Record<string, AggregatedLog> {
  const logs: Record<string, AggregatedLog> = {};

  function ensureLog(date: string): AggregatedLog {
    if (!logs[date]) {
      logs[date] = {
        date,
        items: [],
        activities: [],
        total: { protein: 0, fat: 0, carbs: 0, calories: 0 },
      };
    }
    return logs[date];
  }

  for (const row of itemsRows) {
    const log = ensureLog(row.date);
    const item = {
      id: row.id,
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
    log.items.push(item);
    log.total.protein += row.protein;
    log.total.fat += row.fat;
    log.total.carbs += row.carbs;
    log.total.calories += row.calories;
  }

  for (const row of activitiesRows) {
    const log = ensureLog(row.date);
    log.activities.push({
      id: row.id,
      sportId: row.sport_id,
      name: row.name,
      caloriesBurned: row.calories_burned,
      timestamp: Number(row.timestamp_ms),
    });
  }

  for (const log of Object.values(logs)) {
    log.total.protein = roundPFC(log.total.protein);
    log.total.fat = roundPFC(log.total.fat);
    log.total.carbs = roundPFC(log.total.carbs);
    log.total.calories = roundPFC(log.total.calories);
  }

  return logs;
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
    const [settingsResult, itemsResult, activitiesResult, foodsResult, sportsResult] =
      await Promise.all([
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
        pool.query<LogItemRow>(
          `
          SELECT
            id,
            to_char(date, 'YYYY-MM-DD') AS date,
            name,
            protein,
            fat,
            carbs,
            calories,
            timestamp_ms,
            store,
            store_group,
            image
          FROM pfc_log_items
          WHERE user_id = $1
          ORDER BY timestamp_ms ASC
          `,
          [userId],
        ),
        pool.query<LogActivityRow>(
          `
          SELECT
            id,
            to_char(date, 'YYYY-MM-DD') AS date,
            sport_id,
            name,
            calories_burned,
            timestamp_ms
          FROM pfc_log_activities
          WHERE user_id = $1
          ORDER BY timestamp_ms ASC
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

    const logs = aggregateLogs(itemsResult.rows, activitiesResult.rows);

    return {
      logs,
      settings: this.buildSettings(settingsResult.rows[0]),
      foods: foodsResult.rows.map((row) => this.buildFood(row)),
      sports: sportsResult.rows.map((row) => this.buildSport(row)),
    };
  }

  private async transaction(
    fn: (client: PoolClient) => Promise<void>,
  ): Promise<void> {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await fn(client);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  replace(userId: string, resource: CloudResource, value: unknown): Promise<void> {
    return this.transaction((client) => {
      switch (resource) {
        case 'settings':
          return this.writeSettings(client, userId, asRecord(value));
        case 'foods':
          return this.writeFoods(client, userId, asArray(value));
        case 'sports':
          return this.writeSports(client, userId, asArray(value));
      }
    });
  }
}

let store: CloudDataStore | null = null;

export function getCloudDataStore(): CloudDataStore {
  if (!store) {
    store = new PostgresCloudDataStore();
  }
  return store;
}
