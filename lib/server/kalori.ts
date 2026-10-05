import 'server-only';

import { z } from 'zod';
import {
  KALORI_ISSUER,
  KALORI_REGISTER_URL,
  KALORI_RESOURCE,
  KALORI_TOKEN_URL,
  createAuthorizationSecrets,
  kaloriAuthorizeUrl,
  kaloriRedirectUri,
} from '@/lib/kalori-oauth';
import { getPool } from '@/lib/server/db';

// Kalori の商品カタログを引くための OAuth 連携。
// アクセストークンは短命なので、連携時に得たリフレッシュトークンを kalori_connections に保存して更新する。

export const KALORI_PENDING_COOKIE = 'kalori_oauth';

/** 認可画面へ送り出してから、コールバックで戻るまで cookie に持つ値。 */
const pendingSchema = z.object({
  state: z.string(),
  verifier: z.string(),
  clientId: z.string(),
  redirectUri: z.string(),
});
export type PendingAuthorization = z.infer<typeof pendingSchema>;

const registrationSchema = z.object({ client_id: z.string() });

const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
});

export const parsePendingAuthorization = (value: string) =>
  pendingSchema.parse(JSON.parse(value));

/**
 * OAuth クライアントを登録（DCR）し、Kalori の認可画面の URL を作る。
 * 返す pending はコールバックの検証に使うので、呼び出し側が cookie に入れる。
 */
export async function beginKaloriAuthorization(origin: string) {
  const redirectUri = kaloriRedirectUri(origin);
  const response = await fetch(KALORI_REGISTER_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'PFC Controller',
      redirect_uris: [redirectUri],
      response_types: ['code'],
      grant_types: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_method: 'none',
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Kalori のクライアント登録に失敗: ${response.status} ${await response.text()}`,
    );
  }
  const { client_id: clientId } = registrationSchema.parse(
    await response.json(),
  );
  const { state, verifier, challenge } = createAuthorizationSecrets();
  return {
    url: kaloriAuthorizeUrl({ clientId, redirectUri, state, challenge }),
    pending: { state, verifier, clientId, redirectUri },
  };
}

type TokenResponse = z.infer<typeof tokenSchema>;

/** トークンエンドポイントへ送る。失効・期限切れ（invalid_grant）なら undefined。 */
async function requestToken(
  params: Record<string, string>,
): Promise<TokenResponse | undefined> {
  const response = await fetch(KALORI_TOKEN_URL, {
    method: 'POST',
    body: new URLSearchParams({ ...params, resource: KALORI_RESOURCE }),
  });
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 400 && text.includes('invalid_grant')) {
      return undefined;
    }
    throw new Error(`Kalori のトークン取得に失敗: ${response.status} ${text}`);
  }
  return tokenSchema.parse(await response.json());
}

const expiresAt = (token: TokenResponse) =>
  new Date(Date.now() + token.expires_in * 1000);

/**
 * コールバックで受け取った認可コードをトークンに替えて保存する。
 * state と iss（認可サーバー）が一致しなければ、別の認可の応答とみなして例外にする。
 */
export async function completeKaloriAuthorization(
  userId: string,
  pending: PendingAuthorization,
  callback: { code: string; state: string; iss: string },
): Promise<void> {
  if (callback.state !== pending.state) {
    throw new Error('state が一致しません');
  }
  if (callback.iss !== KALORI_ISSUER) {
    throw new Error('認可サーバーが一致しません');
  }
  const token = await requestToken({
    grant_type: 'authorization_code',
    code: callback.code,
    client_id: pending.clientId,
    redirect_uri: pending.redirectUri,
    code_verifier: pending.verifier,
  });
  if (!token?.refresh_token) {
    throw new Error('Kalori がリフレッシュトークンを返しませんでした');
  }
  await getPool().query(
    `INSERT INTO kalori_connections (user_id, client_id, access_token, refresh_token, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       client_id = EXCLUDED.client_id, access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token, expires_at = EXCLUDED.expires_at`,
    [
      userId,
      pending.clientId,
      token.access_token,
      token.refresh_token,
      expiresAt(token),
    ],
  );
}

interface KaloriConnection {
  client_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: Date;
}

const getConnection = async (userId: string) =>
  (
    await getPool().query<KaloriConnection>(
      `SELECT client_id, access_token, refresh_token, expires_at
       FROM kalori_connections WHERE user_id = $1`,
      [userId],
    )
  ).rows[0];

const deleteConnection = (userId: string) =>
  getPool().query('DELETE FROM kalori_connections WHERE user_id = $1', [
    userId,
  ]);

/**
 * 有効なアクセストークン。期限が近ければリフレッシュトークンで取り直して保存する。
 * 連携していない、またはリフレッシュトークンが失効していれば連携を消して undefined。
 */
export async function getKaloriAccessToken(
  userId: string,
): Promise<string | undefined> {
  const connection = await getConnection(userId);
  if (!connection) return undefined;
  if (connection.expires_at.getTime() - Date.now() > 60_000) {
    return connection.access_token;
  }
  const token = await requestToken({
    grant_type: 'refresh_token',
    refresh_token: connection.refresh_token,
    client_id: connection.client_id,
  });
  if (!token) {
    await deleteConnection(userId);
    return undefined;
  }
  await getPool().query(
    `UPDATE kalori_connections
     SET access_token = $2, refresh_token = $3, expires_at = $4
     WHERE user_id = $1`,
    [
      userId,
      token.access_token,
      token.refresh_token ?? connection.refresh_token,
      expiresAt(token),
    ],
  );
  return token.access_token;
}

/** 連携中か。失効していれば連携を消してから false を返す。Kalori に繋がらないときは連携中として扱う。 */
export async function isKaloriConnected(userId: string): Promise<boolean> {
  try {
    return (await getKaloriAccessToken(userId)) !== undefined;
  } catch (error) {
    console.error('Kalori の連携状態の確認に失敗', error);
    return true;
  }
}

/** 連携を解除する。Kalori 側のリフレッシュトークンも失効させる。 */
export async function disconnectKalori(userId: string): Promise<void> {
  const connection = await getConnection(userId);
  if (!connection) return;
  await fetch(KALORI_TOKEN_URL, {
    method: 'POST',
    body: new URLSearchParams({
      token: connection.refresh_token,
      token_type_hint: 'refresh_token',
      client_id: connection.client_id,
    }),
  }).catch((error: unknown) => {
    console.error('Kalori のトークンの失効に失敗', error);
  });
  await deleteConnection(userId);
}
