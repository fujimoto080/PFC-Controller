import type { BarcodeFood } from './barcode';
import { scalePFC, sumPFC } from './pfc';
import type { PFC } from './types';

// バーコードの連続読み取りや写真の読み取りで溜めて、まとめて記録・登録する商品の一覧。

type BatchItemStatus = 'ready' | 'loading' | 'missing';

export interface BatchItem {
  id: string;
  /** ready: 栄養値あり / loading: 照会・読み取り中 / missing: 未登録で栄養値が無い */
  status: BatchItemStatus;
  /** loading 中に出す説明 */
  loadingLabel?: string;
  barcode?: string;
  /** 1 個あたりの栄養値 */
  food?: BarcodeFood;
  quantity: number;
  /** 保存時にバーコードへ食品情報を紐付けるか（未登録だった・内容を直した） */
  linkBarcode: boolean;
}

export const QUANTITY_STEP = 0.5;

/** 読み取ったバーコードを一覧に加える。同じバーコードが既にあれば数量を 1 増やす。 */
export function addBarcodeItem(
  items: BatchItem[],
  barcode: string,
  id: string,
): { items: BatchItem[]; duplicate: boolean } {
  if (items.some((item) => item.barcode === barcode)) {
    return {
      items: items.map((item) =>
        item.barcode === barcode
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      ),
      duplicate: true,
    };
  }
  return {
    items: [
      ...items,
      {
        id,
        status: 'loading',
        loadingLabel: '商品を照会中',
        barcode,
        quantity: 1,
        linkBarcode: false,
      },
    ],
    duplicate: false,
  };
}

/** 写真から読み取った商品を、読み取り中の仮の行と置き換える。 */
export function replaceWithFoods(
  items: BatchItem[],
  placeholderId: string,
  foods: BarcodeFood[],
  newId: () => string,
): BatchItem[] {
  return items.flatMap((item) =>
    item.id === placeholderId
      ? foods.map((food) => ({
          id: newId(),
          status: 'ready' as const,
          food,
          quantity: 1,
          linkBarcode: false,
        }))
      : [item],
  );
}

export function updateItem(
  items: BatchItem[],
  id: string,
  patch: Partial<BatchItem>,
): BatchItem[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

/** 保存しておいた一覧を復元する。中断された照会は未登録、写真の読み取りは取り消す。 */
export function restoreItems(items: BatchItem[]): BatchItem[] {
  return items.flatMap((item) => {
    if (item.status !== 'loading') return [item];
    if (!item.barcode) return [];
    return [
      {
        ...item,
        status: item.food ? ('ready' as const) : ('missing' as const),
        loadingLabel: undefined,
      },
    ];
  });
}

/** 栄養値のそろった商品を数量込みで返す。 */
export function readyFoods(items: BatchItem[]) {
  return items.flatMap((item) =>
    item.status === 'ready' && item.food
      ? [{ item, food: item.food, scaled: scalePFC(item.food, item.quantity) }]
      : [],
  );
}

export function batchTotal(items: BatchItem[]): PFC {
  return sumPFC(readyFoods(items).map(({ scaled }) => scaled));
}
