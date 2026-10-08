import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FoodForm } from '@/components/input/FoodForm';
import {
  addFoodItem,
  rememberFood,
  updateFood,
  updateLogItem,
} from '@/lib/client/actions';
import { fetchBarcodeFood, saveBarcodeMapping } from '@/lib/client/api';

jest.mock('@/lib/client/actions', () => ({
  addFoodItem: jest.fn(() => Promise.resolve(true)),
  updateFood: jest.fn(() => Promise.resolve(true)),
  updateLogItem: jest.fn(() => Promise.resolve(true)),
  rememberFood: jest.fn(() => Promise.resolve(true)),
}));
jest.mock('@/lib/client/api', () => ({
  saveBarcodeMapping: jest.fn(() => Promise.resolve()),
  fetchBarcodeFood: jest.fn(),
  searchCatalogFoods: jest.fn(() =>
    Promise.resolve({ source: 'catalog', foods: [] }),
  ),
}));
jest.mock('@/lib/client/store', () => ({
  useAppState: () => ({ foods: [], logs: {} }),
}));
jest.mock('@/lib/toast', () => ({
  toast: { success: jest.fn(), fromError: jest.fn(), info: jest.fn() },
}));
jest.mock('@/hooks/use-ai-nutrition', () => ({
  useAiNutrition: () => ({
    text: '',
    setText: jest.fn(),
    pending: null,
    estimate: jest.fn(),
    estimateFromImages: jest.fn(),
  }),
}));
jest.mock('@/components/input/NutritionPhotoButton', () => ({
  NutritionPhotoButton: () => null,
}));

beforeEach(() => {
  global.ResizeObserver = class {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  };
  jest.clearAllMocks();
  localStorage.clear();
});

it.each([0.5, 1, 1.5, 2])(
  '手入力した栄養値を %s 倍で記録し、食品には元の値を保存する',
  async (factor) => {
    const onDone = jest.fn();
    render(
      <FoodForm
        initialTimestamp={new Date('2026-10-05T12:00:00+09:00').getTime()}
        onDone={onDone}
      />,
    );
    fireEvent.change(screen.getByLabelText('食品名'), {
      target: { value: 'サラダ' },
    });
    for (const [label, value] of [
      ['タンパク質', '25'],
      ['脂質', '5'],
      ['炭水化物', '10'],
      ['カロリー', '185'],
    ] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole('button', { name: `×${factor}` }));
    expect(screen.getByRole('button', { name: `×${factor}` })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(addFoodItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => {
      expect(addFoodItem).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'サラダ',
          protein: 25 * factor,
          fat: 5 * factor,
          carbs: 10 * factor,
          calories: 185 * factor,
        }),
      );
    });
    expect(rememberFood).toHaveBeenCalledWith(
      expect.objectContaining({
        protein: 25,
        fat: 5,
        carbs: 10,
        calories: 185,
      }),
    );
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1);
    });
  },
);

it('入力をクリアすると倍率も 1 に戻る', () => {
  render(<FoodForm initialTimestamp={Date.now()} onDone={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '×2' }));
  fireEvent.click(screen.getByRole('button', { name: '入力をクリア' }));
  expect(screen.getByRole('button', { name: '×1' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

const initial = {
  name: 'チキン',
  protein: 25,
  fat: 5,
  carbs: 10,
  calories: 185,
  store: 'ローソン',
};

it('食品リストだけに登録でき、店舗・グループ・複数バーコードを保存する', async () => {
  const onDone = jest.fn();
  render(
    <FoodForm
      initial={initial}
      initialTimestamp={Date.now()}
      defaultRecord={false}
      onDone={onDone}
    />,
  );
  fireEvent.change(screen.getByLabelText('店内グループ (任意)'), {
    target: { value: 'おかず' },
  });
  fireEvent.change(screen.getByLabelText('バーコード (任意・複数可)'), {
    target: { value: '4901, 4902 4901' },
  });
  fireEvent.change(screen.getByLabelText('数量を指定'), {
    target: { value: '3' },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => {
    expect(onDone).toHaveBeenCalled();
  });
  expect(saveBarcodeMapping).toHaveBeenCalledWith(['4901', '4902'], initial);
  expect(rememberFood).toHaveBeenCalledWith(
    expect.objectContaining({ ...initial, storeGroup: 'おかず' }),
  );
  expect(addFoodItem).not.toHaveBeenCalled();
});

it('既存食品を更新し、選択すれば数量を掛けて食事にも記録する', async () => {
  const onDone = jest.fn();
  render(
    <FoodForm
      initial={initial}
      foodId="food-1"
      initialTimestamp={Date.now()}
      defaultRecord={false}
      onDone={onDone}
    />,
  );
  fireEvent.click(
    screen.getByRole('checkbox', { name: '食べた記録にも追加する' }),
  );
  fireEvent.click(screen.getByRole('button', { name: '×2' }));
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => {
    expect(onDone).toHaveBeenCalled();
  });
  expect(updateFood).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'food-1', protein: 25 }),
  );
  expect(addFoodItem).toHaveBeenCalledWith(
    expect.objectContaining({ protein: 50 }),
  );
  expect(rememberFood).not.toHaveBeenCalled();
});

it('既存記録を更新し、新しい食事記録を重複追加しない', async () => {
  const onDone = jest.fn();
  render(
    <FoodForm
      initial={initial}
      logId="log-1"
      initialTimestamp={Date.now()}
      defaultSaveFood={false}
      onDone={onDone}
    />,
  );
  fireEvent.change(screen.getByLabelText('食べた日付'), {
    target: { value: '2026-10-08' },
  });
  fireEvent.change(screen.getByLabelText('時刻'), {
    target: { value: '12:30' },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => {
    expect(onDone).toHaveBeenCalled();
  });
  expect(updateLogItem).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'log-1',
      timestamp: new Date('2026-10-08T12:30:00+09:00').getTime(),
    }),
  );
  expect(addFoodItem).not.toHaveBeenCalled();
  expect(rememberFood).not.toHaveBeenCalled();
});

it('食事記録のみ保存する指定を尊重する', async () => {
  const onDone = jest.fn();
  render(
    <FoodForm
      initial={initial}
      initialTimestamp={Date.now()}
      onDone={onDone}
    />,
  );
  fireEvent.click(
    screen.getByRole('checkbox', { name: '食品リストに登録する' }),
  );
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => {
    expect(onDone).toHaveBeenCalled();
  });
  expect(addFoodItem).toHaveBeenCalled();
  expect(rememberFood).not.toHaveBeenCalled();
});

it('スキャン一覧への反映では、数量・日時・保存先を保持してまだ保存しない', async () => {
  const onSave = jest.fn();
  render(
    <FoodForm
      initial={initial}
      initialTimestamp={1000}
      initialBarcodes={['4901']}
      initialQuantity={3}
      defaultRecord={false}
      onSave={onSave}
      onDone={jest.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '決定' }));
  await waitFor(() => {
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 3,
        barcodes: ['4901'],
        saveFood: true,
        record: false,
      }),
    );
  });
  expect(addFoodItem).not.toHaveBeenCalled();
  expect(saveBarcodeMapping).not.toHaveBeenCalled();
});

it('保存に失敗したらフォームを閉じず、入力内容を残す', async () => {
  jest.mocked(addFoodItem).mockResolvedValueOnce(false);
  const onDone = jest.fn();
  render(
    <FoodForm
      initial={initial}
      initialTimestamp={Date.now()}
      onDone={onDone}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => {
    expect(addFoodItem).toHaveBeenCalled();
  });
  expect(onDone).not.toHaveBeenCalled();
  expect(screen.getByLabelText('食品名')).toHaveValue(initial.name);
});

it('バーコードを照会し、登録済みの商品をフォームに入れる', async () => {
  jest.mocked(fetchBarcodeFood).mockResolvedValueOnce(initial);
  render(<FoodForm initialTimestamp={Date.now()} onDone={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('バーコード (任意・複数可)'), {
    target: { value: '4901' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: '最後のバーコードから商品を検索' }),
  );
  await waitFor(() => {
    expect(screen.getByLabelText('食品名')).toHaveValue('チキン');
  });
  expect(fetchBarcodeFood).toHaveBeenCalledWith('4901');
});
