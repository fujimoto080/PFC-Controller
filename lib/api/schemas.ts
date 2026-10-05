import { z } from 'zod';
import type {
  FoodItem,
  FoodItemInput,
  GeoPoint,
  MealPreferences,
  MealSchedule,
  MealSlot,
  MealNote,
  MealSplit,
  MealSuggestionRequest,
  NearbyStore,
  PFC,
  SportActivityInput,
  SportDefinition,
  UsageEventInput,
  UserSettings,
} from '@/lib/types';
import { MEAL_SUGGESTION_AVOID_LIMIT } from '@/lib/types';
import { MAX_READING_IMAGES, type BarcodeFood } from '@/lib/barcode';

const nonNegative = z.number().nonnegative();

const pfcSchema = z.object({
  protein: nonNegative,
  fat: nonNegative,
  carbs: nonNegative,
  calories: nonNegative,
}) satisfies z.ZodType<PFC>;

const timestampSchema = z.number().int().positive();

export const foodInputSchema = pfcSchema.extend({
  name: z.string().min(1),
  timestamp: timestampSchema,
  store: z.string().optional(),
  storeGroup: z.string().optional(),
  image: z.string().optional(),
}) satisfies z.ZodType<FoodItemInput>;

// 食品辞書の id はクライアント採番（seed データは sukiya_NNN 形式）なので uuid に限定しない。
const foodIdSchema = z.string().trim().min(1);

export const foodCreateSchema = foodInputSchema.extend({
  id: foodIdSchema,
}) satisfies z.ZodType<FoodItem>;

export const foodImportSchema = z.object({
  email: z.email(),
  foods: z
    .array(foodCreateSchema.extend({ timestamp: timestampSchema.optional() }))
    .min(1)
    .max(2000),
});

const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
}) satisfies z.ZodType<GeoPoint>;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const weekdaysSchema = z.array(z.number().int().min(0).max(6));
const namedPlaceSchema = z.object({
  label: z.string().trim(),
  point: geoPointSchema.optional(),
});

const mealScheduleSchema = z.object({
  home: namedPlaceSchema,
  office: namedPlaceSchema,
  workStart: hhmmSchema,
  workEnd: hhmmSchema,
  workDays: weekdaysSchema,
  remoteDays: weekdaysSchema,
}) satisfies z.ZodType<MealSchedule>;

const mealPreferencesSchema = z.object({
  instructions: z.string().trim().max(4000),
  stores: z
    .array(
      z.object({
        store: z.string().trim().min(1).max(100),
        menu: z.string().trim().min(1).max(500),
      }),
    )
    .max(50),
}) satisfies z.ZodType<MealPreferences>;

export const mealSlotSchema = z.enum([
  'breakfast',
  'lunch',
  'dinner',
]) satisfies z.ZodType<MealSlot>;

const nearbyStoreSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string(),
  point: geoPointSchema,
  near: z.string(),
  distanceM: z.number().nonnegative(),
  isChain: z.boolean(),
}) satisfies z.ZodType<NearbyStore>;

export const mealSuggestionRequestSchema = z.object({
  slot: mealSlotSchema.optional(),
  location: geoPointSchema.optional(),
  stores: z.array(nearbyStoreSchema).max(30).optional(),
  avoid: z
    .array(z.string().max(MEAL_SUGGESTION_AVOID_LIMIT.length))
    .max(MEAL_SUGGESTION_AVOID_LIMIT.count)
    .optional(),
}) satisfies z.ZodType<MealSuggestionRequest>;

export const mealNoteSchema = z.object({
  note: z.string().trim().max(500),
}) satisfies z.ZodType<MealNote>;

const percent = z.number().int().min(0).max(100);
export const mealSplitSchema = z
  .object({ breakfastEnd: percent, lunchEnd: percent })
  .refine((split) => split.breakfastEnd <= split.lunchEnd, {
    message: '朝と昼の境目は昼と夜の境目以下にしてください',
  }) satisfies z.ZodType<MealSplit>;

const usageEventSchema = z.object({
  kind: z.enum(['page', 'click', 'swipe']),
  name: z.string().trim().min(1).max(100),
  path: z.string().max(200),
}) satisfies z.ZodType<UsageEventInput>;

export const usageEventsSchema = z.object({
  events: z.array(usageEventSchema).min(1).max(100),
});

/** 栄養成分表示・料理の写真の読み取りリクエスト。複数枚は同じ商品を別の面から撮ったもの。 */
export const imageBodySchema = z.object({
  imageDataUrls: z
    .array(
      z
        .string()
        .trim()
        .regex(
          /^data:image\/[a-zA-Z0-9.+-]+;base64,.+$/,
          '画像データの形式が不正です',
        ),
    )
    .min(1, '画像を1枚以上送ってください')
    .max(MAX_READING_IMAGES, `画像は${MAX_READING_IMAGES}枚まで送れます`),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export const settingsSchema = z.object({
  targetPFC: pfcSchema,
  profile: z
    .object({
      gender: z.enum(['male', 'female']),
      age: z.number().positive(),
      height: z.number().positive(),
      weight: z.number().positive(),
      targetWeight: z.number().positive(),
      activityLevel: z.number().positive(),
    })
    .optional(),
  favoriteFoodIds: z.array(z.string()),
  carryoverExcludedDates: z.array(dateSchema),
  mealSchedule: mealScheduleSchema.optional(),
  mealPreferences: mealPreferencesSchema.optional(),
}) satisfies z.ZodType<UserSettings>;

export const sportsSchema = z.array(
  z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1),
    mets: z.number().positive(),
  }),
) satisfies z.ZodType<SportDefinition[]>;

export const activityInputSchema = z.object({
  sportId: z.string().min(1),
  name: z.string().min(1),
  caloriesBurned: nonNegative,
  timestamp: timestampSchema,
}) satisfies z.ZodType<SportActivityInput>;

export const healthSyncSchema = z
  .object({
    email: z.email(),
    date: dateSchema,
    caloriesBurned: nonNegative.optional(),
    weightKg: z.number().positive().optional(),
    bodyFatPercent: z.number().positive().max(100).optional(),
    steps: z.number().int().nonnegative().optional(),
  })
  .refine(
    ({ caloriesBurned, weightKg, bodyFatPercent, steps }) =>
      [caloriesBurned, weightKg, bodyFatPercent, steps].some(
        (value) => value !== undefined,
      ),
    { message: '同期する項目を 1 つ以上指定してください' },
  );

export const uuidParamsSchema = z.object({ id: z.uuid() });

export const foodParamsSchema = z.object({ id: foodIdSchema });

export const barcodeFoodSchema = pfcSchema.extend({
  name: z.string().min(1),
  store: z.string().optional(),
}) satisfies z.ZodType<BarcodeFood>;
