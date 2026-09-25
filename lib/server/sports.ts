import 'server-only';

import { getPool, transaction } from '@/lib/server/db';
import type { SportDefinition } from '@/lib/types';

interface SportRow {
  sport_id: string;
  name: string;
  calories_burned: number;
}

export async function listSports(userId: string): Promise<SportDefinition[]> {
  const result = await getPool().query<SportRow>(
    `SELECT sport_id, name, calories_burned FROM pfc_sports
     WHERE user_id = $1 ORDER BY position ASC`,
    [userId],
  );
  return result.rows.map((row) => ({
    id: row.sport_id,
    name: row.name,
    caloriesBurned: row.calories_burned,
  }));
}

/** 登録スポーツを並び順ごと置き換える。 */
export function replaceSports(
  userId: string,
  sports: SportDefinition[],
): Promise<void> {
  return transaction(async (client) => {
    await client.query('DELETE FROM pfc_sports WHERE user_id = $1', [userId]);
    await client.query(
      `INSERT INTO pfc_sports (user_id, sport_id, position, name, calories_burned)
       SELECT $1, t.sport_id, t.ord - 1, t.name, t.calories_burned
       FROM unnest($2::text[], $3::text[], $4::float8[])
         WITH ORDINALITY AS t(sport_id, name, calories_burned, ord)`,
      [
        userId,
        sports.map((sport) => sport.id),
        sports.map((sport) => sport.name),
        sports.map((sport) => sport.caloriesBurned),
      ],
    );
  });
}
