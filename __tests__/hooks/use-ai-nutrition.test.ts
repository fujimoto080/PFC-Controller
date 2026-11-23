import { act, renderHook } from '@testing-library/react';
import { useAiNutrition } from '@/hooks/use-ai-nutrition';
import { estimateNutritionFromImages } from '@/lib/client/api';
import { imageToDataUrl } from '@/lib/client/image';

jest.mock('@/lib/client/api', () => ({
  estimateNutrition: jest.fn(),
  estimateNutritionFromImages: jest.fn(),
}));
jest.mock('@/lib/client/image', () => ({ imageToDataUrl: jest.fn() }));
jest.mock('@/lib/toast', () => ({
  toast: { success: jest.fn(), info: jest.fn(), fromError: jest.fn() },
}));

it('別の入口で読み取った写真にも新しい写真を足してまとめて読み取れる', async () => {
  const food = {
    name: 'チキン',
    protein: 25,
    fat: 5,
    carbs: 10,
    calories: 185,
  };
  jest.mocked(imageToDataUrl).mockResolvedValue('data:image/jpeg;base64,new');
  jest.mocked(estimateNutritionFromImages).mockImplementation(
    async (_, options) => {
      options?.onNutrition?.(food);
      return food;
    },
  );
  const onEstimated = jest.fn();
  const { result } = renderHook(() => useAiNutrition(onEstimated));
  await act(async () => {
    await result.current.estimateFromImages(
      [new File(['photo'], 'photo.jpg')],
      ['data:image/jpeg;base64,old'],
    );
  });
  expect(estimateNutritionFromImages).toHaveBeenCalledWith(
    ['data:image/jpeg;base64,old', 'data:image/jpeg;base64,new'],
    expect.objectContaining({ onNutrition: expect.any(Function) }),
  );
  expect(onEstimated).toHaveBeenCalledWith(food, [
    'data:image/jpeg;base64,old',
    'data:image/jpeg;base64,new',
  ]);
});

it('数値を先に反映し、商品名を読み取る間は状態を切り替える', async () => {
  const food = { name: '', protein: 25, fat: 5, carbs: 10, calories: 185 };
  const image = 'data:image/jpeg;base64,new';
  jest.mocked(imageToDataUrl).mockResolvedValue(image);
  const signal = Promise.withResolvers<void>();
  jest.mocked(estimateNutritionFromImages).mockImplementation(
    async (_, options) => {
      options?.onNutrition?.(food);
      options?.onTitlePending?.();
      await signal.promise;
      options?.onTitle?.('チキン');
      return { ...food, name: 'チキン' };
    },
  );
  const onNutrition = jest.fn();
  const onTitle = jest.fn();
  const { result } = renderHook(() => useAiNutrition(onNutrition, onTitle));
  let reading: Promise<boolean> | undefined;
  await act(async () => {
    reading = result.current.estimateFromImages([
      new File(['photo'], 'photo.jpg'),
    ]);
  });
  expect(onNutrition).toHaveBeenCalledWith(food, [image]);
  expect(onTitle).not.toHaveBeenCalled();
  expect(result.current.pending).toBe('title');
  await act(async () => {
    signal.resolve();
    await reading;
  });
  expect(onTitle).toHaveBeenCalledWith('チキン');
  expect(onNutrition).toHaveBeenCalledTimes(1);
  expect(result.current.pending).toBeNull();
});
