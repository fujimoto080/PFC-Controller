/** @jest-environment node */
import { POST } from '@/app/api/mcp/intake/route';
import { saveExternalIntakeLogs } from '@/lib/external-intake-kv';

jest.mock('@/lib/external-intake-kv', () => ({
  saveExternalIntakeLogs: jest.fn(),
  listExternalIntakeLogs: jest.fn(async () => []),
}));

describe('MCP intake route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('register_intake で1件登録できる', async () => {
    const request = new Request('http://localhost:3000/api/mcp/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'register_intake',
          arguments: {
            entry: {
              name: 'テスト食品',
              protein: 20,
              fat: 10,
              carbs: 30,
              calories: 290,
            },
          },
        },
      }),
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(saveExternalIntakeLogs).toHaveBeenCalledTimes(1);
    expect(body.result.content[0].text).toContain('"count":1');
  });

  test('arguments にJSON文字列を渡しても登録できる', async () => {
    const request = new Request('http://localhost:3000/api/mcp/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'register_intake',
          arguments: JSON.stringify({
            entry: {
              name: '文字列引数食品',
              protein: 15,
              fat: 5,
              carbs: 35,
              calories: 245,
            },
          }),
        },
      }),
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(saveExternalIntakeLogs).toHaveBeenCalledTimes(1);
    expect(body.result.content[0].text).toContain('文字列引数食品');
  });
});
