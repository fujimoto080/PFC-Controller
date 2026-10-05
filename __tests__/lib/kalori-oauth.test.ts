/** @jest-environment node */
import { createHash } from 'node:crypto';
import {
  createAuthorizationSecrets,
  kaloriAuthorizeUrl,
  kaloriRedirectUri,
} from '@/lib/kalori-oauth';

describe('createAuthorizationSecrets', () => {
  it('challenge は verifier の SHA-256（base64url）で、呼ぶたびに値が変わる', () => {
    const a = createAuthorizationSecrets();
    const b = createAuthorizationSecrets();
    expect(a.challenge).toBe(
      createHash('sha256').update(a.verifier).digest('base64url'),
    );
    expect(a.state).not.toBe(b.state);
    expect(a.verifier).not.toBe(b.verifier);
  });
});

describe('kaloriAuthorizeUrl', () => {
  it('認可コード + PKCE の参照スコープで、MCP リソースを指定する', () => {
    const url = new URL(
      kaloriAuthorizeUrl({
        clientId: 'client-1',
        redirectUri: kaloriRedirectUri('https://pfc.example.com'),
        state: 'st',
        challenge: 'ch',
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://mcp.kalori.jp/authorize',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'client-1',
      redirect_uri: 'https://pfc.example.com/api/kalori/callback',
      scope: 'kalori.read',
      state: 'st',
      resource: 'https://mcp.kalori.jp/mcp',
      code_challenge: 'ch',
      code_challenge_method: 'S256',
    });
  });
});
