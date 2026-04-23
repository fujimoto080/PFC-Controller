export interface CloudDataPayload {
  version: 1;
  createdAt: number;
  logs: Record<string, unknown>;
  settings: Record<string, unknown>;
  foods: unknown[];
  sports?: unknown[];
}

export function isCloudDataPayload(value: unknown): value is CloudDataPayload {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;

  return (
    data.version === 1 &&
    typeof data.createdAt === 'number' &&
    Number.isFinite(data.createdAt) &&
    !!data.logs &&
    typeof data.logs === 'object' &&
    !!data.settings &&
    typeof data.settings === 'object' &&
    Array.isArray(data.foods) &&
    (data.sports === undefined || Array.isArray(data.sports))
  );
}

export function hasMeaningfulCloudData(payload: CloudDataPayload): boolean {
  return (
    Object.keys(payload.logs).length > 0 ||
    payload.foods.length > 0 ||
    (payload.sports?.length ?? 0) > 0
  );
}
