'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useFormDraft } from '@/hooks/use-form-draft';
import type { BarcodeFood } from '@/lib/barcode';
import { addFoodItem, rememberFood } from '@/lib/client/actions';
import { fetchBarcodeFood } from '@/lib/client/api';
import { toLogInput } from '@/lib/food-form';
import {
  addBarcodeItem,
  finishLoading,
  readyFoods,
  restoreItems,
  updateItem,
  type BatchItem,
} from '@/lib/scan-batch';
import { toast } from '@/lib/toast';

// 閉じたりページが破棄されたりしても続きから再開できるよう一覧を保存する
const DRAFT_STORAGE_KEY = 'pfc_scan_batch';

interface ScanBatchDraft {
  items: BatchItem[];
  record: boolean;
}

const newId = () => crypto.randomUUID();

/** まとめてスキャンした商品の一覧と、照会・一括保存の操作。 */
export function useScanBatch() {
  const [items, setItems] = useState<BatchItem[]>([]);
  /** true なら食べた記録にも追加する。false なら食品リストへの登録だけ */
  const [record, setRecord] = useState(true);
  // 連続スキャンで更新が重なっても最新の一覧を元に計算するため ref にも持つ
  const itemsRef = useRef(items);
  const update = useCallback((fn: (items: BatchItem[]) => BatchItem[]) => {
    itemsRef.current = fn(itemsRef.current);
    setItems(itemsRef.current);
  }, []);

  const draft = useMemo<ScanBatchDraft>(
    () => ({ items, record }),
    [items, record],
  );
  const applyDraft = useCallback(
    (saved: ScanBatchDraft) => {
      update(() => restoreItems(saved.items));
      setRecord(saved.record);
    },
    [update],
  );
  useFormDraft(DRAFT_STORAGE_KEY, draft, applyDraft, true);

  const patch = (id: string, value: Partial<BatchItem>) => {
    update((current) => updateItem(current, id, value));
  };
  const finish = (id: string, value?: Partial<BatchItem>) => {
    update((current) => finishLoading(current, id, value));
  };
  const remove = (id: string) => {
    update((current) => current.filter((item) => item.id !== id));
  };

  /** 読み取ったバーコードを加えて照会する。戻り値は対象の行 ID と、既にあって数量を増やしたか。 */
  const addBarcode = (barcode: string) => {
    const id = newId();
    const result = addBarcodeItem(itemsRef.current, barcode, id);
    update(() => result.items);
    if (result.duplicate) {
      const existing = result.items.find((item) => item.barcode === barcode);
      return { id: existing?.id ?? id, duplicate: true };
    }
    fetchBarcodeFood(barcode)
      .then((food) => {
        finish(id, food ? { food } : undefined);
      })
      .catch((error: unknown) => {
        finish(id);
        toast.fromError('バーコード照会エラー', error);
      });
    return { id, duplicate: false };
  };

  /** 手で入力・修正した栄養値にする。保存時にバーコードへの紐付けも直す。 */
  const setFood = (id: string, food: BarcodeFood) => {
    patch(id, { status: 'ready', food, linkBarcode: true });
  };

  const setQuantity = (id: string, quantity: number) => {
    patch(id, { quantity });
  };

  const clear = () => {
    update(() => []);
  };

  /**
   * 栄養値のそろった商品をまとめて保存する。record なら指定時刻の食事として記録し、
   * どちらの場合も新しい食品は食品リストに加え、バーコードに食品情報を紐付ける。
   */
  const commit = (timestamp: number) => {
    const entries = readyFoods(itemsRef.current);
    let addedFoods = 0;
    const mappings: Promise<void>[] = [];
    for (const { item, food, scaled } of entries) {
      if (record) void addFoodItem(toLogInput(scaled, timestamp));
      const { foodAdded, mappingSaved } = rememberFood(
        { ...food, timestamp },
        item.linkBarcode ? item.barcode : undefined,
      );
      if (foodAdded) addedFoods++;
      if (mappingSaved) mappings.push(mappingSaved);
    }
    Promise.all(mappings).catch((error: unknown) =>
      toast.fromError('バーコード情報の保存に失敗しました', error),
    );

    const skipped = entries.length - addedFoods;
    if (record) {
      toast.success(`${entries.length}品を記録しました`, {
        description:
          addedFoods > 0
            ? `新しい${addedFoods}品は食品リストにも保存しました`
            : undefined,
      });
    } else {
      toast.success(`${addedFoods}品を食品リストに登録しました`, {
        description: skipped > 0 ? `${skipped}品は登録済みでした` : undefined,
      });
    }
    clear();
  };

  return {
    items,
    record,
    setRecord,
    addBarcode,
    setFood,
    setQuantity,
    remove,
    clear,
    commit,
  };
}

export type ScanBatch = ReturnType<typeof useScanBatch>;
