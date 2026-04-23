import {
  hasMeaningfulCloudData,
  isCloudDataPayload,
} from '@/lib/cloud-payload';

describe('cloud payload helper', () => {
  test('isCloudDataPayload が正しい形式を判定する', () => {
    const valid = {
      version: 1,
      createdAt: Date.now(),
      logs: {},
      settings: {
        targetPFC: { protein: 100, fat: 60, carbs: 250, calories: 2000 },
      },
      foods: [],
    };

    expect(isCloudDataPayload(valid)).toBe(true);
    expect(isCloudDataPayload({ ...valid, version: 2 })).toBe(false);
    expect(isCloudDataPayload({ ...valid, foods: {} })).toBe(false);
  });

  test('hasMeaningfulCloudData は空データを判定できる', () => {
    const base = {
      version: 1 as const,
      createdAt: Date.now(),
      logs: {},
      settings: {},
      foods: [],
      sports: [],
    };

    expect(hasMeaningfulCloudData(base)).toBe(false);
    expect(hasMeaningfulCloudData({ ...base, logs: { '2026-04-23': {} } })).toBe(
      true,
    );
    expect(hasMeaningfulCloudData({ ...base, foods: [{}] })).toBe(true);
    expect(hasMeaningfulCloudData({ ...base, sports: [{}] })).toBe(true);
  });
});
