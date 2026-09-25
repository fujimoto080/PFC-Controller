/**
 * @jest-environment node
 */
import {
  authorizationResponseUrl,
  checkAuthorizeParams,
  isRegisteredRedirectUri,
  isValidResource,
  publicOrigin,
  verifyPkce,
} from '@/lib/oauth';

const origin = 'https://pfc.example.com';
const verifier = 'dBjftJeZ4CVP-mB92K1uhbHsOnC1S1Dv7n9eM0-cF6s';
const challenge = 'WD77_f6I7hqULQxXENfkxqhKz6L3K9iW2PT-7iL3ah8';

describe('publicOrigin', () => {
  it('転送ヘッダーを優先する', () => {
    const headers = new Headers({
      host: 'internal:3000',
      'x-forwarded-host': 'pfc.example.com',
      'x-forwarded-proto': 'https',
    });
    expect(publicOrigin(headers)).toBe(origin);
  });

  it('転送ヘッダーが無ければ Host を https で使う', () => {
    expect(publicOrigin(new Headers({ host: 'pfc.example.com' }))).toBe(origin);
  });
});

describe('isValidResource', () => {
  it('省略または MCP サーバーの URL なら有効', () => {
    expect(isValidResource(undefined, origin)).toBe(true);
    expect(isValidResource(`${origin}/api/mcp`, origin)).toBe(true);
  });

  it('別のリソースは無効', () => {
    expect(isValidResource('https://evil.example.com/api/mcp', origin)).toBe(
      false,
    );
  });
});

describe('isRegisteredRedirectUri', () => {
  const registered = [
    'https://chatgpt.com/connector_platform_oauth_redirect',
    'http://127.0.0.1/callback',
    'http://localhost/callback',
  ];

  it('完全一致なら登録済み', () => {
    expect(
      isRegisteredRedirectUri(
        'https://chatgpt.com/connector_platform_oauth_redirect',
        registered,
      ),
    ).toBe(true);
  });

  it('ループバックはポートが違っても登録済み', () => {
    expect(
      isRegisteredRedirectUri('http://127.0.0.1:54321/callback', registered),
    ).toBe(true);
    expect(
      isRegisteredRedirectUri('http://localhost:8080/callback', registered),
    ).toBe(true);
  });

  it('ループバックでもパスが違えば未登録', () => {
    expect(
      isRegisteredRedirectUri('http://127.0.0.1:54321/other', registered),
    ).toBe(false);
  });

  it('ループバック以外はポート違いを許さない', () => {
    expect(
      isRegisteredRedirectUri(
        'https://chatgpt.com:8443/connector_platform_oauth_redirect',
        registered,
      ),
    ).toBe(false);
  });
});

describe('checkAuthorizeParams', () => {
  const valid = {
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    resource: `${origin}/api/mcp`,
  };

  it('正しいパラメータなら code_challenge を返す', () => {
    expect(checkAuthorizeParams(valid, origin)).toEqual({
      codeChallenge: challenge,
    });
  });

  it('response_type が code 以外', () => {
    expect(
      checkAuthorizeParams({ ...valid, response_type: 'token' }, origin),
    ).toEqual({ error: 'unsupported_response_type' });
  });

  it('PKCE が S256 でない', () => {
    expect(
      checkAuthorizeParams(
        { ...valid, code_challenge_method: 'plain' },
        origin,
      ),
    ).toEqual({ error: 'invalid_request' });
  });

  it('code_challenge が無い', () => {
    const { code_challenge: _, ...rest } = valid;
    expect(checkAuthorizeParams(rest, origin)).toEqual({
      error: 'invalid_request',
    });
  });

  it('resource が別サーバー', () => {
    expect(
      checkAuthorizeParams(
        { ...valid, resource: 'https://other.example.com/mcp' },
        origin,
      ),
    ).toEqual({ error: 'invalid_target' });
  });
});

describe('authorizationResponseUrl', () => {
  it('既存クエリを保ったまま結果と iss を付け、undefined は省く', () => {
    const url = new URL(
      authorizationResponseUrl('https://client.example.com/cb?x=1', origin, {
        code: 'abc',
        state: undefined,
      }),
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      x: '1',
      code: 'abc',
      iss: origin,
    });
  });
});

describe('verifyPkce', () => {
  it('一致する verifier を受け付ける', () => {
    expect(verifyPkce(verifier, challenge)).toBe(true);
  });

  it('一致しない verifier を拒否する', () => {
    expect(verifyPkce(`${verifier.slice(0, -1)}x`, challenge)).toBe(false);
  });

  it('形式が不正な verifier を拒否する', () => {
    expect(verifyPkce('short', challenge)).toBe(false);
  });
});
