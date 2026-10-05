import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FoodLogForm } from '@/components/record/FoodLogForm';
import { addFoodItem, rememberFood } from '@/lib/client/actions';

jest.mock('@/lib/client/actions', () => ({
  addFoodItem: jest.fn(),
  rememberFood: jest.fn(() => ({})),
}));
jest.mock('@/lib/client/store', () => ({
  useAppState: () => ({ foods: [], logs: {} }),
}));
jest.mock('@/lib/toast', () => ({
  toast: { success: jest.fn(), fromError: jest.fn() },
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
  jest.clearAllMocks();
  localStorage.clear();
});

it.each([0.5, 1, 1.5, 2])(
  '手入力した栄養値を %s 倍で記録し、食品には元の値を保存する',
  async (factor) => {
    const onDone = jest.fn();
    render(
      <FoodLogForm
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
    fireEvent.click(screen.getByRole('button', { name: '記録する' }));
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
      undefined,
    );
    expect(onDone).toHaveBeenCalledTimes(1);
  },
);

it('入力をクリアすると倍率も 1 に戻る', () => {
  render(<FoodLogForm initialTimestamp={Date.now()} onDone={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '×2' }));
  fireEvent.click(screen.getByRole('button', { name: '入力をクリア' }));
  expect(screen.getByRole('button', { name: '×1' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
