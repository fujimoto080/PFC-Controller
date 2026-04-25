import 'server-only';

import { getPool } from '@/lib/pg-pool';
import type { FoodItem, FoodItemInput } from '@/lib/types';
import { formatDate } from '@/lib/utils';

interface LogItemRow {
  id: string;
  date: string; // 'YYYY-MM-DD'
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

function rowToFoodItem(row: LogItemRow): FoodItem & { date: string } {
  return {
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
    date: row.date,
  };
}

export async function listLogItemsByUser(
  userId: string,
): Promise<Array<FoodItem & { date: string }>> {
  const pool = getPool();
  const result = await pool.query<LogItemRow>(
    `SELECT id, to_char(date, 'YYYY-MM-DD') AS date, name, protein, fat, carbs, calories,
            timestamp_ms, store, store_group, image
     FROM pfc_log_items
     WHERE user_id = $1
     ORDER BY timestamp_ms ASC`,
    [userId],
  );
  return result.rows.map(rowToFoodItem);
}

export async function createLogItem(
  userId: string,
  input: FoodItemInput,
): Promise<FoodItem & { date: string }> {
  const date = formatDate(input.timestamp);
  const pool = getPool();
  const result = await pool.query<LogItemRow>(
    `INSERT INTO pfc_log_items
       (user_id, date, name, protein, fat, carbs, calories, timestamp_ms, store, store_group, image)
     VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, to_char(date, 'YYYY-MM-DD') AS date, name, protein, fat, carbs, calories,
               timestamp_ms, store, store_group, image`,
    [
      userId,
      date,
      input.name,
      input.protein,
      input.fat,
      input.carbs,
      input.calories,
      input.timestamp,
      input.store ?? null,
      input.storeGroup ?? null,
      input.image ?? null,
    ],
  );
  return rowToFoodItem(result.rows[0]);
}

export async function updateLogItem(
  userId: string,
  id: string,
  input: FoodItemInput,
): Promise<(FoodItem & { date: string }) | null> {
  const date = formatDate(input.timestamp);
  const pool = getPool();
  const result = await pool.query<LogItemRow>(
    `UPDATE pfc_log_items
     SET date = $3::date, name = $4, protein = $5, fat = $6, carbs = $7, calories = $8,
         timestamp_ms = $9, store = $10, store_group = $11, image = $12
     WHERE user_id = $1 AND id = $2
     RETURNING id, to_char(date, 'YYYY-MM-DD') AS date, name, protein, fat, carbs, calories,
               timestamp_ms, store, store_group, image`,
    [
      userId,
      id,
      date,
      input.name,
      input.protein,
      input.fat,
      input.carbs,
      input.calories,
      input.timestamp,
      input.store ?? null,
      input.storeGroup ?? null,
      input.image ?? null,
    ],
  );
  return result.rows[0] ? rowToFoodItem(result.rows[0]) : null;
}

export async function deleteLogItem(
  userId: string,
  id: string,
): Promise<{ date: string } | null> {
  const pool = getPool();
  const result = await pool.query<{ date: string }>(
    `DELETE FROM pfc_log_items
     WHERE user_id = $1 AND id = $2
     RETURNING to_char(date, 'YYYY-MM-DD') AS date`,
    [userId, id],
  );
  return result.rows[0] ?? null;
}

export type { LogItemRow };
