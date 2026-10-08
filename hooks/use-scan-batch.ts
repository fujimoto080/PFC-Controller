'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useFormDraft } from '@/hooks/use-form-draft';
import type { FoodTemplate } from '@/lib/food-form';
import {
  saveFoodRegistration,
  type FoodRegistration,
} from '@/lib/client/food-registration';
import {
  estimateNutritionFromImages,
  fetchBarcodeFood,
} from '@/lib/client/api';
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

/** まとめてスキャンした商品の一覧と、照会・写真読み取り・一括保存の操作。 */
export function useScanBatch(storageKey = DRAFT_STORAGE_KEY) {
  const [items, setItems] = useState<BatchItem[]>([]);
  /** true なら食べた記録にも追加する。false なら食品リストへの登録だけ */
  const [record, setRecordState] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  // 連続スキャンで更新が重なっても最新の一覧を元に計算するため ref にも持つ
  const itemsRef = useRef(items);
  const update = useCallback((fn: (items: BatchItem[]) => BatchItem[]) => {
    itemsRef.current = fn(itemsRef.current);
    setItems(itemsRef.current);
  }, []);

  const draft = useMemo<ScanBatchDraft>(
    () => ({ items: items.map(({ photos: _, ...item }) => item), record }),
    [items, record],
  );
  const applyDraft = useCallback(
    (saved: ScanBatchDraft) => {
      update(() => restoreItems(saved.items));
      setRecordState(saved.record);
    },
    [update],
  );
  useFormDraft(storageKey, draft, applyDraft, true);

  const addFoods = (foods: FoodTemplate[]) => {
    update((current) => [
      ...current,
      ...foods.map((food): BatchItem => ({
        id: newId(),
        status: 'ready',
        barcode: '',
        food,
        quantity: 1,
        linkBarcode: false,
      })),
    ]);
  };

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

  /**
   * 成分表示を撮った写真から栄養値を入れる（未登録の商品の入力・登録済みの商品の撮り直し）。
   * append なら前に読み取った写真と合わせて読み取り直す（成分表示と商品名が別の面にある商品のため）。
   */
  const fillFromPhoto = async (
    id: string,
    imageDataUrl: string,
    append: boolean,
  ) => {
    const previous = append
      ? (itemsRef.current.find((item) => item.id === id)?.photos ?? [])
      : [];
    const photos = [...previous, imageDataUrl];
    patch(id, { status: 'loading', loadingLabel: '成分表示を読み取り中' });
    try {
      const food = await estimateNutritionFromImages(photos);
      finish(id, { food, photos, linkBarcode: true });
    } catch (error) {
      // 失敗したら元の内容に戻す
      finish(id);
      toast.fromError('写真の読み取りに失敗しました', error);
    }
  };

  /** 共通フォームの編集内容を一覧に反映し、一括保存まで保持する。 */
  const setRegistration = (id: string, entry: FoodRegistration) => {
    patch(id, {
      status: 'ready',
      food: entry.food,
      quantity: entry.quantity,
      barcodes: entry.barcodes,
      timestamp: entry.food.timestamp,
      saveFood: entry.saveFood,
      record: entry.record,
      photos: entry.photos,
      linkBarcode: true,
    });
  };

  const setRecord = (value: boolean) => {
    setRecordState(value);
    update((current) => current.map((item) => ({ ...item, record: value })));
  };

  const setQuantity = (id: string, quantity: number) => {
    patch(id, { quantity });
  };

  const setTimestamp = (timestamp: number) => {
    update((current) => current.map((item) => ({ ...item, timestamp })));
  };

  const clear = () => {
    update(() => []);
  };

  /** 保存できた商品だけ一覧から外し、失敗した商品は再試行できるよう残す。 */
  const commit = async (timestamp: number): Promise<boolean> => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    const entries = readyFoods(itemsRef.current);
    let savedCount = 0;
    for (const { item, food } of entries) {
      const saved = await saveFoodRegistration({
        food: { ...food, timestamp: item.timestamp ?? timestamp },
        quantity: item.quantity,
        barcodes: item.barcodes ?? (item.linkBarcode ? [item.barcode] : []),
        saveFood: item.saveFood ?? true,
        record: item.record ?? record,
      });
      if (saved) {
        remove(item.id);
        savedCount++;
      }
    }
    setSaving(false);
    savingRef.current = false;
    if (savedCount > 0) toast.success(`${savedCount}品を保存しました`);
    return itemsRef.current.length === 0;
  };

  return {
    items,
    record,
    setRecord,
    addBarcode,
    addFoods,
    fillFromPhoto,
    setRegistration,
    saving,
    setQuantity,
    setTimestamp,
    remove,
    clear,
    commit,
  };
}

export type ScanBatch = ReturnType<typeof useScanBatch>;
