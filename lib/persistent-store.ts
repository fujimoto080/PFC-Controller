import 'server-only';

import { Pool } from 'pg';
import { BackupPayload } from '@/lib/backup';

interface PersistentData {
  payload: BackupPayload | null;
  updatedAt: number;
}

interface CloudDataStore {
  get(syncKey: string): Promise<PersistentData>;
  set(syncKey: string, payload: BackupPayload, updatedAt: number): Promise<void>;
}

function normalizeSyncKey(syncKey: string): string {
  return syncKey.trim();
}

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL が未設定です');
  }

  return databaseUrl;
}

class PostgresCloudDataStore implements CloudDataStore {
  private readonly pool = new Pool({ connectionString: getDatabaseUrl() });
  private initPromise: Promise<void> | null = null;

  private async ensureTable() {
    if (!this.initPromise) {
      this.initPromise = this.pool
        .query(`
          CREATE TABLE IF NOT EXISTS pfc_cloud_data (
            sync_key TEXT PRIMARY KEY,
            payload JSONB NOT NULL,
            updated_at BIGINT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `)
        .then(() => undefined);
    }

    await this.initPromise;
  }

  async get(syncKey: string): Promise<PersistentData> {
    await this.ensureTable();

    const result = await this.pool.query<{
      payload: BackupPayload;
      updated_at: string | number;
    }>(
      'SELECT payload, updated_at FROM pfc_cloud_data WHERE sync_key = $1 LIMIT 1',
      [normalizeSyncKey(syncKey)],
    );

    const row = result.rows[0];
    if (!row) {
      return { payload: null, updatedAt: 0 };
    }

    const updatedAt = Number(row.updated_at);
    return {
      payload: row.payload,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
    };
  }

  async set(syncKey: string, payload: BackupPayload, updatedAt: number) {
    await this.ensureTable();

    await this.pool.query(
      `
      INSERT INTO pfc_cloud_data (sync_key, payload, updated_at)
      VALUES ($1, $2::jsonb, $3)
      ON CONFLICT (sync_key)
      DO UPDATE SET
        payload = EXCLUDED.payload,
        updated_at = EXCLUDED.updated_at
      `,
      [normalizeSyncKey(syncKey), JSON.stringify(payload), updatedAt],
    );
  }
}

const store = new PostgresCloudDataStore();

export function getCloudDataStore(): CloudDataStore {
  return store;
}
