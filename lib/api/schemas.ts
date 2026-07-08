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

// 食品辞書の1件分。フィールド構成は食事記録アイテムと同じなので logItemInputSchema を流用する。
// 新規作成時は id をクライアント側で採番して送る（生成食品は uuid 以外の id を持つため
// uuid には限定せず非空文字列とする）。
export const foodCreateSchema = logItemInputSchema.extend({
  id: z.string().min(1),
});

export const uuidSchema = z.string().uuid();
