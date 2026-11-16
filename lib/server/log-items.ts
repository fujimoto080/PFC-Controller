import 'server-only';

import type { PoolClient } from 'pg';
import { buildLogItem } from '@/lib/pfc';
import { deleteUserRow, getPool } from '@/lib/server/db';
import {
  FOOD_COLUMNS,
  foodValues,
  toFoodItem,
  type FoodRow,
} from '@/lib/server/food-row';
import type { LogItem, LogItemInput } from '@/lib/types';
import { formatDate } from '@/lib/utils';

const RETURNING = `id, ${FOOD_COLUMNS}, quantity`;

type LogRow = FoodRow & { quantity: number };
type DatedLogItem = LogItem & { date: string };

function toLogItem(row: LogRow): LogItem {
  const { id, ...food } = toFoodItem(row);
  return buildLogItem(id, { ...food, quantity: row.quantity });
}

/** 一覧取得用。image はどの画面でも描画していないため取得しない。 */
async function queryLogItems(
  where: string,
  params: unknown[],
): Promise<DatedLogItem[]> {
  const result = await getPool().query<LogRow & { date: string }>(
    `SELECT id, to_char(date, 'YYYY-MM-DD') AS date, name, protein, fat, carbs, calories,
            timestamp_ms, store, store_group, quantity
     FROM pfc_log_items
     WHERE ${where}
     ORDER BY timestamp_ms ASC`,
    params,
  );
  return result.rows.map((row) => ({ ...toLogItem(row), date: row.date }));
}

/** 起動時ペイロード用の全件取得。 */
export function listLogItems(userId: string): Promise<DatedLogItem[]> {
  return queryLogItems('user_id = $1', [userId]);
}

/** from〜to（両端含む, YYYY-MM-DD）の記録を取得する。 */
export function listLogItemsBetween(
  userId: string,
  from: string,
  to: string,
): Promise<DatedLogItem[]> {
  return queryLogItems('user_id = $1 AND date BETWEEN $2::date AND $3::date', [
    userId,
    from,
    to,
  ]);
}

export async function createLogItem(
  userId: string,
  input: LogItemInput,
): Promise<LogItem> {
  const result = await getPool().query<LogRow>(
    `INSERT INTO pfc_log_items (user_id, date, ${FOOD_COLUMNS}, quantity)
     VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING ${RETURNING}`,
    [userId, formatDate(input.timestamp), ...foodValues(input), input.quantity],
  );
  const row = result.rows[0];
  if (!row) throw new Error('ログの登録に失敗しました');
  return toLogItem(row);
}

export async function findLogItemsByIds(
  userId: string,
  ids: string[],
  db: Pick<PoolClient, 'query'>,
): Promise<LogItem[]> {
  const { rows } = await db.query<LogRow>(
    `SELECT ${RETURNING} FROM pfc_log_items WHERE user_id = $1 AND id = ANY($2::uuid[])`,
    [userId, ids],
  );
  return rows.map(toLogItem);
}

/** スキャンの下書き ID で登録し、同じリクエストの再送による二重記録を防ぐ。 */
export async function createLogItemsBulk(
  userId: string,
  entries: { id: string; input: LogItemInput }[],
  db: Pick<PoolClient, 'query'>,
): Promise<LogItem[]> {
  if (entries.length === 0) return [];
  const values: unknown[] = [userId];
  const tuples = entries.map(({ id, input }) => {
    const args = [
      id,
      formatDate(input.timestamp),
      ...foodValues(input),
      input.quantity,
    ];
    const placeholders = args.map((value) => `$${values.push(value)}`);
    return `($1, ${placeholders.join(', ')})`;
  });
  const { rows } = await db.query<LogRow>(
    `INSERT INTO pfc_log_items (user_id, id, date, ${FOOD_COLUMNS}, quantity)
     VALUES ${tuples.join(', ')}
     ON CONFLICT (id) DO NOTHING RETURNING ${RETURNING}`,
    values,
  );
  return rows.map(toLogItem);
}

export async function updateLogItem(
  userId: string,
  id: string,
  input: LogItemInput,
): Promise<LogItem | null> {
  const result = await getPool().query<LogRow>(
    `UPDATE pfc_log_items
     SET date = $3::date, (${FOOD_COLUMNS}, quantity) = ($4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     WHERE user_id = $1 AND id = $2
     RETURNING ${RETURNING}`,
    [
      userId,
      id,
      formatDate(input.timestamp),
      ...foodValues(input),
      input.quantity,
    ],
  );
  const row = result.rows[0];
  return row ? toLogItem(row) : null;
}

export function deleteLogItem(userId: string, id: string): Promise<boolean> {
  return deleteUserRow('pfc_log_items', 'id', userId, id);
}
