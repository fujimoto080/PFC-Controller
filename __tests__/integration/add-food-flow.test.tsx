import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AddFoodForm } from '@/components/input/AddFoodForm';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('framer-motion', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const MotionDiv = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
  >(({ children, ...props }, ref) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  ));

  MotionDiv.displayName = 'MotionDiv';

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: MotionDiv,
    },
  };
});

jest.mock('@/components/BarcodeScanner', () => ({
  BarcodeScanner: () => <div>BarcodeScanner</div>,
}));

jest.mock('@/data/generated_foods.json', () => []);

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    loading: jest.fn(() => 'loading'),
    dismiss: jest.fn(),
  },
}));

describe('データ登録フロー', () => {
  beforeAll(() => {
    global.ResizeObserver = ResizeObserverMock;
  });

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('手動入力で履歴と食品リストに登録できる', async () => {
    const handleSuccess = jest.fn();

    render(<AddFoodForm onSuccess={handleSuccess} />);

    const dateInput = await screen.findByLabelText('食べた日付');
    const timeInput = screen.getByLabelText('時刻');
    const nameInput = screen.getByPlaceholderText('例: ランチセット');
    const storeInput = screen.getByPlaceholderText('例: セブンイレブン');
    const numberInputs = screen.getAllByRole('spinbutton');

    fireEvent.change(dateInput, { target: { value: '2024-01-02' } });
    fireEvent.change(timeInput, { target: { value: '12:34' } });
    fireEvent.change(nameInput, { target: { value: 'テスト食品' } });
    fireEvent.change(numberInputs[0], { target: { value: '10' } });
    fireEvent.change(numberInputs[1], { target: { value: '5' } });
    fireEvent.change(numberInputs[2], { target: { value: '20' } });
    fireEvent.change(numberInputs[3], { target: { value: '200' } });
    fireEvent.change(storeInput, { target: { value: 'テスト店' } });
    fireEvent.click(screen.getByLabelText('入力を食品リストにも保存する'));
    fireEvent.click(screen.getByRole('button', { name: /記録を追加/ }));

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledTimes(1);
    });

    const logs = JSON.parse(localStorage.getItem('pfc_logs') ?? '{}');
    expect(logs['2024-01-02'].items).toHaveLength(1);
    expect(logs['2024-01-02'].items[0]).toMatchObject({
      name: 'テスト食品',
      protein: 10,
      fat: 5,
      carbs: 20,
      calories: 200,
      store: 'テスト店',
    });

    const dictionary = JSON.parse(localStorage.getItem('pfc_food_dictionary') ?? '[]');
    const hasSavedItem = dictionary.some(
      (item: { name?: string }) => item.name === 'テスト食品',
    );
    expect(hasSavedItem).toBe(true);
  });
});
