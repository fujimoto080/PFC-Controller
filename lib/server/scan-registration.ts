import 'server-only';

import {
  foodDictionaryKey,
  normalizeBarcodes,
  toBarcodeFood,
} from '@/lib/barcode';
import type { SavedScanEntry, ScanSaveEntry } from '@/lib/scan-batch';
import { saveBarcodeMappings } from '@/lib/server/barcode-kv';
import { transaction } from '@/lib/server/db';
import { listFoods, upsertFoodsBulk } from '@/lib/server/foods';
import { createLogItemsBulk, findLogItemsByIds } from '@/lib/server/log-items';
import type { FoodItem } from '@/lib/types';

export function saveScanEntries(
  userId: string,
  entries: ScanSaveEntry[],
): Promise<SavedScanEntry[]> {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return transaction(async (db) => {
    // 同じユーザーの一括保存を直列化し、辞書の重複と再送時の二重登録を防ぐ。
    await db.query('SELECT id FROM users WHERE id = $1 FOR NO KEY UPDATE', [
      userId,
    ]);
    const existing = await findLogItemsByIds(userId, [...byId.keys()], db);
    const saved = new Map(existing.map((item) => [item.id, item]));
    const pending = [...byId.values()]
      .filter(({ id }) => !saved.has(id))
      .map((entry) => ({
        ...entry,
        barcodes: normalizeBarcodes(entry.barcodes),
      }));

    let ready = pending;
    try {
      await saveBarcodeMappings(
        pending.flatMap(({ barcodes, input }) =>
          barcodes.map((barcode) => ({ barcode, food: toBarcodeFood(input) })),
        ),
      );
    } catch (error) {
      // バーコード保存が失敗しても、バーコードを更新しない商品は記録できる。
      console.error('[スキャン一括保存] バーコードの保存に失敗', error);
      ready = pending.filter(({ barcodes }) => barcodes.length === 0);
    }

    const created = await createLogItemsBulk(userId, ready, db);
    if (existing.length === 0 && created.length === 0) return [];

    const dictionary = await listFoods(userId, db);
    const foodsById = new Map(dictionary.map((food) => [food.id, food]));
    const foodKeys = new Set(dictionary.map(foodDictionaryKey));
    const newFoods: FoodItem[] = [];
    for (const item of created) {
      saved.set(item.id, item);
    }
    // 辞書に入れるときは数量を掛ける前の値を使い、入力順で採番する。
    for (const { id, input } of ready) {
      if (!saved.has(id)) continue;
      const key = foodDictionaryKey(input);
      if (foodKeys.has(key)) continue;
      const { quantity: _quantity, ...unitFood } = input;
      const food = { ...unitFood, id };
      foodKeys.add(key);
      foodsById.set(id, food);
      newFoods.push(food);
    }
    if (newFoods.length > 0) await upsertFoodsBulk(userId, newFoods, db);

    return [...byId.keys()].flatMap((id) => {
      const item = saved.get(id);
      return item ? [{ item, food: foodsById.get(id) }] : [];
    });
  });
}
