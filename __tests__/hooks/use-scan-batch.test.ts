import { act, renderHook } from '@testing-library/react';
import { useScanBatch } from '@/hooks/use-scan-batch';
import { saveFoodRegistration } from '@/lib/client/food-registration';

jest.mock('@/lib/client/food-registration', () => ({
  saveFoodRegistration: jest.fn(),
}));
jest.mock('@/lib/client/api', () => ({
  fetchBarcodeFood: jest.fn(),
  estimateNutritionFromImages: jest.fn(),
}));
jest.mock('@/lib/toast', () => ({
  toast: { success: jest.fn(), fromError: jest.fn() },
}));

const food = {
  name: 'チキン',
  store: 'ローソン',
  protein: 25,
  fat: 5,
  carbs: 10,
  calories: 185,
};
const save = jest.mocked(saveFoodRegistration);

beforeEach(() => {
  localStorage.clear();
  save.mockReset();
  save.mockResolvedValue(true);
});

it('共通フォームで指定した数量・日時・グループ・複数バーコード・保存先を一括保存に渡す', async () => {
  const { result } = renderHook(() => useScanBatch());
  act(() => {
    result.current.addFoods([food]);
  });
  const entry = {
    food: { ...food, storeGroup: 'おかず', timestamp: 123456 },
    quantity: 3,
    barcodes: ['4901', '4902'],
    saveFood: false,
    record: true,
  };
  act(() => {
    const item = result.current.items[0];
    if (!item) throw new Error('商品がありません');
    result.current.setRegistration(item.id, entry);
  });
  await act(async () => {
    expect(await result.current.commit(999999)).toBe(true);
  });
  expect(save).toHaveBeenCalledWith(entry);
  expect(result.current.items).toEqual([]);
});

it('保存できた商品だけ一覧から外し、失敗した商品を再試行できるよう残す', async () => {
  const { result } = renderHook(() => useScanBatch());
  act(() => {
    result.current.addFoods([food, { ...food, name: 'サラダ' }]);
  });
  save.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  await act(async () => {
    expect(await result.current.commit(123456)).toBe(false);
  });
  expect(result.current.items.map((item) => item.food?.name)).toEqual([
    'サラダ',
  ]);
  await act(async () => {
    expect(await result.current.commit(123456)).toBe(true);
  });
  expect(save).toHaveBeenCalledTimes(3);
  expect(result.current.items).toEqual([]);
});

it('一括指定した保存先と日時を編集済みの商品にも反映する', () => {
  const { result } = renderHook(() => useScanBatch());
  act(() => {
    result.current.addFoods([food]);
  });
  act(() => {
    const item = result.current.items[0];
    if (!item) throw new Error('商品がありません');
    result.current.setRegistration(item.id, {
      food: { ...food, timestamp: 1 },
      quantity: 2,
      barcodes: [],
      saveFood: true,
      record: true,
    });
  });
  act(() => {
    result.current.setRecord(false);
    result.current.setTimestamp(123456);
  });
  expect(result.current.items[0]).toEqual(
    expect.objectContaining({ record: false, timestamp: 123456, quantity: 2 }),
  );
});

it('保存中に連打しても同じ商品を二重に保存しない', async () => {
  let finish!: (saved: boolean) => void;
  save.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(() => useScanBatch());
  act(() => {
    result.current.addFoods([food]);
  });
  let pending!: Promise<boolean>;
  act(() => {
    pending = result.current.commit(123456);
  });
  await act(async () => {
    expect(await result.current.commit(123456)).toBe(false);
  });
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish(true);
    await pending;
  });
});
