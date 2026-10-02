import 'server-only';

import { deleteUserRow, getPool, transaction } from '@/lib/server/db';
import type { SportActivityInput, SportActivityLog } from '@/lib/types';
import { defaultTimestampFor, formatDate } from '@/lib/utils';

interface LogActivityRow {
  id: string;
  sport_id: string;
  name: string;
  calories_burned: number;
  timestamp_ms: string | number;
}

type DatedActivity = SportActivityLog & { date: string };

const COLUMNS = 'id, sport_id, name, calories_burned, timestamp_ms';

function toActivity(row: LogActivityRow): SportActivityLog {
  return {
    id: row.id,
    sportId: row.sport_id,
    name: row.name,
    caloriesBurned: row.calories_burned,
    timestamp: Number(row.timestamp_ms),
  };
}

async function queryLogActivities(
  where: string,
  params: unknown[],
): Promise<DatedActivity[]> {
  const result = await getPool().query<LogActivityRow & { date: string }>(
    `SELECT ${COLUMNS}, to_char(date, 'YYYY-MM-DD') AS date
     FROM pfc_log_activities
     WHERE ${where}
     ORDER BY timestamp_ms ASC`,
    params,
  );
  return result.rows.map((row) => ({ ...toActivity(row), date: row.date }));
}

/** 起動時ペイロード用の全件取得。 */
export function listLogActivities(userId: string): Promise<DatedActivity[]> {
  return queryLogActivities('user_id = $1', [userId]);
}

/** from〜to（両端含む, YYYY-MM-DD）の運動記録を取得する。 */
export function listLogActivitiesBetween(
  userId: string,
  from: string,
  to: string,
): Promise<DatedActivity[]> {
  return queryLogActivities(
    'user_id = $1 AND date BETWEEN $2::date AND $3::date',
    [userId, from, to],
  );
}

export async function createLogActivity(
  userId: string,
  input: SportActivityInput,
): Promise<SportActivityLog> {
  const result = await getPool().query<LogActivityRow>(
    `INSERT INTO pfc_log_activities
       (user_id, date, sport_id, name, calories_burned, timestamp_ms)
     VALUES ($1, $2::date, $3, $4, $5, $6)
     RETURNING ${COLUMNS}`,
    [
      userId,
      formatDate(input.timestamp),
      input.sportId,
      input.name,
      input.caloriesBurned,
      input.timestamp,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error('運動記録の登録に失敗しました');
  return toActivity(row);
}

/** スマホのヘルスケア連携で同期する、その日 1 件の運動記録の識別子。 */
const HEALTH_SYNC_SPORT_ID = 'health-sync';

/**
 * 指定日のヘルスケア連携分（アクティブ消費カロリー）を置き換える。
 * 同じ日に何度同期しても 1 件になり、0 kcal のときは記録を消す。
 */
export function replaceHealthActivity(
  userId: string,
  date: string,
  caloriesBurned: number,
): Promise<void> {
  return transaction(async (client) => {
    await client.query(
      `DELETE FROM pfc_log_activities
       WHERE user_id = $1 AND date = $2::date AND sport_id = $3`,
      [userId, date, HEALTH_SYNC_SPORT_ID],
    );
    if (caloriesBurned <= 0) return;
    await client.query(
      `INSERT INTO pfc_log_activities
         (user_id, date, sport_id, name, calories_burned, timestamp_ms)
       VALUES ($1, $2::date, $3, $4, $5, $6)`,
      [
        userId,
        date,
        HEALTH_SYNC_SPORT_ID,
        'ヘルスケア連携（活動消費）',
        caloriesBurned,
        defaultTimestampFor(date),
      ],
    );
  });
}

export function deleteLogActivity(
  userId: string,
  id: string,
): Promise<boolean> {
  return deleteUserRow('pfc_log_activities', 'id', userId, id);
}
