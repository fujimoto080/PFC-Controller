// 異なる映像フレームで同じ形式・値が安定して読めた場合だけ確定する。
export function createBarcodeStability() {
  let candidate = '';
  let count = 0;
  let startedAt = 0;
  let lastAt = 0;

  return (key: string | null, now: number): boolean => {
    if (key === null) {
      candidate = '';
      count = 0;
      return false;
    }
    if (candidate !== key || now - lastAt > 750) {
      candidate = key;
      count = 0;
      startedAt = now;
    }
    lastAt = now;
    count += 1;
    if (count < 3 || now - startedAt < 200) return false;
    candidate = '';
    count = 0;
    return true;
  };
}
