import { act, renderHook } from '@testing-library/react';
import { useScanBatch } from '@/hooks/use-scan-batch';
import { api } from '@/lib/client/api';
import { buildLogItem } from '@/lib/pfc';
import type { SavedScanEntry, ScanSaveEntry } from '@/lib/scan-batch';

jest.mock('@/lib/client/actions', () => ({
  applySavedScanEntries: jest.fn(),
}));
jest.mock('@/lib/client/api', () => ({
  api: { post: jest.fn() },
  fetchBarcodeFood: jest.fn(),
  estimateNutritionFromImages: jest.fn(),
}));
jest.mock('@/lib/toast', () => ({
  toast: { success: jest.fn(), error: jest.fn(), fromError: jest.fn() },
}));

const food = {
  name: 'チキン',
  store: 'ローソン',
  protein: 25,
  fat: 5,
  carbs: 10,
  calories: 185,
};
const save = jest.mocked(api.post<SavedScanEntry[]>);
const savedEntries = (entries: ScanSaveEntry[]) =>
  entries.map(({ id, input }) => ({ item: buildLogItem(id, input) }));

beforeEach(() => {
  localStorage.clear();
  save.mockReset();
  save.mockImplementation((_url, entries) =>
    Promise.resolve(savedEntries(entries as ScanSaveEntry[])),
  );
});

it('共通フォームで指定した数量・日時・グループ・複数バーコードを一括保存に渡す', async () => {
  const { result } = renderHook(() => useScanBatch());
  act(() => {
    result.current.addFoods([food]);
  });
  const entry = {
    food: { ...food, storeGroup: 'おかず', timestamp: 123456 },
    quantity: 3,
    barcodes: ['4901', '4902'],
  };
  act(() => {
    const item = result.current.items[0];
    if (!item) throw new Error('商品がありません');
    result.current.setRegistration(item.id, entry);
  });
  const id = result.current.items[0]?.id;
  await act(async () => {
    expect(await result.current.commit(999999)).toBe(true);
  });
  expect(save).toHaveBeenCalledWith('/api/log-items/batch', [
    {
      id,
      input: { ...entry.food, quantity: entry.quantity },
      barcodes: entry.barcodes,
    },
  ]);
  expect(result.current.items).toEqual([]);
});

it('保存できた商品だけ一覧から外し、失敗した商品を再試行できるよう残す', async () => {
  const { result } = renderHook(() => useScanBatch());
  act(() => {
    result.current.addFoods([food, { ...food, name: 'サラダ' }]);
  });
  save.mockImplementationOnce((_url, entries) =>
    Promise.resolve(savedEntries((entries as ScanSaveEntry[]).slice(0, 1))),
  );
  await act(async () => {
    expect(await result.current.commit(123456)).toBe(false);
  });
  expect(result.current.items.map((item) => item.food?.name)).toEqual([
    'サラダ',
  ]);
  await act(async () => {
    expect(await result.current.commit(123456)).toBe(true);
  });
  expect(save).toHaveBeenCalledTimes(2);
  const retry = save.mock.lastCall?.[1] as ScanSaveEntry[];
  expect(retry).toHaveLength(1);
  expect(retry[0]?.input.name).toBe('サラダ');
  expect(result.current.items).toEqual([]);
});

it('一括指定した日時を編集済みの商品にも反映する', () => {
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
    });
  });
  act(() => {
    result.current.setTimestamp(123456);
  });
  expect(result.current.items[0]).toEqual(
    expect.objectContaining({ timestamp: 123456, quantity: 2 }),
  );
});

it('保存中に連打しても同じ商品を二重に保存しない', async () => {
  let finish!: () => void;
  save.mockImplementationOnce(
    (_url, entries) =>
      new Promise((resolve) => {
        finish = () => {
          resolve(savedEntries(entries as ScanSaveEntry[]));
        };
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
    finish();
    await pending;
  });
});
