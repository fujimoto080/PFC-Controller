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
  toast: { success: jest.fn(), fromError: jest.fn() },
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
  jest.mocked(estimateNutritionFromImages).mockResolvedValue(food);
  const onEstimated = jest.fn();
  const { result } = renderHook(() => useAiNutrition(onEstimated));
  await act(async () => {
    await result.current.estimateFromImages(
      [new File(['photo'], 'photo.jpg')],
      ['data:image/jpeg;base64,old'],
    );
  });
  expect(estimateNutritionFromImages).toHaveBeenCalledWith([
    'data:image/jpeg;base64,old',
    'data:image/jpeg;base64,new',
  ]);
  expect(onEstimated).toHaveBeenCalledWith(food, [
    'data:image/jpeg;base64,old',
    'data:image/jpeg;base64,new',
  ]);
});
