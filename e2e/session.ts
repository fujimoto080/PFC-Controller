import { randomUUID } from 'node:crypto';
import { encode } from 'next-auth/jwt';
import pg from 'pg';
import { E2E_AUTH_SECRET, E2E_DATABASE_URL } from './env.ts';

// http で動かすため __Secure- プレフィックスの無い Cookie 名になる
export const SESSION_COOKIE = 'authjs.session-token';

/**
 * 新しいユーザーを作り、そのユーザーでログイン済みのセッション Cookie の値を発行する。
 * Google ログインを経由せず、アプリと同じ AUTH_SECRET で JWT セッションを発行する。
 * cleanup でユーザーを削除する。
 */
export async function createSession(): Promise<{
  userId: string;
  token: string;
  cleanup: () => Promise<void>;
}> {
  const userId = randomUUID();
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      'INSERT INTO users (id, name, email) VALUES ($1, $2, $3)',
      [userId, 'E2E ユーザー', `${userId}@e2e.test`],
    );
    const token = await encode({
      token: { id: userId, sub: userId },
      secret: E2E_AUTH_SECRET,
      salt: SESSION_COOKIE,
    });
    return {
      userId,
      token,
      cleanup: async () => {
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        await client.end();
      },
    };
  } catch (error) {
    await client.end();
    throw error;
  }
}
