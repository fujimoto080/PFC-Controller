import { z } from 'zod';
import type {
  FoodItem,
  FoodItemInput,
  PFC,
  SportActivityInput,
  SportDefinition,
  UserSettings,
} from '@/lib/types';
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
