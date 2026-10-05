/** @jest-environment node */
import {
  beginKaloriAuthorization,
  completeKaloriAuthorization,
  disconnectKalori,
  getKaloriAccessToken,
  type PendingAuthorization,
} from '@/lib/server/kalori';

const query = jest.fn<Promise<unknown>, [string, unknown[]?]>();
jest.mock('@/lib/server/db', () => ({ getPool: () => ({ query }) }));
jest.mock('server-only', () => ({}));

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();
global.fetch = fetchMock as unknown as typeof fetch;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const pending: PendingAuthorization = {
  state: 'st',
  verifier: 'ver',
  clientId: 'client-1',
  redirectUri: 'https://pfc.example.com/api/kalori/callback',
};
const callback = { code: 'code-1', state: 'st', iss: 'https://mcp.kalori.jp' };

/** n 回目の fetch に送ったフォーム本文。 */
const formOf = (call: number) =>
  Object.fromEntries(fetchMock.mock.calls[call]?.[1].body as URLSearchParams);

/** n 回目の SQL（文とパラメータ）。 */
const sqlOf = (call: number) => ({
  text: query.mock.calls[call]?.[0] ?? '',
  values: query.mock.calls[call]?.[1] ?? [],
});

beforeEach(() => {
  query.mockReset();
  fetchMock.mockReset();
});

describe('beginKaloriAuthorization', () => {
  it('公開クライアントとして登録し、認可画面の URL と検証用の値を返す', async () => {
    fetchMock.mockResolvedValueOnce(json({ client_id: 'client-1' }));
    const { url, pending: result } = await beginKaloriAuthorization(
      'https://pfc.example.com',
    );

    const registration = JSON.parse(
      fetchMock.mock.calls[0]?.[1].body as string,
    ) as Record<string, unknown>;
    expect(registration).toMatchObject({
      redirect_uris: ['https://pfc.example.com/api/kalori/callback'],
      token_endpoint_auth_method: 'none',
    });
    const params = new URL(url).searchParams;
    expect(params.get('client_id')).toBe('client-1');
    expect(params.get('state')).toBe(result.state);
    expect(result).toMatchObject({
      clientId: 'client-1',
      redirectUri: 'https://pfc.example.com/api/kalori/callback',
    });
  });

  it('登録に失敗したら例外にする', async () => {
    fetchMock.mockResolvedValueOnce(new Response('bad', { status: 400 }));
    await expect(
      beginKaloriAuthorization('https://pfc.example.com'),
    ).rejects.toThrow('クライアント登録に失敗');
  });
});

describe('completeKaloriAuthorization', () => {
  it('認可コードをトークンに替えて保存する', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }),
    );
    await completeKaloriAuthorization('user-1', pending, callback);

    expect(formOf(0)).toEqual({
      grant_type: 'authorization_code',
      code: 'code-1',
      client_id: 'client-1',
      redirect_uri: pending.redirectUri,
      code_verifier: 'ver',
      resource: 'https://mcp.kalori.jp/mcp',
    });
    expect(sqlOf(0).values.slice(0, 4)).toEqual([
      'user-1',
      'client-1',
      'at',
      'rt',
    ]);
  });

  it('state が違えばトークンを取りに行かずに例外にする', async () => {
    await expect(
      completeKaloriAuthorization('user-1', pending, {
        ...callback,
        state: 'other',
      }),
    ).rejects.toThrow('state');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('認可サーバーが違えばトークンを取りに行かずに例外にする', async () => {
    await expect(
      completeKaloriAuthorization('user-1', pending, {
        ...callback,
        iss: 'https://evil.example.com',
      }),
    ).rejects.toThrow('認可サーバー');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('リフレッシュトークンが無ければ保存しない', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ access_token: 'at', expires_in: 3600 }),
    );
    await expect(
      completeKaloriAuthorization('user-1', pending, callback),
    ).rejects.toThrow('リフレッシュトークン');
    expect(query).not.toHaveBeenCalled();
  });
});

describe('getKaloriAccessToken', () => {
  const connection = (expiresInMs: number) => ({
    rows: [
      {
        client_id: 'client-1',
        access_token: 'old',
        refresh_token: 'rt',
        expires_at: new Date(Date.now() + expiresInMs),
      },
    ],
  });

  it('連携していなければ undefined', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(getKaloriAccessToken('user-1')).resolves.toBeUndefined();
  });

  it('期限に余裕があれば保存済みのトークンを返す', async () => {
    query.mockResolvedValueOnce(connection(10 * 60_000));
    await expect(getKaloriAccessToken('user-1')).resolves.toBe('old');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('期限が近ければリフレッシュトークンで取り直して保存する', async () => {
    query.mockResolvedValueOnce(connection(10_000));
    fetchMock.mockResolvedValueOnce(
      json({ access_token: 'new', refresh_token: 'rt2', expires_in: 3600 }),
    );
    await expect(getKaloriAccessToken('user-1')).resolves.toBe('new');
    expect(formOf(0)).toMatchObject({
      grant_type: 'refresh_token',
      refresh_token: 'rt',
      client_id: 'client-1',
    });
    expect(sqlOf(1).values.slice(0, 3)).toEqual(['user-1', 'new', 'rt2']);
  });

  it('リフレッシュトークンが失効していれば連携を消して undefined', async () => {
    query.mockResolvedValueOnce(connection(-1000));
    fetchMock.mockResolvedValueOnce(json({ error: 'invalid_grant' }, 400));
    await expect(getKaloriAccessToken('user-1')).resolves.toBeUndefined();
    expect(sqlOf(1).text).toContain('DELETE FROM kalori_connections');
  });

  it('それ以外の失敗は例外にして連携を残す', async () => {
    query.mockResolvedValueOnce(connection(-1000));
    fetchMock.mockResolvedValueOnce(new Response('down', { status: 503 }));
    await expect(getKaloriAccessToken('user-1')).rejects.toThrow('503');
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe('disconnectKalori', () => {
  it('Kalori 側のトークンを失効させてから連携を消す', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          client_id: 'client-1',
          access_token: 'at',
          refresh_token: 'rt',
          expires_at: new Date(),
        },
      ],
    });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    await disconnectKalori('user-1');
    expect(formOf(0)).toEqual({
      token: 'rt',
      token_type_hint: 'refresh_token',
      client_id: 'client-1',
    });
    expect(sqlOf(1).text).toContain('DELETE FROM kalori_connections');
  });

  it('連携していなければ何もしない', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await disconnectKalori('user-1');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
