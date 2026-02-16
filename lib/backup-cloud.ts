import 'server-only';

import { Redis } from '@upstash/redis';
import {
  BACKUP_TTL_SECONDS,
  BackupPayload,
  normalizeBackupId,
} from '@/lib/backup';

const BACKUP_KEY_PREFIX = 'backup:temp:';

const redis = Redis.fromEnv();

function buildBackupKey(backupId: string): string {
  return `${BACKUP_KEY_PREFIX}${normalizeBackupId(backupId)}`;
}

function generateBackupId(): string {
  return crypto.randomUUID().replaceAll('-', '');
}

export async function createCloudBackup(
  payload: BackupPayload,
): Promise<{ backupId: string; expiresAt: number }> {
  const backupId = generateBackupId();
  const key = buildBackupKey(backupId);
  const expiresAt = Date.now() + BACKUP_TTL_SECONDS * 1000;

  await redis.set(key, payload, { ex: BACKUP_TTL_SECONDS });

  return { backupId, expiresAt };
}

export async function getCloudBackup(
  backupId: string,
): Promise<BackupPayload | null> {
  const key = buildBackupKey(backupId);
  const payload = await redis.get<BackupPayload>(key);
  return payload ?? null;
}
