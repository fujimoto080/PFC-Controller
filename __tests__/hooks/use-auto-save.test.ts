import { act, renderHook } from '@testing-library/react';
import { useAutoSave } from '@/hooks/use-auto-save';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

function setup(initial: { value: number; canSave?: boolean }) {
  const save = jest.fn((_value: number) => Promise.resolve(true));
  const hook = renderHook(
    ({ value, canSave }) => useAutoSave(value, save, canSave),
    { initialProps: initial },
  );
  return { save, ...hook };
}

describe('useAutoSave', () => {
  it('マウント時の値は保存しない', () => {
    const { save, result } = setup({ value: 1 });
    act(() => {
      jest.runAllTimers();
    });
    expect(save).not.toHaveBeenCalled();
    expect(result.current).toBe('idle');
  });

  it('入力が止まってから最後の値を 1 回だけ保存する', async () => {
    const { save, result, rerender } = setup({ value: 1 });
    rerender({ value: 2 });
    rerender({ value: 3 });
    expect(result.current).toBe('saving');
    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(3);
    expect(result.current).toBe('saved');
  });

  it('canSave が false の間は保存しない', () => {
    const { save, result, rerender } = setup({ value: 1, canSave: true });
    rerender({ value: 0, canSave: false });
    act(() => {
      jest.runAllTimers();
    });
    expect(save).not.toHaveBeenCalled();
    expect(result.current).toBe('invalid');
  });

  it('画面を離れるときは待たずに保存する', () => {
    const { save, rerender, unmount } = setup({ value: 1 });
    rerender({ value: 2 });
    unmount();
    expect(save).toHaveBeenCalledWith(2);
  });
});
