import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isValidResource, publicOrigin, stringParams } from '@/lib/oauth';
import {
  exchangeAuthorizationCode,
  refreshTokens,
  type TokenResponse,
} from '@/lib/server/oauth';

const tokenRequestSchema = z.discriminatedUnion('grant_type', [
  z.object({
    grant_type: z.literal('authorization_code'),
    code: z.string().min(1),
    client_id: z.string().min(1),
    redirect_uri: z.string().min(1),
    code_verifier: z.string().min(1),
    resource: z.string().optional(),
  }),
  z.object({
    grant_type: z.literal('refresh_token'),
    refresh_token: z.string().min(1),
    client_id: z.string().min(1),
    resource: z.string().optional(),
  }),
]);

const NO_STORE = { 'Cache-Control': 'no-store' };

function oauthError(error: string, status = 400): NextResponse {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

/** OAuth トークンエンドポイント（公開クライアント + PKCE）。 */
export async function POST(request: NextRequest) {
  let params: Record<string, string>;
  try {
    params = stringParams(await request.formData());
  } catch {
    return oauthError('invalid_request');
  }
  if (
    params.grant_type !== 'authorization_code' &&
    params.grant_type !== 'refresh_token'
  ) {
    return oauthError('unsupported_grant_type');
  }
  const parsed = tokenRequestSchema.safeParse(params);
  if (!parsed.success) return oauthError('invalid_request');
  const body = parsed.data;
  if (!isValidResource(body.resource, publicOrigin(request.headers))) {
    return oauthError('invalid_target');
  }

  let tokens: TokenResponse | null;
  try {
    tokens =
      body.grant_type === 'authorization_code'
        ? await exchangeAuthorizationCode({
            code: body.code,
            clientId: body.client_id,
            redirectUri: body.redirect_uri,
            codeVerifier: body.code_verifier,
          })
        : await refreshTokens({
            refreshToken: body.refresh_token,
            clientId: body.client_id,
          });
  } catch (error) {
    console.error('[OAuth トークン発行] unhandled error', error);
    return oauthError('server_error', 500);
  }
  if (!tokens) return oauthError('invalid_grant');
  return NextResponse.json(tokens, { headers: NO_STORE });
}
