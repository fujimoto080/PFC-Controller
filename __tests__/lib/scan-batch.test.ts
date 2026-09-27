import type { BarcodeFood } from '@/lib/barcode';
import {
  addBarcodeItem,
  batchTotal,
  replaceWithFoods,
  restoreItems,
  type BatchItem,
} from '@/lib/scan-batch';

const onigiri: BarcodeFood = {
  name: 'おにぎり',
  protein: 4,
  fat: 1,
  carbs: 40,
  calories: 180,
};
const chicken: BarcodeFood = {
  name: 'サラダチキン',
  protein: 24,
  fat: 1.5,
  carbs: 0.5,
  calories: 110,
};

const ready = (id: string, food: BarcodeFood, quantity = 1): BatchItem => ({
  id,
  status: 'ready',
  food,
  quantity,
  linkBarcode: false,
});

describe('addBarcodeItem', () => {
  it('新しいバーコードは照会中の行として末尾に加える', () => {
    const result = addBarcodeItem([], '4901234567894', 'a');
    expect(result.duplicate).toBe(false);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'a',
        status: 'loading',
        barcode: '4901234567894',
        quantity: 1,
      }),
    ]);
  });

  it('同じバーコードは行を増やさず数量を 1 増やす', () => {
    const items = [{ ...ready('a', onigiri), barcode: '4901234567894' }];
    const result = addBarcodeItem(items, '4901234567894', 'b');
    expect(result.duplicate).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.quantity).toBe(2);
  });
});

describe('replaceWithFoods', () => {
  it('読み取り中の仮の行を、読み取った商品に置き換える', () => {
    const items: BatchItem[] = [
      ready('a', onigiri),
      { id: 'p', status: 'loading', quantity: 1, linkBarcode: false },
    ];
    let seq = 0;
    const result = replaceWithFoods(items, 'p', [chicken, onigiri], () => {
      seq++;
      return `n${seq}`;
    });
    expect(result.map((item) => [item.id, item.food?.name])).toEqual([
      ['a', 'おにぎり'],
      ['n1', 'サラダチキン'],
      ['n2', 'おにぎり'],
    ]);
  });
});

describe('restoreItems', () => {
  it('中断したバーコード照会は未登録に、写真の読み取りは取り消す', () => {
    const items: BatchItem[] = [
      ready('a', onigiri),
      {
        id: 'b',
        status: 'loading',
        barcode: '4901234567894',
        quantity: 1,
        linkBarcode: false,
      },
      {
        id: 'c',
        status: 'loading',
        barcode: '4909876543218',
        food: chicken,
        quantity: 1,
        linkBarcode: true,
      },
      { id: 'p', status: 'loading', quantity: 1, linkBarcode: false },
    ];
    expect(restoreItems(items).map((item) => [item.id, item.status])).toEqual([
      ['a', 'ready'],
      ['b', 'missing'],
      ['c', 'ready'],
    ]);
  });
});

describe('batchTotal', () => {
  it('栄養値のそろった商品だけを数量込みで合計する', () => {
    const items: BatchItem[] = [
      ready('a', onigiri, 2),
      ready('b', chicken, 0.5),
      { id: 'c', status: 'missing', quantity: 1, linkBarcode: false },
    ];
    expect(batchTotal(items)).toEqual({
      protein: 20,
      fat: 2.75,
      carbs: 80.25,
      calories: 415,
    });
  });
});
