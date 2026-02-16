export const BACKUP_TTL_SECONDS = 60 * 60 * 24;

export interface BackupPayload {
  version: 1;
  createdAt: number;
  logs: Record<string, unknown>;
  settings: Record<string, unknown>;
  foods: unknown[];
}

export function isBackupPayload(value: unknown): value is BackupPayload {
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
    Array.isArray(data.foods)
  );
}

export function normalizeBackupId(value: string): string {
  return value.trim();
}

export function createQrCodeUrl(text: string): string {
  const encoded = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encoded}`;
}
