import { z } from 'zod';

export const pfcMacroSchema = z.object({
  protein: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
});

export const logBaseSchema = z.object({
  name: z.string().min(1),
  timestamp: z.number().int().positive(),
});

export const logItemInputSchema = logBaseSchema.merge(pfcMacroSchema).extend({
  calories: z.number().nonnegative(),
  store: z.string().optional(),
  storeGroup: z.string().optional(),
  image: z.string().optional(),
});

export const logActivityInputSchema = logBaseSchema.extend({
  sportId: z.string().min(1),
  caloriesBurned: z.number().nonnegative(),
});

export const uuidSchema = z.string().uuid();
