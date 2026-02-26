export interface ExternalIntakeLog {
  id: string;
  name: string;
  protein: number;
  fat: number;
  carbs: number;
  calories: number;
  store?: string;
  source?: string;
  consumedAt: number;
  createdAt: number;
}

export interface ExternalIntakeInput {
  name?: unknown;
  protein?: unknown;
  fat?: unknown;
  carbs?: unknown;
  calories?: unknown;
  store?: unknown;
  source?: unknown;
  consumedAt?: unknown;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

const toNonNegativeNumber = (value: unknown): number => {
  const numeric = typeof value === 'string' && value.trim() === '' ? Number.NaN : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return round1(numeric);
};

const toOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const toTimestamp = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return Date.now();
};

export function normalizeExternalIntakeInput(input: ExternalIntakeInput): Omit<ExternalIntakeLog, 'id' | 'createdAt'> {
  return {
    name: (typeof input.name === 'string' ? input.name : '').trim() || '名称未設定',
    protein: toNonNegativeNumber(input.protein),
    fat: toNonNegativeNumber(input.fat),
    carbs: toNonNegativeNumber(input.carbs),
    calories: toNonNegativeNumber(input.calories),
    store: toOptionalText(input.store),
    source: toOptionalText(input.source),
    consumedAt: toTimestamp(input.consumedAt),
  };
}

export function isExternalIntakeInput(value: unknown): value is ExternalIntakeInput {
  return !!value && typeof value === 'object';
}
