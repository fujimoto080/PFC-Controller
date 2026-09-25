import 'server-only';

import { getPool } from '@/lib/server/db';
import type { SportActivityInput, SportActivityLog } from '@/lib/types';
import { formatDate } from '@/lib/utils';

interface LogActivityRow {
  id: string;
  date: string; // 'YYYY-MM-DD'
  sport_id: string;
  name: string;
  calories_burned: number;
  timestamp_ms: string | number;
}

export type DatedActivity = SportActivityLog & { date: string };

function toActivity(row: LogActivityRow): DatedActivity {
  return {
    id: row.id,
    sportId: row.sport_id,
    name: row.name,
    caloriesBurned: row.calories_burned,
    timestamp: Number(row.timestamp_ms),
    date: row.date,
  };
}

const COLUMNS = `id, to_char(date, 'YYYY-MM-DD') AS date, sport_id, name, calories_burned, timestamp_ms`;

export async function listLogActivities(
  userId: string,
): Promise<DatedActivity[]> {
  const result = await getPool().query<LogActivityRow>(
    `SELECT ${COLUMNS} FROM pfc_log_activities WHERE user_id = $1 ORDER BY timestamp_ms ASC`,
    [userId],
  );
  return result.rows.map(toActivity);
}

export async function createLogActivity(
  userId: string,
  input: SportActivityInput,
): Promise<DatedActivity> {
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

export async function deleteLogActivity(
  userId: string,
  id: string,
): Promise<boolean> {
  const result = await getPool().query(
    `DELETE FROM pfc_log_activities WHERE user_id = $1 AND id = $2`,
    [userId, id],
  );
  return (result.rowCount ?? 0) > 0;
}
