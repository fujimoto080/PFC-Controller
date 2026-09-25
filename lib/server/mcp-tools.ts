import 'server-only';

import type { McpServer, ServerContext } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { rankFrequentFoods } from '@/lib/food-suggestions';
import { sumPFC, subtractPFC } from '@/lib/pfc';
import { listFoods } from '@/lib/server/foods';
import { listLogItemsBetween } from '@/lib/server/log-items';
import { getSettings } from '@/lib/server/settings';
import type { FoodItem, PFC } from '@/lib/types';
import { formatDate, formatTime, shiftDate } from '@/lib/utils';

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('日付 (YYYY-MM-DD, JST)');

function userIdOf(ctx: ServerContext): string {
  const userId = ctx.http?.authInfo?.extra?.userId;
  if (typeof userId !== 'string') throw new Error('認証情報がありません');
  return userId;
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

function pfcOf({ protein, fat, carbs, calories }: PFC): PFC {
  return { protein, fat, carbs, calories };
}

function toMeal(item: FoodItem) {
  return {
    time: formatTime(item.timestamp),
    name: item.name,
    store: item.store,
    ...pfcOf(item),
  };
}

async function getNutritionStatus(userId: string, date: string) {
  const [settings, items] = await Promise.all([
    getSettings(userId),
    listLogItemsBetween(userId, date, date),
  ]);
  const consumed = sumPFC(items);
  const now = Date.now();
  return {
    date,
    currentTime: formatDate(now) === date ? formatTime(now) : undefined,
    target: settings.targetPFC,
    consumed,
    remaining: subtractPFC(settings.targetPFC, consumed),
    meals: items.map(toMeal),
    profile: settings.profile,
  };
}

async function getMealHistory(userId: string, days: number) {
  const today = formatDate(Date.now());
  const items = await listLogItemsBetween(
    userId,
    shiftDate(today, 1 - days),
    today,
  );
  const byDate = Map.groupBy(items, (item) => item.date);
  return [...byDate].map(([date, dayItems]) => ({
    date,
    total: sumPFC(dayItems),
    meals: dayItems.map(toMeal),
  }));
}

async function searchFoods(userId: string, keyword: string | undefined) {
  const [foods, settings] = await Promise.all([
    listFoods(userId),
    getSettings(userId),
  ]);
  return foods
    .filter(
      (food) =>
        !keyword ||
        food.name.includes(keyword) ||
        food.store?.includes(keyword),
    )
    .map((food) => ({
      name: food.name,
      store: food.store,
      favorite: settings.favoriteFoodIds.includes(food.id),
      ...pfcOf(food),
    }));
}

async function getFrequentFoods(userId: string, days: number, limit: number) {
  const today = formatDate(Date.now());
  const [items, foods, settings] = await Promise.all([
    listLogItemsBetween(userId, shiftDate(today, 1 - days), today),
    listFoods(userId),
    getSettings(userId),
  ]);
  return {
    today,
    frequentFoods: rankFrequentFoods(items).slice(0, limit),
    favoriteFoods: foods
      .filter((food) => settings.favoriteFoodIds.includes(food.id))
      .map((food) => ({ name: food.name, store: food.store, ...pfcOf(food) })),
  };
}

/** 献立の提案に使う読み取り専用ツール群。栄養値の単位は g / kcal。 */
export function registerMealPlanningTools(server: McpServer) {
  server.registerTool(
    'get_nutrition_status',
    {
      title: '摂取状況の取得',
      description:
        '指定日（省略時は今日）の目標 PFC・摂取済み PFC・目標までの残り・食べた物の一覧と、目標の元になったプロフィールを返す。献立を考えるときは最初にこれを呼ぶ。',
      inputSchema: z.object({ date: dateSchema.optional() }),
      annotations: { readOnlyHint: true },
    },
    async ({ date }, ctx) =>
      jsonResult(
        await getNutritionStatus(userIdOf(ctx), date ?? formatDate(Date.now())),
      ),
  );

  server.registerTool(
    'get_meal_history',
    {
      title: '食事履歴の取得',
      description:
        '今日を含む直近 days 日分の食事記録を日ごとの合計付きで返す（記録の無い日は含まない）。献立が最近の食事と重ならないようにするために使う。',
      inputSchema: z.object({
        days: z.number().int().min(1).max(31).default(7),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ days }, ctx) =>
      jsonResult(await getMealHistory(userIdOf(ctx), days)),
  );

  server.registerTool(
    'list_foods',
    {
      title: '登録食品の一覧',
      description:
        'ユーザーが登録している食品（店舗メニュー・よく食べる物）と栄養値を返す。favorite はユーザーがお気に入りにした食品。keyword を指定すると食品名か店舗名に含むものだけに絞る。実在するメニューから献立を組むときに使う。',
      inputSchema: z.object({
        keyword: z.string().min(1).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ keyword }, ctx) =>
      jsonResult(await searchFoods(userIdOf(ctx), keyword)),
  );

  server.registerTool(
    'get_frequent_foods',
    {
      title: 'よく食べる食品',
      description:
        '直近 days 日の記録を食品名ごとに集計し、食べた回数の多い順に回数・最後に食べた日・栄養値を返す（frequentFoods）。あわせてユーザーがお気に入りにした食品（favoriteFoods）も返す。好みに合う食品を提案しつつ、最近続いている物は避けるために使う。',
      inputSchema: z.object({
        days: z.number().int().min(1).max(365).default(60),
        limit: z.number().int().min(1).max(100).default(30),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ days, limit }, ctx) =>
      jsonResult(await getFrequentFoods(userIdOf(ctx), days, limit)),
  );
}
