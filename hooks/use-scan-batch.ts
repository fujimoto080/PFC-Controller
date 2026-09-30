'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useFormDraft } from '@/hooks/use-form-draft';
import type { BarcodeFood } from '@/lib/barcode';
import { addFoodItem, rememberFood } from '@/lib/client/actions';
import {
  estimateNutritionFromImages,
  fetchBarcodeFood,
  readFoodsFromImage,
} from '@/lib/client/api';
import { toLogInput } from '@/lib/food-form';
import {
  addBarcodeItem,
  finishLoading,
  readyFoods,
  replaceWithFoods,
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
    () => ({ items: items.map(({ photos: _, ...item }) => item), record }),
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

  /** 写真に写った商品（複数可）を読み取って加える。 */
  const addPhoto = async (imageDataUrl: string) => {
    const id = newId();
    update((current) => [
      ...current,
      {
        id,
        status: 'loading',
        loadingLabel: '写真を読み取り中',
        quantity: 1,
        linkBarcode: false,
      },
    ]);
    try {
      const foods = await readFoodsFromImage(imageDataUrl);
      if (foods.length === 0) {
        remove(id);
        toast.info('写真から商品を読み取れませんでした', {
          description:
            '確認画面の「写真の読み取り結果を確認」から AI の応答を見られます',
        });
        return;
      }
      update((current) => replaceWithFoods(current, id, foods, newId));
    } catch (error) {
      remove(id);
      toast.fromError('写真の読み取りに失敗しました', error);
    }
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
      // 撮り直しに失敗したら元の内容に戻す
      finish(id);
      toast.fromError('写真の読み取りに失敗しました', error);
    }
  };

  /** 手で入力・修正した栄養値にする。バーコード付きなら保存時に紐付けも直す。 */
  const setFood = (id: string, food: BarcodeFood) => {
    const item = itemsRef.current.find((i) => i.id === id);
    patch(id, {
      status: 'ready',
      food,
      linkBarcode: item?.barcode !== undefined,
    });
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
    addPhoto,
    fillFromPhoto,
    setFood,
    setQuantity,
    remove,
    clear,
    commit,
  };
}

export type ScanBatch = ReturnType<typeof useScanBatch>;
