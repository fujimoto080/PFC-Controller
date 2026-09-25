import { createHash } from 'node:crypto';
import type { OAuthMetadata } from '@modelcontextprotocol/server';

const MCP_PATH = '/api/mcp';
export const PROTECTED_RESOURCE_METADATA_PATH = `/.well-known/oauth-protected-resource${MCP_PATH}`;

/** 公開オリジン。OAuth の issuer と MCP リソース URL の基点になる。 */
export function publicOrigin(headers: Headers): string {
  const host = (headers.get('x-forwarded-host') ?? headers.get('host'))
    ?.split(',')[0]
    ?.trim();
  if (!host) throw new Error('Host ヘッダーがありません');
  const proto =
    headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? 'https';
  return `${proto}://${host}`;
}

export function mcpResourceUrl(origin: string): string {
  return `${origin}${MCP_PATH}`;
}

/** RFC 8414 Authorization Server Metadata。クライアント登録は CIMD のみ対応する。 */
export function authorizationServerMetadata(origin: string): OAuthMetadata {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  };
}

/** クエリ / フォームの値のうち文字列のものだけを取り出す。 */
export function stringParams(
  entries: Iterable<[string, unknown]>,
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (typeof value === 'string') params[key] = value;
  }
  return params;
}

/** resource パラメータ（RFC 8707）は省略可。指定時はこの MCP サーバーでなければならない。 */
export function isValidResource(
  resource: string | undefined,
  origin: string,
): boolean {
  return resource === undefined || resource === mcpResourceUrl(origin);
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', 'localhost']);

/**
 * redirect_uri が登録済みのものと一致するか。
 * ネイティブアプリのループバック URI は実行時にポートが決まるため、RFC 8252 §7.3 に従いポートを無視して比較する。
 */
export function isRegisteredRedirectUri(
  redirectUri: string,
  registered: readonly string[],
): boolean {
  if (registered.includes(redirectUri)) return true;
  if (!URL.canParse(redirectUri)) return false;
  const requested = new URL(redirectUri);
  if (requested.protocol !== 'http:' || !LOOPBACK_HOSTS.has(requested.hostname))
    return false;
  requested.port = '';
  return registered.includes(requested.toString());
}

const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * クライアントと redirect_uri の検証後に行う認可リクエストの検証。
 * 問題があれば redirect_uri に返す OAuth エラーコードを、なければ検証済みの code_challenge を返す。
 */
export function checkAuthorizeParams(
  params: Record<string, string>,
  origin: string,
): { error: string } | { codeChallenge: string } {
  const { code_challenge: codeChallenge } = params;
  if (params.response_type !== 'code') {
    return { error: 'unsupported_response_type' };
  }
  if (
    params.code_challenge_method !== 'S256' ||
    codeChallenge === undefined ||
    !CODE_CHALLENGE_PATTERN.test(codeChallenge)
  ) {
    return { error: 'invalid_request' };
  }
  if (!isValidResource(params.resource, origin)) {
    return { error: 'invalid_target' };
  }
  return { codeChallenge };
}

/** 認可レスポンスのリダイレクト先。RFC 9207 に従い iss を必ず付ける。 */
export function authorizationResponseUrl(
  redirectUri: string,
  origin: string,
  params: Record<string, string | undefined>,
): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  url.searchParams.set('iss', origin);
  return url.toString();
}

const CODE_VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;

/** PKCE (S256) の code_verifier が code_challenge に一致するか。 */
export function verifyPkce(
  codeVerifier: string,
  codeChallenge: string,
): boolean {
  return (
    CODE_VERIFIER_PATTERN.test(codeVerifier) &&
    createHash('sha256').update(codeVerifier).digest('base64url') ===
      codeChallenge
  );
}
