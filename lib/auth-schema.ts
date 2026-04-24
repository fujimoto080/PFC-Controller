import 'server-only';

import { getPool } from '@/lib/pg-pool';

let initPromise: Promise<void> | null = null;

const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    email TEXT UNIQUE,
    "emailVerified" TIMESTAMPTZ,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at BIGINT,
    id_token TEXT,
    scope TEXT,
    session_state TEXT,
    token_type TEXT,
    UNIQUE (provider, "providerAccountId")
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires TIMESTAMPTZ NOT NULL,
    "sessionToken" TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS verification_token (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL,
    expires TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (identifier, token)
  );
`;

export function ensureAuthSchema(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const pool = getPool();
      await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
      await pool.query(CREATE_TABLES_SQL);
    })();
  }
  return initPromise;
}
