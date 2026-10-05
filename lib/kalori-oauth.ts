import { createHash, randomBytes } from 'node:crypto';

// Kalori（kalori.jp）の MCP サーバーに個人アカウントで接続するための OAuth 2.1（認可コード + PKCE）。
// 仕様: https://kalori.jp/auth.md

export const KALORI_ISSUER = 'https://mcp.kalori.jp';
export const KALORI_RESOURCE = `${KALORI_ISSUER}/mcp`;
const KALORI_AUTHORIZE_URL = `${KALORI_ISSUER}/authorize`;
export const KALORI_TOKEN_URL = `${KALORI_ISSUER}/token`;
export const KALORI_REGISTER_URL = `${KALORI_ISSUER}/register`;

/** 参照のみ。商品カタログの検索にだけ使う。 */
const KALORI_SCOPE = 'kalori.read';

export const kaloriRedirectUri = (origin: string) =>
  `${origin}/api/kalori/callback`;

const randomToken = () => randomBytes(32).toString('base64url');

/** state と PKCE（S256）の組。verifier は認可が終わるまでサーバー側で保管する。 */
export function createAuthorizationSecrets() {
  const verifier = randomToken();
  return {
    state: randomToken(),
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
  };
}

export function kaloriAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const url = new URL(KALORI_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: KALORI_SCOPE,
    state: params.state,
    resource: KALORI_RESOURCE,
    code_challenge: params.challenge,
    code_challenge_method: 'S256',
  }).toString();
  return url.toString();
}
