import 'server-only';

import { z } from 'zod';
import { ApiError } from '@/lib/api/handler';
import { mealSlotSchema } from '@/lib/api/schemas';
import { CHAIN_STORES } from '@/lib/chain-stores';
import { DEFAULT_MEAL_INSTRUCTIONS } from '@/lib/meal-instructions';
import {
  distanceMeters,
  mealSlotLabel,
  planMeal,
  remainingSlots,
  slotForTime,
} from '@/lib/meal-schedule';
import { sumPFC } from '@/lib/pfc';
import { getPool } from '@/lib/server/db';
import { getCalendarEventLines } from '@/lib/server/google-calendar';
import { getMealHistory, getNutritionStatus } from '@/lib/server/meal-context';
import { getMealNote } from '@/lib/server/meal-notes';
import { findSurroundings } from '@/lib/server/nearby-stores';
import { extractJsonObject } from '@/lib/server/nutrition';
import { callOpenAIWithWebSearch } from '@/lib/server/openai';
import { getSettings } from '@/lib/server/settings';
import type {
  GeoPoint,
  MealSlot,
  MealSuggestion,
  MealSuggestionRequest,
  NearbyStore,
  PFC,
} from '@/lib/types';
import { formatDate, formatTime, roundPFC, toJstTimestamp } from '@/lib/utils';

const HISTORY_DAYS = 10;
/** 通知時の提案に使う現在地の有効期間。前夜に自宅で取った位置なら翌朝も使える。 */
const LOCATION_TTL_MS = 18 * 60 * 60 * 1000;
/** 現在地とこの距離以内の自宅・会社は同じ場所とみなして重ねて調べない。 */
const SAME_PLACE_M = 400;

// ---- 現在地 ----

async function saveLastLocation(
  userId: string,
  { lat, lon }: GeoPoint,
): Promise<void> {
  await getPool().query(
    `INSERT INTO pfc_user_locations (user_id, lat, lon, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id) DO UPDATE SET
       lat = EXCLUDED.lat, lon = EXCLUDED.lon, updated_at = now()`,
    [userId, lat, lon],
  );
}

/** 最後に取得した現在地。古すぎる場合は予定から推定するため undefined。 */
export async function getRecentLocation(
  userId: string,
): Promise<GeoPoint | undefined> {
  const result = await getPool().query<{
    lat: number;
    lon: number;
    updated_at: Date;
  }>('SELECT lat, lon, updated_at FROM pfc_user_locations WHERE user_id = $1', [
    userId,
  ]);
  const row = result.rows[0];
  if (!row || Date.now() - row.updated_at.getTime() > LOCATION_TTL_MS) {
    return undefined;
  }
  return { lat: row.lat, lon: row.lon };
}

// ---- 保存 ----

/** 1 回の AI 呼び出しで作った提案（同じ日付・作成時刻）をまとめて保存する。 */
async function saveSuggestions(
  userId: string,
  date: string,
  createdAt: number,
  suggestions: MealSuggestion[],
): Promise<void> {
  await getPool().query(
    `INSERT INTO pfc_meal_suggestions
       (user_id, date, slot, suggestion_json, created_at)
     SELECT $1, $2, s.slot, s.json, to_timestamp($3 / 1000.0)
     FROM unnest($4::text[], $5::jsonb[]) AS s(slot, json)`,
    [
      userId,
      date,
      createdAt,
      suggestions.map((s) => s.slot),
      suggestions.map((s) => JSON.stringify(s)),
    ],
  );
}

/** その日の提案すべて（やり直した分も含む）。新しい順。 */
export async function listSuggestions(
  userId: string,
  date: string,
): Promise<MealSuggestion[]> {
  const result = await getPool().query<{ suggestion_json: MealSuggestion }>(
    `SELECT suggestion_json FROM pfc_meal_suggestions
     WHERE user_id = $1 AND date = $2
     ORDER BY created_at DESC`,
    [userId, date],
  );
  return result.rows.map((row) => row.suggestion_json);
}

// ---- コンテキスト ----

const daysBetween = (from: string, to: string) =>
  Math.round(
    (toJstTimestamp(to) - toJstTimestamp(from)) / (24 * 60 * 60 * 1000),
  );

const formatPfc = ({ calories, protein, fat, carbs }: PFC) =>
  `${Math.round(calories)}kcal P${roundPFC(protein, 1)}g F${roundPFC(fat, 1)}g C${roundPFC(carbs, 1)}g`;

/** 前日までの繰越（正なら超過、負なら不足）のカロリー表記。 */
const formatCarryover = (calories: number) =>
  calories >= 0
    ? `前日までの超過 -${Math.round(calories)}kcal`
    : `前日までの不足 +${Math.round(-calories)}kcal`;

type MealHistory = Awaited<ReturnType<typeof getMealHistory>>;

/** 食べた物を最後に食べた日の近さで「避ける」「また食べてよい」に分ける。 */
function classifyRecentFoods(history: MealHistory, today: string) {
  const lastEaten = new Map<string, number>();
  for (const day of history) {
    const ago = daysBetween(day.date, today);
    for (const meal of day.meals) {
      const label = meal.store ? `${meal.name}（${meal.store}）` : meal.name;
      lastEaten.set(label, Math.min(lastEaten.get(label) ?? Infinity, ago));
    }
  }
  const avoid: string[] = [];
  const welcome: string[] = [];
  for (const [label, ago] of lastEaten) {
    if (ago <= 1) avoid.push(label);
    else welcome.push(`${label}（${ago}日前）`);
  }
  return { avoid, welcome };
}

function describeStores(stores: NearbyStore[]): string[] {
  return stores.map(
    (store) =>
      `- ${store.name}［${store.category}］${store.near}から約${store.distanceM}m${store.isChain ? '・栄養公開チェーン' : ''}`,
  );
}

/** 配分の説明。slots は提案する食事枠で、今日これからの食事の先頭から並ぶ。 */
function describeAllocation(slots: MealSlot[]): string {
  const [first] = slots;
  if (!first) throw new Error('食事枠がありません');
  const mealsLeft = remainingSlots(first).length;
  if (slots.length > 1) {
    return `今日はあと${mealsLeft}食（${slots.map(mealSlotLabel).join('・')}）。残りをこれらに配分し、全部食べると残りをちょうど使い切って1日を終えられる量にする（朝は軽め、夜の分を残しすぎない）。`;
  }
  return `この食事を含めて今日はあと${mealsLeft}食。${
    mealsLeft === 1
      ? '今日の最後の食事なので、残りをちょうど使い切って1日を終えられる量にする。'
      : `残りを配分し、この食事は残りの約1/${mealsLeft}を目安にする（朝は軽め、夜の分を残しすぎない）。`
  }`;
}

async function buildPrompt(
  userId: string,
  request: MealSuggestionRequest,
  slots: MealSlot[],
) {
  const now = Date.now();
  const today = formatDate(now);
  const [settings, status, history, calendar, note] = await Promise.all([
    getSettings(userId),
    getNutritionStatus(userId, today),
    getMealHistory(userId, HISTORY_DAYS),
    getCalendarEventLines(userId, today),
    getMealNote(userId, today),
  ]);
  const plans = slots.map((slot) =>
    planMeal(settings.mealSchedule, today, slot),
  );

  // 現在地と、予定から見て行きそうな場所の周辺を調べる
  const places: { near: string; point: GeoPoint }[] = [];
  if (request.location)
    places.push({ near: '現在地', point: request.location });
  for (const place of plans.flatMap((plan) => plan.places)) {
    const { point } = place;
    if (!point) continue;
    if (
      places.some(
        (p) =>
          p.near === place.label ||
          distanceMeters(p.point, point) < SAME_PLACE_M,
      )
    ) {
      continue;
    }
    places.push({ near: place.label, point });
  }
  const surroundings = await findSurroundings(places);
  const stores = [
    ...(request.stores ?? []),
    ...surroundings.flatMap((s) => s.stores),
  ].filter(
    (store, index, all) => all.findIndex((s) => s.id === store.id) === index,
  );

  const instructions =
    settings.mealPreferences?.instructions ?? DEFAULT_MEAL_INSTRUCTIONS;
  const storePreferences = settings.mealPreferences?.stores ?? [];
  const { avoid, welcome } = classifyRecentFoods(history, today);
  const slotLabels = slots.map((slot) => `「${mealSlotLabel(slot)}」`).join('');

  const lines = [
    'あなたは減量中のユーザーの食事を考える管理栄養士です。',
    `今は ${today} ${formatTime(now)}（JST）。これから食べる${slotLabels}を提案してください。`,
    '',
    '## 今日の予定と居場所',
    // 食事枠ごとの説明は先頭の曜日・勤務の行が共通なので重複を除く
    ...new Set(plans.flatMap((plan) => plan.description)),
    ...(calendar
      ? [
          'Google カレンダーの今日の予定（食事の時間帯に会議・移動・外出があれば、その場所で買える・食べられる物や、空き時間で済ませられる物にする）:',
          ...(calendar.length > 0 ? calendar : ['- 予定なし']),
        ]
      : []),
    ...(note ? [`ユーザーが書いた今日の予定・気分: ${note}`] : []),
    ...surroundings.map(
      (s) =>
        `${s.near}: 緯度${s.point.lat.toFixed(4)} 経度${s.point.lon.toFixed(4)}${s.stations.length > 0 ? `（最寄り駅: ${s.stations.join('、')}）` : ''}`,
    ),
    ...(surroundings.length === 0 ? ['位置情報は取得できていない。'] : []),
    '',
    '## 今日の栄養',
    `1日の上限: ${formatPfc(status.limit)}（運動の消費 +${status.burnedCalories}kcal、${formatCarryover(status.carryover.calories)} を反映済み）`,
    `摂取済み: ${formatPfc(status.consumed)}`,
    `残り: ${formatPfc(status.remaining)}`,
    ...(status.isCheatDay
      ? [
          status.cheatDayCap === null
            ? '今日はチートデー（毎日記録を続けたご褒美）。上限を超えても負債にならないので、残りにこだわらず食べたい物を楽しめる案も出してよい。'
            : `今日はチートデー（毎日記録を続けたご褒美）。ただし最近超過した日が多いため、負債にならないのは上限から+${formatPfc(status.cheatDayCap)}まで。その範囲で食べたい物を楽しめる案も出してよい。`,
        ]
      : []),
    describeAllocation(slots),
    '今日食べた物:',
    ...(status.meals.length > 0
      ? status.meals.map(
          (m) =>
            `- ${m.time} ${m.name}${m.store ? `（${m.store}）` : ''} ${formatPfc(m)}`,
        )
      : ['- まだ無し']),
    '',
    `## 直近${HISTORY_DAYS}日の食事`,
    ...history
      .filter((day) => day.date !== today)
      .map(
        (day) =>
          `${day.date}: ${day.meals.map((m) => m.name + (m.store ? `（${m.store}）` : '')).join('、') || '記録なし'}`,
      ),
    '',
    '## メニュー選びのルール',
    `- 今日・昨日食べた物は避ける: ${avoid.join('、') || 'なし'}`,
    `- 2日以上前に食べた物はむしろ積極的に候補にしてよい: ${welcome.join('、') || 'なし'}`,
    ...(instructions ? [instructions] : []),
    '',
    '## 近くのお店',
    ...(stores.length > 0
      ? describeStores(stores)
      : ['- 取得できなかった。居場所の説明から考える。']),
    `栄養を公開している主なチェーン: ${CHAIN_STORES.map((c) => c.name).join('、')}`,
  ];

  if (storePreferences.length > 0) {
    lines.push(
      '',
      '## お店ごとのユーザーの好み',
      'これらのお店を提案するときは、ここに書かれた定番メニュー・注文のしかた・避けたい物に従う。',
      ...storePreferences.map((p) => `- ${p.store}: ${p.menu}`),
    );
  }

  if (request.stores && request.stores.length > 0) {
    lines.push(
      '',
      `## ユーザーが選んだお店\n次のお店だけから提案する: ${request.stores.map((s) => s.name).join('、')}`,
    );
  }
  if (request.avoid && request.avoid.length > 0) {
    lines.push(
      '',
      `## やり直し\n前回の提案（${request.avoid.join('、')}）は気に入らなかったので、別のお店・別のメニューにする。`,
    );
  }

  lines.push(
    '',
    '## 出力',
    `食事ごとに異なるお店で3案出す。meals には ${slots.join(', ')} の順に1件ずつ入れる。次のJSONのみを返し、説明文やMarkdownは付けない。数値は半角、単位は g / kcal。`,
    '{"meals":[{"slot":"breakfast | lunch | dinner","summary":"通知に出す30字以内の一言（1案目の要約）","options":[{"store":"店名","items":[{"name":"商品名","protein":0,"fat":0,"carbs":0,"calories":0}],"reason":"選んだ理由と残りとの関係を1〜2文","hasNewProduct":false}]}]}',
  );

  return { prompt: lines.join('\n'), today, stores };
}

// ---- 生成 ----

const number = z.coerce.number().catch(0);
const outputMealSchema = z.object({
  slot: mealSlotSchema,
  summary: z.string().catch(''),
  options: z
    .array(
      z.object({
        store: z.string().catch(''),
        items: z.array(
          z.object({
            name: z.string(),
            protein: number,
            fat: number,
            carbs: number,
            calories: number,
          }),
        ),
        reason: z.string().catch(''),
        hasNewProduct: z.boolean().catch(false),
      }),
    )
    .min(1),
});
const outputSchema = z.object({ meals: z.array(outputMealSchema) });

/** AI の出力から、提案を頼んだ食事枠それぞれの提案を取り出す。 */
function parseOutput(text: string, slots: MealSlot[]) {
  try {
    const { meals } = outputSchema.parse(JSON.parse(extractJsonObject(text)));
    return slots.map((slot) => {
      const meal = meals.find((m) => m.slot === slot);
      if (!meal) throw new Error(`${slot} の提案がありません`);
      return meal;
    });
  } catch (error) {
    console.error('meal suggestion parse error:', error, text);
    throw new ApiError('AI の提案を読み取れませんでした', 502);
  }
}

/**
 * 今日の摂取状況・履歴・予定・周辺のお店をもとに AI に食事を提案させ、保存して返す。
 * slot 指定時はその食事だけ、省略時は今日これからの食事をまとめて 1 回の AI 呼び出しで提案する。
 */
export async function generateMealSuggestions(
  userId: string,
  request: MealSuggestionRequest,
): Promise<MealSuggestion[]> {
  const slots = request.slot
    ? [request.slot]
    : remainingSlots(slotForTime(Date.now()));
  if (request.location) await saveLastLocation(userId, request.location);
  const { prompt, today, stores } = await buildPrompt(userId, request, slots);
  const { text, citations } = await callOpenAIWithWebSearch(prompt);
  const createdAt = Date.now();

  const suggestions = parseOutput(text, slots).map((meal): MealSuggestion => {
    const options = meal.options.map((option) => {
      const items = option.items.map((item) => ({
        ...item,
        protein: roundPFC(Math.max(0, item.protein), 1),
        fat: roundPFC(Math.max(0, item.fat), 1),
        carbs: roundPFC(Math.max(0, item.carbs), 1),
        calories: Math.round(Math.max(0, item.calories)),
      }));
      return { ...option, items, total: sumPFC(items) };
    });
    return {
      date: today,
      slot: meal.slot,
      createdAt,
      summary:
        meal.summary ||
        options
          .slice(0, 1)
          .map((o) => `${o.store} ${o.items.map((i) => i.name).join('＋')}`)
          .join(''),
      options,
      stores,
      sources: citations.slice(0, 8),
    };
  });
  await saveSuggestions(userId, today, createdAt, suggestions);
  return suggestions;
}
