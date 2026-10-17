import { createBarcodeStability } from '@/lib/barcode-stability';

describe('バーコードの連続一致', () => {
  it('3フレーム以上かつ200ms以上の一致で確定する', () => {
    const scan = createBarcodeStability();
    expect(scan('ean:123', 0)).toBe(false);
    expect(scan('ean:123', 100)).toBe(false);
    expect(scan('ean:123', 200)).toBe(true);
    expect(scan('ean:123', 300)).toBe(false);
  });

  it.each([null, 'ean:456', 'upc:123'])(
    '途中の%sで一致をリセットする',
    (other) => {
      const scan = createBarcodeStability();
      scan('ean:123', 0);
      scan('ean:123', 100);
      scan(other, 150);
      expect(scan('ean:123', 200)).toBe(false);
      expect(scan('ean:123', 300)).toBe(false);
      expect(scan('ean:123', 400)).toBe(true);
    },
  );

  it('速すぎる一致や時間の空いた一致を確定しない', () => {
    const scan = createBarcodeStability();
    scan('ean:123', 0);
    scan('ean:123', 10);
    expect(scan('ean:123', 20)).toBe(false);
    expect(scan('ean:123', 1000)).toBe(false);
    expect(scan('ean:123', 1100)).toBe(false);
    expect(scan('ean:123', 1200)).toBe(true);
  });
});
