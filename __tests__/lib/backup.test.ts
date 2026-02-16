import {
  createQrCodeUrl,
  isBackupPayload,
  normalizeBackupId,
} from '@/lib/backup';

describe('backup helper', () => {
  test('isBackupPayload が正しい形式を判定する', () => {
    const valid = {
      version: 1,
      createdAt: Date.now(),
      logs: {},
      settings: {
        targetPFC: { protein: 100, fat: 60, carbs: 250, calories: 2000 },
      },
      foods: [],
    };

    expect(isBackupPayload(valid)).toBe(true);
    expect(isBackupPayload({ ...valid, version: 2 })).toBe(false);
    expect(isBackupPayload({ ...valid, foods: {} })).toBe(false);
  });

  test('normalizeBackupId は前後空白を除去する', () => {
    expect(normalizeBackupId('  abc123  ')).toBe('abc123');
  });

  test('createQrCodeUrl はエンコードされたURLを生成する', () => {
    const url = createQrCodeUrl('https://example.com/backup?id=abc 123');
    expect(url).toContain('api.qrserver.com');
    expect(url).toContain(
      encodeURIComponent('https://example.com/backup?id=abc 123'),
    );
  });
});
