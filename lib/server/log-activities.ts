import 'server-only';

import { getPool } from '@/lib/pg-pool';
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

function rowToActivity(row: LogActivityRow): SportActivityLog & { date: string } {
  return {
    id: row.id,
    sportId: row.sport_id,
    name: row.name,
    caloriesBurned: row.calories_burned,
    timestamp: Number(row.timestamp_ms),
    date: row.date,
  };
}

export async function listLogActivitiesByUser(
  userId: string,
): Promise<Array<SportActivityLog & { date: string }>> {
  const pool = getPool();
  const result = await pool.query<LogActivityRow>(
    `SELECT id, to_char(date, 'YYYY-MM-DD') AS date, sport_id, name, calories_burned, timestamp_ms
     FROM pfc_log_activities
     WHERE user_id = $1
     ORDER BY timestamp_ms ASC`,
    [userId],
  );
  return result.rows.map(rowToActivity);
}

export async function createLogActivity(
  userId: string,
  input: SportActivityInput,
): Promise<SportActivityLog & { date: string }> {
  const date = formatDate(input.timestamp);
  const pool = getPool();
  const result = await pool.query<LogActivityRow>(
    `INSERT INTO pfc_log_activities
       (user_id, date, sport_id, name, calories_burned, timestamp_ms)
     VALUES ($1, $2::date, $3, $4, $5, $6)
     RETURNING id, to_char(date, 'YYYY-MM-DD') AS date, sport_id, name, calories_burned, timestamp_ms`,
    [
      userId,
      date,
      input.sportId,
      input.name,
      input.caloriesBurned,
      input.timestamp,
    ],
  );
  return rowToActivity(result.rows[0]);
}

export async function updateLogActivity(
  userId: string,
  id: string,
  input: SportActivityInput,
): Promise<(SportActivityLog & { date: string }) | null> {
  const date = formatDate(input.timestamp);
  const pool = getPool();
  const result = await pool.query<LogActivityRow>(
    `UPDATE pfc_log_activities
     SET date = $3::date, sport_id = $4, name = $5, calories_burned = $6, timestamp_ms = $7
     WHERE user_id = $1 AND id = $2
     RETURNING id, to_char(date, 'YYYY-MM-DD') AS date, sport_id, name, calories_burned, timestamp_ms`,
    [
      userId,
      id,
      date,
      input.sportId,
      input.name,
      input.caloriesBurned,
      input.timestamp,
    ],
  );
  return result.rows[0] ? rowToActivity(result.rows[0]) : null;
}

export async function deleteLogActivity(
  userId: string,
  id: string,
): Promise<{ date: string } | null> {
  const pool = getPool();
  const result = await pool.query<{ date: string }>(
    `DELETE FROM pfc_log_activities
     WHERE user_id = $1 AND id = $2
     RETURNING to_char(date, 'YYYY-MM-DD') AS date`,
    [userId, id],
  );
  return result.rows[0] ?? null;
}

export type { LogActivityRow };
