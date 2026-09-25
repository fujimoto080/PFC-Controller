import 'server-only';

import { deleteUserRow, getPool } from '@/lib/server/db';
import type { SportActivityInput, SportActivityLog } from '@/lib/types';
import { formatDate } from '@/lib/utils';

interface LogActivityRow {
  id: string;
  sport_id: string;
  name: string;
  calories_burned: number;
  timestamp_ms: string | number;
}

function toActivity(row: LogActivityRow): SportActivityLog {
  return {
    id: row.id,
    sportId: row.sport_id,
    name: row.name,
    caloriesBurned: row.calories_burned,
    timestamp: Number(row.timestamp_ms),
  };
}

const COLUMNS = 'id, sport_id, name, calories_burned, timestamp_ms';

export async function listLogActivities(
  userId: string,
): Promise<(SportActivityLog & { date: string })[]> {
  const result = await getPool().query<LogActivityRow & { date: string }>(
    `SELECT ${COLUMNS}, to_char(date, 'YYYY-MM-DD') AS date
     FROM pfc_log_activities WHERE user_id = $1 ORDER BY timestamp_ms ASC`,
    [userId],
  );
  return result.rows.map((row) => ({ ...toActivity(row), date: row.date }));
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
  if (!row) throw new Error('活動ログの登録に失敗しました');
  return toActivity(row);
}

export function deleteLogActivity(
  userId: string,
  id: string,
): Promise<boolean> {
  return deleteUserRow('pfc_log_activities', 'id', userId, id);
}
