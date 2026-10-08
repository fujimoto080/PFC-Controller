import 'server-only';

import type { McpServer, ServerContext } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { foodInputSchema } from '@/lib/api/schemas';
import { rankFrequentFoods } from '@/lib/food-suggestions';
import { DEFAULT_PROFILE } from '@/lib/nutrition-goals';
import { listFoods } from '@/lib/server/foods';
import {
  getMealHistory,
  getNutritionStatus,
  pfcOf,
  toActivity,
  toMeal,
} from '@/lib/server/meal-context';
import { createLogActivity } from '@/lib/server/log-activities';
import { createLogItem, listLogItemsBetween } from '@/lib/server/log-items';
import { getSettings } from '@/lib/server/settings';
import { listSports } from '@/lib/server/sports';
import { recordUsageEvents } from '@/lib/server/usage-events';
import {
  DEFAULT_SPORT_INTENSITY,
  SPORT_INTENSITIES,
  buildSportActivity,
} from '@/lib/sports';
import {
  defaultTimestampFor,
  formatDate,
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
  intensity: z
    .enum(SPORT_INTENSITIES.map(({ value }) => value))
    .default(DEFAULT_SPORT_INTENSITY)
    .describe(
      `運動強度。${SPORT_INTENSITIES.map(({ value, label, factor }) => `${value}=${label}（METs×${factor}）`).join('、')}`,
    ),
  minutes: z.number().positive().describe('運動した時間（分）'),
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
  { sport, intensity, minutes, date, time }: z.infer<typeof logActivitySchema>,
) {
  const [sports, settings] = await Promise.all([
    listSports(userId),
    getSettings(userId),
  ]);
  const definition = sports.find((s) => s.name === sport);
  if (!definition) {
    throw new Error(
      `スポーツ「${sport}」は登録されていません。登録済み: ${sports.map((s) => s.name).join(', ')}`,
    );
  }
  const activity = await createLogActivity(
    userId,
    buildSportActivity(definition, {
      intensity,
      minutes,
      weight: (settings.profile ?? DEFAULT_PROFILE).weight,
      timestamp: timestampOf(date, time),
    }),
  );
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

type ToolCallback = (...args: unknown[]) => unknown;

/** registerTool の型はオーバーロードが多いため、差し替え用に引数を緩めて扱う。 */
interface ToolRegistry {
  registerTool(name: string, config: unknown, cb: ToolCallback): unknown;
}

/** 登録するツールの呼び出しを利用状況として記録する。コールバックの最後の引数が ctx になる。 */
function trackToolCalls(server: McpServer) {
  const registry = server as unknown as ToolRegistry;
  const registerTool = registry.registerTool.bind(registry);
  registry.registerTool = (name, config, cb) =>
    registerTool(name, config, async (...args) => {
      const userId = userIdOf(args.at(-1) as ServerContext);
      await recordUsageEvents(userId, [{ kind: 'mcp', name, path: null }]);
      return cb(...args);
    });
}

/** 献立の提案と食事・運動の記録に使うツール群。栄養値の単位は g / kcal。 */
export function registerMealPlanningTools(server: McpServer) {
  trackToolCalls(server);
  server.registerTool(
    'get_nutrition_status',
    {
      title: '摂取状況の取得',
      description: `指定日（省略時は今日）の栄養目標と摂取状況を返す。baseTarget はプロフィールから計算した基本目標。limit は直近のカロリー超過を7日間に分散した今日の目標。adjustment は減額・残る超過・下限を返す。減額は基本の5%・100kcalまで、総赤字25%と最低カロリーの下限を守る。P/Fは固定、Cで調整する。calorieRange はカロリーの許容範囲、fatRange は脂質の目安。remaining = limit - consumed。Pは確保する目標、F/Cは目安で、残りカロリー内でPを優先する。PFCを全部埋めるための追加食は求めない。栄養素別の繰越や不足の先取りはしない。超過は7日で調整を終了し無理に返済しない。weekly は前日まで7日間の記録日の平均（未記録日は除外）。運動は活動レベルに含め、burnedCalories は記録値のみで食事枠に加算しない。献立を考えるときは最初にこれを呼び、mealPreferences.instructions と stores に従う。`,
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
        'ユーザーが登録しているスポーツと、その消費の単位 METs を返す。消費カロリーは METs × 強度係数 × 体重(kg) × 時間(h) × 1.05 で決まり、記録するとその日のカロリー上限が消費分だけ増える。運動の予定に合わせて献立の量を調整するときに使う。',
      annotations: { readOnlyHint: true },
    },
    async (ctx) => {
      const sports = await listSports(userIdOf(ctx));
      return jsonResult(sports.map(({ name, mets }) => ({ name, mets })));
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
        '登録スポーツを、強度と運動時間(分)を指定して運動記録に追加する。消費カロリーは登録した METs とユーザーの体重から計算され、その日のカロリー上限が増える。記録した内容と、記録後のその日の摂取状況（get_nutrition_status と同じ形）を返す。',
      inputSchema: logActivitySchema,
      annotations: WRITE_ANNOTATIONS,
    },
    async (input, ctx) => jsonResult(await logActivity(userIdOf(ctx), input)),
  );
}
