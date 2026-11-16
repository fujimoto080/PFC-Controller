import {
  saveFoodRegistration,
  type FoodRegistration,
} from '@/lib/client/food-registration';
import {
  addFoodItem,
  applySavedScanEntries,
  hasRememberedFood,
  rememberFood,
  updateFood,
  updateLogItem,
} from '@/lib/client/actions';
import { api, saveBarcodeMapping } from '@/lib/client/api';
import { buildLogItem } from '@/lib/pfc';
import type { SavedScanEntry } from '@/lib/scan-batch';

jest.mock('@/lib/client/actions', () => ({
  addFoodItem: jest.fn(),
  applySavedScanEntries: jest.fn(),
  hasRememberedFood: jest.fn(),
  rememberFood: jest.fn(),
  updateFood: jest.fn(),
  updateLogItem: jest.fn(),
}));
jest.mock('@/lib/client/api', () => ({
  api: { post: jest.fn() },
  saveBarcodeMapping: jest.fn(),
}));
jest.mock('@/lib/toast', () => ({ toast: { fromError: jest.fn() } }));

const entry: FoodRegistration = {
  food: {
    name: 'チキン',
    store: 'ローソン',
    storeGroup: 'おかず',
    protein: 25,
    fat: 5,
    carbs: 10,
    calories: 185,
    timestamp: 1000,
  },
  quantity: 3,
  barcodes: ['4901', '4902'],
};

const target = { id: 'registration-1' };
const input = { ...entry.food, quantity: entry.quantity };
const saved = [{ item: buildLogItem(target.id, input) }];
const post = jest.mocked(api.post<SavedScanEntry[]>);

beforeEach(() => {
  jest.resetAllMocks();
  post.mockResolvedValue(saved);
  jest.mocked(saveBarcodeMapping).mockResolvedValue();
  jest.mocked(rememberFood).mockResolvedValue(true);
  jest.mocked(addFoodItem).mockResolvedValue(true);
  jest.mocked(updateFood).mockResolvedValue(true);
  jest.mocked(updateLogItem).mockResolvedValue(true);
});

it('新規食品の1個分の栄養値と食事の数量・バーコードを一括保存する', async () => {
  expect(await saveFoodRegistration(entry, target)).toBe(true);
  expect(post).toHaveBeenCalledWith('/api/log-items/batch', [
    { id: target.id, input, barcodes: entry.barcodes },
  ]);
  expect(applySavedScanEntries).toHaveBeenCalledWith(saved);
  expect(saveBarcodeMapping).not.toHaveBeenCalled();
  expect(rememberFood).not.toHaveBeenCalled();
  expect(addFoodItem).not.toHaveBeenCalled();
});

it('一括保存で記録が保存されなければ失敗を返し、同じIDで再送する', async () => {
  post.mockResolvedValueOnce([]);
  expect(await saveFoodRegistration(entry, target)).toBe(false);
  expect(await saveFoodRegistration(entry, target)).toBe(true);
  expect(post).toHaveBeenCalledTimes(2);
  expect(post.mock.calls[0]).toEqual(post.mock.calls[1]);
  expect(addFoodItem).not.toHaveBeenCalled();
});

it('既存食品でバーコードの変更がなければ食事記録だけを追加する', async () => {
  jest.mocked(hasRememberedFood).mockReturnValueOnce(true);
  expect(
    await saveFoodRegistration({ ...entry, barcodes: [] }, target),
  ).toBe(true);
  expect(addFoodItem).toHaveBeenCalledWith(input);
  expect(post).not.toHaveBeenCalled();
});

it('編集する食品の保存に失敗したら食事の更新まで進まない', async () => {
  jest.mocked(rememberFood).mockResolvedValueOnce(false);
  expect(
    await saveFoodRegistration(entry, { ...target, logId: 'log-1' }),
  ).toBe(false);
  expect(updateLogItem).not.toHaveBeenCalled();
});

it('編集対象のIDを更新に使い、新規追加しない', async () => {
  expect(
    await saveFoodRegistration(entry, {
      ...target,
      foodId: 'food-1',
      logId: 'log-1',
    }),
  ).toBe(true);
  expect(saveBarcodeMapping).toHaveBeenCalledWith(['4901', '4902'], {
    name: 'チキン',
    store: 'ローソン',
    protein: 25,
    fat: 5,
    carbs: 10,
    calories: 185,
  });
  expect(updateFood).toHaveBeenCalledWith({ ...entry.food, id: 'food-1' });
  expect(updateLogItem).toHaveBeenCalledWith({ ...input, id: 'log-1' });
  expect(addFoodItem).not.toHaveBeenCalled();
  expect(rememberFood).not.toHaveBeenCalled();
});
