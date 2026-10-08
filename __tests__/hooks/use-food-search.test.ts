import { act, renderHook, waitFor } from '@testing-library/react';
import { useFoodSearch } from '@/hooks/use-food-search';
import { searchCatalogFoods } from '@/lib/client/api';
import { useAppState } from '@/lib/client/store';
import { createEmptyDailyLog } from '@/lib/types';

jest.mock('@/lib/client/api', () => ({ searchCatalogFoods: jest.fn() }));
jest.mock('@/lib/client/store', () => ({ useAppState: jest.fn() }));
jest.mock('@/lib/toast', () => ({ toast: { fromError: jest.fn() } }));

const food = {
  id: 'food-1',
  name: 'サラダチキン',
  protein: 23,
  fat: 1,
  carbs: 1,
  calories: 120,
  timestamp: 1,
};
const searchCatalog = jest.mocked(searchCatalogFoods);
const appState = jest.mocked(useAppState);

beforeEach(() => {
  jest.useFakeTimers();
  searchCatalog.mockReset();
  appState.mockReturnValue({ foods: [], logs: {} } as unknown as ReturnType<
    typeof useAppState
  >);
});

afterEach(() => {
  jest.useRealTimers();
});

it.each(['foods', 'logs'] as const)(
  '%s に候補があればカタログを検索しない',
  async (source) => {
    appState.mockReturnValue({
      foods: source === 'foods' ? [food] : [],
      logs:
        source === 'logs'
          ? {
              '2026-10-07': {
                ...createEmptyDailyLog('2026-10-07'),
                items: [food],
              },
            }
          : {},
    } as unknown as ReturnType<typeof useAppState>);
    const { result } = renderHook(() => useFoodSearch('チキン'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(400);
    });
    expect(result.current.foods).toEqual([food]);
    expect(result.current.source).toBe('history');
    expect(searchCatalog).not.toHaveBeenCalled();
  },
);

it.each(['catalog', 'kalori'] as const)(
  '過去の候補がなければ %s の候補を返す',
  async (source) => {
    searchCatalog.mockResolvedValue({ source, foods: [food] });
    const { result } = renderHook(() => useFoodSearch('チキン'));
    expect(result.current.loading).toBe(true);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(400);
    });
    await waitFor(() => {
      expect(result.current.foods).toEqual([food]);
    });
    expect(result.current.source).toBe(source);
    expect(searchCatalog).toHaveBeenCalledWith('チキン');
  },
);

it('検索語が変わった後に届いた以前の候補は表示しない', async () => {
  let resolveFirst!: (
    value: Awaited<ReturnType<typeof searchCatalogFoods>>,
  ) => void;
  searchCatalog.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
  );
  searchCatalog.mockResolvedValueOnce({ source: 'kalori', foods: [] });
  const { result, rerender } = renderHook(({ query }) => useFoodSearch(query), {
    initialProps: { query: 'チキン' },
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(400);
  });
  rerender({ query: 'おにぎり' });
  await act(async () => {
    resolveFirst({ source: 'catalog', foods: [food] });
    await Promise.resolve();
  });
  expect(result.current.foods).toEqual([]);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(400);
  });
  expect(result.current.source).toBe('kalori');
  expect(result.current.loading).toBe(false);
});
