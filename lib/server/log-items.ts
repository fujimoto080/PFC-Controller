import 'server-only';

import { getPool } from '@/lib/server/db';
import type { FoodItem, FoodItemInput } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export interface FoodColumns {
  name: string;
  protein: number;
  fat: number;
  carbs: number;
  calories: number;
  timestamp_ms: string | number;
  store: string | null;
  store_group: string | null;
  image?: string | null;
}

interface LogItemRow extends FoodColumns {
  id: string;
  date: string; // 'YYYY-MM-DD'
}

export type DatedFoodItem = FoodItem & { date: string };

/** pfc_log_items / pfc_foods 共通の食品カラムを FoodItem に変換する。 */
export function toFoodItem(id: string, row: FoodColumns): FoodItem {
  return {
    id,
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

function toDatedFoodItem(row: LogItemRow): DatedFoodItem {
  return { ...toFoodItem(row.id, row), date: row.date };
}

const COLUMNS = `id, to_char(date, 'YYYY-MM-DD') AS date, name, protein, fat, carbs, calories,
  timestamp_ms, store, store_group, image`;

/** 起動時ペイロード用。image はどの画面でも描画していないため取得しない。 */
export async function listLogItems(userId: string): Promise<DatedFoodItem[]> {
  const result = await getPool().query<LogItemRow>(
    `SELECT id, to_char(date, 'YYYY-MM-DD') AS date, name, protein, fat, carbs, calories,
            timestamp_ms, store, store_group
     FROM pfc_log_items
     WHERE user_id = $1
     ORDER BY timestamp_ms ASC`,
    [userId],
  );
  return result.rows.map(toDatedFoodItem);
}

function values(input: FoodItemInput) {
  return [
    formatDate(input.timestamp),
    input.name,
    input.protein,
    input.fat,
    input.carbs,
    input.calories,
    input.timestamp,
    input.store ?? null,
    input.storeGroup ?? null,
    input.image ?? null,
  ];
}

export async function createLogItem(
  userId: string,
  input: FoodItemInput,
): Promise<DatedFoodItem> {
  const result = await getPool().query<LogItemRow>(
    `INSERT INTO pfc_log_items
       (user_id, date, name, protein, fat, carbs, calories, timestamp_ms, store, store_group, image)
     VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${COLUMNS}`,
    [userId, ...values(input)],
  );
  const row = result.rows[0];
  if (!row) throw new Error('ログの登録に失敗しました');
  return toDatedFoodItem(row);
}

export async function updateLogItem(
  userId: string,
  id: string,
  input: FoodItemInput,
): Promise<DatedFoodItem | null> {
  const result = await getPool().query<LogItemRow>(
    `UPDATE pfc_log_items
     SET date = $3::date, name = $4, protein = $5, fat = $6, carbs = $7, calories = $8,
         timestamp_ms = $9, store = $10, store_group = $11, image = $12
     WHERE user_id = $1 AND id = $2
     RETURNING ${COLUMNS}`,
    [userId, id, ...values(input)],
  );
  return result.rows[0] ? toDatedFoodItem(result.rows[0]) : null;
}

export async function deleteLogItem(
  userId: string,
  id: string,
): Promise<boolean> {
  const result = await getPool().query(
    `DELETE FROM pfc_log_items WHERE user_id = $1 AND id = $2`,
    [userId, id],
  );
  return (result.rowCount ?? 0) > 0;
}
