import { z } from 'zod';
import type {
  FoodItem,
  FoodItemInput,
  GeoPoint,
  MealPreferences,
  MealSchedule,
  MealSlot,
  MealNote,
  MealSuggestionRequest,
  NearbyStore,
  PFC,
  SportActivityInput,
  SportDefinition,
  UserSettings,
} from '@/lib/types';
import { MEAL_SUGGESTION_AVOID_LIMIT } from '@/lib/types';
import type { BarcodeFood } from '@/lib/barcode';

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

/** 栄養成分表示・料理の写真の読み取りリクエスト。 */
export const imageBodySchema = z.object({
  imageDataUrl: z
    .string()
    .trim()
    .regex(
      /^data:image\/[a-zA-Z0-9.+-]+;base64,.+$/,
      '画像データの形式が不正です',
    ),
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
    caloriesBurned: nonNegative,
  }),
) satisfies z.ZodType<SportDefinition[]>;

export const activityInputSchema = z.object({
  sportId: z.string().min(1),
  name: z.string().min(1),
  caloriesBurned: nonNegative,
  timestamp: timestampSchema,
}) satisfies z.ZodType<SportActivityInput>;

export const uuidParamsSchema = z.object({ id: z.uuid() });

export const foodParamsSchema = z.object({ id: foodIdSchema });

export const barcodeFoodSchema = pfcSchema.extend({
  name: z.string().min(1),
  store: z.string().optional(),
}) satisfies z.ZodType<BarcodeFood>;
