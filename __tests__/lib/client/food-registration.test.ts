import {
  saveFoodRegistration,
  type FoodRegistration,
} from '@/lib/client/food-registration';
import {
  addFoodItem,
  rememberFood,
  updateFood,
  updateLogItem,
} from '@/lib/client/actions';
import { saveBarcodeMapping } from '@/lib/client/api';

jest.mock('@/lib/client/actions', () => ({
  addFoodItem: jest.fn(),
  rememberFood: jest.fn(),
  updateFood: jest.fn(),
  updateLogItem: jest.fn(),
}));
jest.mock('@/lib/client/api', () => ({ saveBarcodeMapping: jest.fn() }));
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
  saveFood: true,
  record: true,
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(saveBarcodeMapping).mockResolvedValue();
  jest.mocked(rememberFood).mockResolvedValue(true);
  jest.mocked(addFoodItem).mockResolvedValue(true);
  jest.mocked(updateFood).mockResolvedValue(true);
  jest.mocked(updateLogItem).mockResolvedValue(true);
});

it('全入口で食品・バーコードは1個分、食事記録は数量込みで保存する', async () => {
  expect(await saveFoodRegistration(entry)).toBe(true);
  expect(saveBarcodeMapping).toHaveBeenCalledWith(['4901', '4902'], {
    name: 'チキン',
    store: 'ローソン',
    protein: 25,
    fat: 5,
    carbs: 10,
    calories: 185,
  });
  expect(rememberFood).toHaveBeenCalledWith(entry.food);
  expect(addFoodItem).toHaveBeenCalledWith({
    ...entry.food,
    protein: 75,
    fat: 15,
    carbs: 30,
    calories: 555,
  });
});

it('バーコード保存に失敗したら食事の追加まで進まず、再試行で重複しない', async () => {
  jest.mocked(saveBarcodeMapping).mockRejectedValueOnce(new Error('offline'));
  expect(await saveFoodRegistration(entry)).toBe(false);
  expect(rememberFood).not.toHaveBeenCalled();
  expect(addFoodItem).not.toHaveBeenCalled();
  expect(await saveFoodRegistration(entry)).toBe(true);
  expect(addFoodItem).toHaveBeenCalledTimes(1);
});

it('食品の保存に失敗したら食事の追加まで進まない', async () => {
  jest.mocked(rememberFood).mockResolvedValueOnce(false);
  expect(await saveFoodRegistration(entry)).toBe(false);
  expect(addFoodItem).not.toHaveBeenCalled();
});

it('編集対象のIDを更新に使い、新規追加しない', async () => {
  expect(
    await saveFoodRegistration(entry, { foodId: 'food-1', logId: 'log-1' }),
  ).toBe(true);
  expect(updateFood).toHaveBeenCalledWith({ ...entry.food, id: 'food-1' });
  expect(updateLogItem).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'log-1', protein: 75 }),
  );
  expect(addFoodItem).not.toHaveBeenCalled();
  expect(rememberFood).not.toHaveBeenCalled();
});
