import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { FoodForm } from '@/components/input/FoodForm';
import { EditLogItemDrawer } from '@/components/today/EditLogItemDrawer';
import {
  addFoodItem,
  rememberFood,
  updateFood,
  updateLogItem,
} from '@/lib/client/actions';
import {
  fetchBarcodeFood,
  saveBarcodeMapping,
  searchCatalogFoods,
} from '@/lib/client/api';
import { buildLogItem } from '@/lib/pfc';

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
  useAppState: () => ({ foods: [], logs: {}, foodAliases: {} }),
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
jest.mock('@/components/record/RecordDrawer', () => ({
  RecordDrawer: ({ children }: { children: ReactNode }) => children,
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
  '食事記録に数量 %s と1個分の栄養値を渡す',
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
          protein: 25,
          fat: 5,
          carbs: 10,
          calories: 185,
          quantity: factor,
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

it('同名の候補のうち選んだ食品を保存欄に表示し、保存欄までスクロールする', async () => {
  const other = { ...initial, store: 'セブンイレブン', calories: 200 };
  jest.mocked(searchCatalogFoods).mockResolvedValueOnce({
    source: 'catalog',
    foods: [initial, other],
  });
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = jest.fn().mockReturnValue({ matches: false });
  jest.useFakeTimers();
  try {
    render(<FoodForm initialTimestamp={Date.now()} onDone={jest.fn()} />);
    const name = screen.getByLabelText('食品名');
    fireEvent.change(name, { target: { value: initial.name } });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(400);
    });
    const candidate = screen.getByRole('button', { name: /ローソン/ });
    const scrollIntoView = jest.fn();
    const submitSection = screen
      .getByRole('button', { name: '保存' })
      .closest('.scroll-mb-4');
    Object.defineProperty(submitSection, 'scrollIntoView', {
      value: scrollIntoView,
    });
    fireEvent.click(candidate);
    expect(candidate).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: /セブンイレブン/ }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('ローソン');
    expect(screen.getByLabelText('カロリー')).toHaveValue(185);
    act(() => {
      jest.advanceTimersToNextFrame();
    });
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'end',
      behavior: 'smooth',
    });
    expect(addFoodItem).not.toHaveBeenCalled();
    fireEvent.change(name, { target: { value: '別の食品' } });
    expect(screen.queryByText('選択した食品')).not.toBeInTheDocument();
  } finally {
    jest.useRealTimers();
    window.matchMedia = originalMatchMedia;
  }
});

it('食品リストと食事記録に登録し、店舗・グループ・複数バーコードを保存する', async () => {
  const onDone = jest.fn();
  render(
    <FoodForm
      initial={initial}
      initialTimestamp={Date.now()}
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
  expect(addFoodItem).toHaveBeenCalledWith(
    expect.objectContaining({ protein: 25, quantity: 3 }),
  );
});

it('既存食品を更新し、数量を指定して食事にも記録する', async () => {
  const onDone = jest.fn();
  render(
    <FoodForm
      initial={initial}
      foodId="food-1"
      initialTimestamp={Date.now()}
      onDone={onDone}
    />,
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
    expect.objectContaining({ protein: 25, quantity: 2 }),
  );
  expect(rememberFood).not.toHaveBeenCalled();
});

it('記録を開くと元の数量と1個分の栄養値が表示され、4個から2個に変更できる', async () => {
  const onClose = jest.fn();
  const item = buildLogItem('log-1', {
    ...initial,
    timestamp: Date.now(),
    quantity: 4,
  });
  expect(item.calories).toBe(740);
  render(<EditLogItemDrawer item={item} onClose={onClose} />);
  expect(screen.getByLabelText('数量を指定')).toHaveValue(4);
  expect(screen.getByLabelText('カロリー')).toHaveValue(185);
  fireEvent.click(screen.getByRole('button', { name: '×2' }));
  fireEvent.change(screen.getByLabelText('食べた日付'), {
    target: { value: '2026-10-08' },
  });
  fireEvent.change(screen.getByLabelText('時刻'), {
    target: { value: '12:30' },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => {
    expect(onClose).toHaveBeenCalled();
  });
  expect(updateLogItem).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'log-1',
      timestamp: new Date('2026-10-08T12:30:00+09:00').getTime(),
      quantity: 2,
      calories: 185,
    }),
  );
  expect(addFoodItem).not.toHaveBeenCalled();
  expect(rememberFood).toHaveBeenCalled();
});

it('保存先のチェック項目を表示せず両方に保存する', async () => {
  const onDone = jest.fn();
  render(
    <FoodForm
      initial={initial}
      initialTimestamp={Date.now()}
      onDone={onDone}
    />,
  );
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => {
    expect(onDone).toHaveBeenCalled();
  });
  expect(addFoodItem).toHaveBeenCalled();
  expect(rememberFood).toHaveBeenCalled();
});

it('スキャン一覧への反映では、数量・日時を保持してまだ保存しない', async () => {
  const onSave = jest.fn();
  render(
    <FoodForm
      initial={initial}
      initialTimestamp={1000}
      initialBarcodes={['4901']}
      initialQuantity={3}
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
