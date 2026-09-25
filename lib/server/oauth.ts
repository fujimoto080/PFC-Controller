import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { getPool } from '@/lib/server/db';
import {
  authorizationResponseUrl,
  checkAuthorizeParams,
  isRegisteredRedirectUri,
  verifyPkce,
} from '@/lib/oauth';

const CODE_TTL_SECONDS = 5 * 60;
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60;

interface OAuthClient {
  id: string;
  name: string;
  redirectUris: string[];
}

const clientMetadataSchema = z.object({
  client_id: z.string(),
  client_name: z.string().optional(),
  redirect_uris: z.array(z.url()).min(1),
});

/**
 * Client ID Metadata Document（client_id 自体がメタデータ文書の HTTPS URL）を取得する。
 * 取得・検証できなければ null。
 */
async function fetchClient(clientId: string): Promise<OAuthClient | null> {
  if (!URL.canParse(clientId)) return null;
  const url = new URL(clientId);
  if (url.protocol !== 'https:' || url.hash || url.pathname === '/') {
    return null;
  }
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const parsed = clientMetadataSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.client_id !== clientId) return null;
    return {
      id: clientId,
      name: parsed.data.client_name ?? url.host,
      redirectUris: parsed.data.redirect_uris,
    };
  } catch {
    return null;
  }
}

export interface AuthorizeRequest {
  client: OAuthClient;
  redirectUri: string;
  codeChallenge: string;
  state: string | undefined;
}

export type AuthorizeResolution =
  /** redirect_uri を信頼できないため、リダイレクトせず画面にエラーを出す */
  | { type: 'invalid'; message: string }
  | { type: 'redirect'; url: string }
  | { type: 'ok'; request: AuthorizeRequest };

/** 認可リクエストを検証する。認可画面の表示時と同意送信時の両方で使う。 */
export async function resolveAuthorizeRequest(
  params: Record<string, string>,
  origin: string,
): Promise<AuthorizeResolution> {
  const { client_id: clientId, redirect_uri: redirectUri, state } = params;
  if (!clientId || !redirectUri) {
    return {
      type: 'invalid',
      message: 'client_id と redirect_uri は必須です',
    };
  }
  const client = await fetchClient(clientId);
  if (!client) {
    return {
      type: 'invalid',
      message: 'クライアント情報を取得できませんでした',
    };
  }
  if (!isRegisteredRedirectUri(redirectUri, client.redirectUris)) {
    return { type: 'invalid', message: 'redirect_uri が登録されていません' };
  }

  const checked = checkAuthorizeParams(params, origin);
  if ('error' in checked) {
    return {
      type: 'redirect',
      url: authorizationResponseUrl(redirectUri, origin, {
        error: checked.error,
        state,
      }),
    };
  }
  return {
    type: 'ok',
    request: {
      client,
      redirectUri,
      codeChallenge: checked.codeChallenge,
      state,
    },
  };
}

function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createAuthorizationCode(
  userId: string,
  request: AuthorizeRequest,
): Promise<string> {
  const code = randomToken();
  const pool = getPool();
  await pool.query('DELETE FROM mcp_oauth_codes WHERE expires_at < now()');
  await pool.query(
    `INSERT INTO mcp_oauth_codes
       (code_hash, user_id, client_id, redirect_uri, code_challenge, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + make_interval(secs => $6))`,
    [
      hashToken(code),
      userId,
      request.client.id,
      request.redirectUri,
      request.codeChallenge,
      CODE_TTL_SECONDS,
    ],
  );
  return code;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
}

async function issueTokens(
  userId: string,
  clientId: string,
): Promise<TokenResponse> {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const pool = getPool();
  await pool.query('DELETE FROM mcp_oauth_tokens WHERE expires_at < now()');
  await pool.query(
    `INSERT INTO mcp_oauth_tokens (token_hash, kind, user_id, client_id, expires_at)
     VALUES ($1, 'access', $3, $4, now() + make_interval(secs => $5)),
            ($2, 'refresh', $3, $4, now() + make_interval(secs => $6))`,
    [
      hashToken(accessToken),
      hashToken(refreshToken),
      userId,
      clientId,
      ACCESS_TOKEN_TTL_SECONDS,
      REFRESH_TOKEN_TTL_SECONDS,
    ],
  );
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
  };
}

/** 認可コードをトークンに交換する。コードは一度きり。検証に失敗したら null。 */
export async function exchangeAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResponse | null> {
  const result = await getPool().query<{
    user_id: string;
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
    valid: boolean;
  }>(
    `DELETE FROM mcp_oauth_codes WHERE code_hash = $1
     RETURNING user_id, client_id, redirect_uri, code_challenge, expires_at > now() AS valid`,
    [hashToken(input.code)],
  );
  const row = result.rows[0];
  if (
    !row?.valid ||
    row.client_id !== input.clientId ||
    row.redirect_uri !== input.redirectUri ||
    !verifyPkce(input.codeVerifier, row.code_challenge)
  ) {
    return null;
  }
  return issueTokens(row.user_id, row.client_id);
}

/** リフレッシュトークンをローテーションして新しいトークンを発行する。失敗したら null。 */
export async function refreshTokens(input: {
  refreshToken: string;
  clientId: string;
}): Promise<TokenResponse | null> {
  const result = await getPool().query<{
    user_id: string;
    client_id: string;
    valid: boolean;
  }>(
    `DELETE FROM mcp_oauth_tokens WHERE token_hash = $1 AND kind = 'refresh'
     RETURNING user_id, client_id, expires_at > now() AS valid`,
    [hashToken(input.refreshToken)],
  );
  const row = result.rows[0];
  if (!row?.valid || row.client_id !== input.clientId) return null;
  return issueTokens(row.user_id, row.client_id);
}

export interface AccessTokenInfo {
  userId: string;
  clientId: string;
  /** 秒単位の UNIX 時刻 */
  expiresAt: number;
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenInfo | null> {
  const result = await getPool().query<{
    user_id: string;
    client_id: string;
    expires_at: number;
  }>(
    `SELECT user_id, client_id, extract(epoch FROM expires_at)::float8 AS expires_at
     FROM mcp_oauth_tokens
     WHERE token_hash = $1 AND kind = 'access' AND expires_at > now()`,
    [hashToken(token)],
  );
  const row = result.rows[0];
  return row
    ? {
        userId: row.user_id,
        clientId: row.client_id,
        expiresAt: row.expires_at,
      }
    : null;
}
