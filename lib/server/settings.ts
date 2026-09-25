import 'server-only';

import { getPool } from '@/lib/server/db';
import type { UserProfile, UserSettings } from '@/lib/types';

interface SettingsRow {
  target_protein: number;
  target_fat: number;
  target_carbs: number;
  target_calories: number;
  profile_json: UserProfile | null;
  favorite_food_ids_json: string[] | null;
}

const DEFAULT_SETTINGS: UserSettings = {
  targetPFC: { protein: 100, fat: 60, carbs: 250, calories: 2000 },
  favoriteFoodIds: [],
};

/** ユーザー設定を返す。未保存なら既定値。 */
export async function getSettings(userId: string): Promise<UserSettings> {
  const result = await getPool().query<SettingsRow>(
    `SELECT target_protein, target_fat, target_carbs, target_calories,
            profile_json, favorite_food_ids_json
     FROM pfc_user_settings
     WHERE user_id = $1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) return DEFAULT_SETTINGS;
  return {
    targetPFC: {
      protein: row.target_protein,
      fat: row.target_fat,
      carbs: row.target_carbs,
      calories: row.target_calories,
    },
    profile: row.profile_json ?? undefined,
    favoriteFoodIds: row.favorite_food_ids_json ?? [],
  };
}

export async function replaceSettings(
  userId: string,
  settings: UserSettings,
): Promise<void> {
  await getPool().query(
    `INSERT INTO pfc_user_settings (
       user_id, target_protein, target_fat, target_carbs, target_calories,
       profile_json, favorite_food_ids_json
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
     ON CONFLICT (user_id) DO UPDATE SET
       target_protein = EXCLUDED.target_protein,
       target_fat = EXCLUDED.target_fat,
       target_carbs = EXCLUDED.target_carbs,
       target_calories = EXCLUDED.target_calories,
       profile_json = EXCLUDED.profile_json,
       favorite_food_ids_json = EXCLUDED.favorite_food_ids_json`,
    [
      userId,
      settings.targetPFC.protein,
      settings.targetPFC.fat,
      settings.targetPFC.carbs,
      settings.targetPFC.calories,
      JSON.stringify(settings.profile ?? null),
      JSON.stringify(settings.favoriteFoodIds),
    ],
  );
}
