import 'server-only';

import { transaction } from '@/lib/server/db';

export interface HealthDaily {
  weightKg?: number;
  bodyFatPercent?: number;
  steps?: number;
}

/**
 * 指定日の体重・体脂肪率・歩数を保存する。送られなかった項目は既存の値を残す。
 * 体重がその日までの最新の測定なら、目標計算に使うプロフィールの体重も更新する。
 */
export function upsertHealthDaily(
  userId: string,
  date: string,
  { weightKg, bodyFatPercent, steps }: HealthDaily,
): Promise<void> {
  return transaction(async (client) => {
    await client.query(
      `INSERT INTO pfc_health_daily
         (user_id, date, weight_kg, body_fat_percent, steps)
       VALUES ($1, $2::date, $3, $4, $5)
       ON CONFLICT (user_id, date) DO UPDATE SET
         weight_kg = COALESCE(EXCLUDED.weight_kg, pfc_health_daily.weight_kg),
         body_fat_percent = COALESCE(
           EXCLUDED.body_fat_percent, pfc_health_daily.body_fat_percent),
         steps = COALESCE(EXCLUDED.steps, pfc_health_daily.steps)`,
      [userId, date, weightKg ?? null, bodyFatPercent ?? null, steps ?? null],
    );
    if (weightKg === undefined) return;
    await client.query(
      `UPDATE pfc_user_settings
       SET profile_json = jsonb_set(profile_json, '{weight}', to_jsonb($2::float8))
       WHERE user_id = $1
         AND profile_json IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM pfc_health_daily
           WHERE user_id = $1 AND date > $3::date AND weight_kg IS NOT NULL)`,
      [userId, weightKg, date],
    );
  });
}
