import 'server-only';

import type { McpServer, ServerContext } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { foodInputSchema } from '@/lib/api/schemas';
import { rankFrequentFoods } from '@/lib/food-suggestions';
import { burnedCalories, computeDailyLimit, subtractPFC } from '@/lib/pfc';
import { listFoods } from '@/lib/server/foods';
import { createLogActivity } from '@/lib/server/log-activities';
import { createLogItem, listLogItemsBetween } from '@/lib/server/log-items';
import { getSettings } from '@/lib/server/settings';
import { listSports } from '@/lib/server/sports';
import { getLogsBetween, getUserData } from '@/lib/server/user-data';
import {
  EMPTY_PFC,
  type DailyLog,
  type FoodItem,
  type PFC,
  type SportActivityLog,
} from '@/lib/types';
import {
  defaultTimestampFor,
  formatDate,
  formatTime,
  shiftDate,
  toJstTimestamp,
} from '@/lib/utils';

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('日付 (YYYY-MM-DD, JST)');

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .describe('時刻 (HH:mm, JST)。省略時は今日なら現在時刻、それ以外は 12:00');

const loggedAtSchema = {
  date: dateSchema
    .optional()
    .describe('記録する日 (YYYY-MM-DD, JST)。省略時は今日'),
  time: timeSchema.optional(),
};

function timestampOf(date: string | undefined, time: string | undefined) {
  const day = date ?? formatDate(Date.now());
  return time ? toJstTimestamp(day, time) : defaultTimestampFor(day);
}

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

function toActivity(activity: SportActivityLog) {
  return {
    time: formatTime(activity.timestamp),
    name: activity.name,
    caloriesBurned: activity.caloriesBurned,
  };
}

function toDay(log: DailyLog) {
  return {
    date: log.date,
    total: log.total,
    burnedCalories: burnedCalories(log),
    meals: [...log.items].sort((a, b) => a.timestamp - b.timestamp).map(toMeal),
    activities: log.activities.map(toActivity),
  };
}

async function getNutritionStatus(userId: string, date: string) {
  // 上限は前日までの超過（負債）に依存するため全履歴を読む
  const { logs, settings } = await getUserData(userId);
  const {
    limit,
    debt,
    burnedCalories: burned,
  } = computeDailyLimit(date, settings.targetPFC, logs);
  const log = logs[date];
  const consumed = log?.total ?? { ...EMPTY_PFC };
  const now = Date.now();
  return {
    date,
    currentTime: formatDate(now) === date ? formatTime(now) : undefined,
    baseTarget: settings.targetPFC,
    burnedCalories: burned,
    debt,
    limit,
    consumed,
    remaining: subtractPFC(limit, consumed),
    meals: log ? toDay(log).meals : [],
    activities: log ? log.activities.map(toActivity) : [],
    profile: settings.profile,
  };
}

async function getMealHistory(userId: string, days: number) {
  const today = formatDate(Date.now());
  const logs = await getLogsBetween(userId, shiftDate(today, 1 - days), today);
  return Object.values(logs)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(toDay);
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

const logMealSchema = foodInputSchema
  .pick({
    name: true,
    protein: true,
    fat: true,
    carbs: true,
    calories: true,
    store: true,
  })
  .extend(loggedAtSchema);

const logActivitySchema = z.object({
  sport: z
    .string()
    .min(1)
    .describe('登録スポーツの名前（list_sports の name）'),
  ...loggedAtSchema,
});

async function logMeal(userId: string, input: z.infer<typeof logMealSchema>) {
  const { date, time, ...food } = input;
  const item = await createLogItem(userId, {
    ...food,
    timestamp: timestampOf(date, time),
  });
  return {
    logged: toMeal(item),
    status: await getNutritionStatus(userId, formatDate(item.timestamp)),
  };
}

async function logActivity(
  userId: string,
  { sport, date, time }: z.infer<typeof logActivitySchema>,
) {
  const sports = await listSports(userId);
  const definition = sports.find((s) => s.name === sport);
  if (!definition) {
    throw new Error(
      `スポーツ「${sport}」は登録されていません。登録済み: ${sports.map((s) => s.name).join(', ')}`,
    );
  }
  const activity = await createLogActivity(userId, {
    sportId: definition.id,
    name: definition.name,
    caloriesBurned: definition.caloriesBurned,
    timestamp: timestampOf(date, time),
  });
  return {
    logged: toActivity(activity),
    status: await getNutritionStatus(userId, formatDate(activity.timestamp)),
  };
}

const WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
};

/** 献立の提案と食事・運動の記録に使うツール群。栄養値の単位は g / kcal。 */
export function registerMealPlanningTools(server: McpServer) {
  server.registerTool(
    'get_nutrition_status',
    {
      title: '摂取状況の取得',
      description:
        '指定日（省略時は今日）の1日の上限と摂取状況を返す。limit がその日の上限（PFC は g、calories は kcal）で、baseTarget（設定した目標）にその日の運動の消費カロリー burnedCalories を足し、前日までの超過 debt を差し引いたもの。remaining = limit - consumed（負なら超過）。食べた物 meals・運動 activities・プロフィールも返す。献立を考えるときは最初にこれを呼ぶ。',
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
        '今日を含む直近 days 日分の食事記録と運動記録を、日ごとの摂取合計・運動の消費カロリー付きで返す（記録の無い日は含まない）。献立が最近の食事と重ならないようにするために使う。',
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

  server.registerTool(
    'list_sports',
    {
      title: '登録スポーツの一覧',
      description:
        'ユーザーが登録しているスポーツと1回あたりの消費カロリー (kcal) を返す。記録するとその日のカロリー上限が消費分だけ増える。運動の予定に合わせて献立の量を調整するときに使う。',
      annotations: { readOnlyHint: true },
    },
    async (ctx) => {
      const sports = await listSports(userIdOf(ctx));
      return jsonResult(
        sports.map(({ name, caloriesBurned }) => ({ name, caloriesBurned })),
      );
    },
  );

  server.registerTool(
    'log_meal',
    {
      title: '食事の記録',
      description:
        '食べた物を1品ずつ食事記録に追加する。protein / fat / carbs は g、calories は kcal。登録食品を食べた場合は list_foods の名前・店舗・栄養値をそのまま使う。記録した内容と、記録後のその日の摂取状況（get_nutrition_status と同じ形）を返す。ユーザーが食べたと明言した物だけを記録し、提案しただけの献立は記録しない。',
      inputSchema: logMealSchema,
      annotations: WRITE_ANNOTATIONS,
    },
    async (input, ctx) => jsonResult(await logMeal(userIdOf(ctx), input)),
  );

  server.registerTool(
    'log_activity',
    {
      title: '運動の記録',
      description:
        '登録スポーツを1回分、運動記録に追加する。消費カロリーは登録値が使われ、その日のカロリー上限が増える。記録した内容と、記録後のその日の摂取状況（get_nutrition_status と同じ形）を返す。',
      inputSchema: logActivitySchema,
      annotations: WRITE_ANNOTATIONS,
    },
    async (input, ctx) => jsonResult(await logActivity(userIdOf(ctx), input)),
  );
}
