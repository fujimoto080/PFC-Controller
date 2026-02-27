import { NextRequest, NextResponse } from 'next/server';
import {
  ExternalIntakeInput,
  isExternalIntakeInput,
  normalizeExternalIntakeInput,
} from '@/lib/external-intake';
import { listExternalIntakeLogs, saveExternalIntakeLogs } from '@/lib/external-intake-kv';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

const TOOL_REGISTER_INTAKES = 'register_intakes';
const TOOL_LIST_INTAKES = 'list_intakes';

const parseOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const buildResult = (id: string | number | undefined, result: unknown) => ({
  jsonrpc: '2.0' as const,
  id: id ?? null,
  result,
});

const buildError = (id: string | number | undefined, code: number, message: string) => ({
  jsonrpc: '2.0' as const,
  id: id ?? null,
  error: { code, message },
});

const listToolsResult = {
  tools: [
    {
      name: TOOL_REGISTER_INTAKES,
      description: '外部で取得した摂取履歴を一括登録します',
      inputSchema: {
        type: 'object',
        properties: {
          entries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                protein: { type: 'number' },
                fat: { type: 'number' },
                carbs: { type: 'number' },
                calories: { type: 'number' },
                store: { type: 'string' },
                source: { type: 'string' },
                consumedAt: {
                  description: 'UNIXミリ秒またはISO8601文字列',
                  oneOf: [{ type: 'number' }, { type: 'string' }],
                },
              },
            },
            minItems: 1,
          },
        },
        required: ['entries'],
      },
    },
    {
      name: TOOL_LIST_INTAKES,
      description: '登録済み摂取履歴を新しい順で取得します',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
          startAt: { type: 'number', description: 'UNIXミリ秒（下限）' },
          endAt: { type: 'number', description: 'UNIXミリ秒（上限）' },
        },
      },
    },
  ],
};

async function callTool(name: string, args: Record<string, unknown>) {
  if (name === TOOL_REGISTER_INTAKES) {
    const entries = args.entries;
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error('entries に1件以上の摂取履歴を指定してください');
    }

    const invalidEntry = entries.find((entry) => !isExternalIntakeInput(entry));
    if (invalidEntry) {
      throw new Error('摂取履歴の形式が不正です');
    }

    const createdAt = Date.now();
    const normalizedLogs = (entries as ExternalIntakeInput[]).map((entry) => ({
      ...normalizeExternalIntakeInput(entry),
      id: crypto.randomUUID().replaceAll('-', ''),
      createdAt,
    }));

    await saveExternalIntakeLogs(normalizedLogs);
    return { count: normalizedLogs.length, entries: normalizedLogs };
  }

  if (name === TOOL_LIST_INTAKES) {
    const limit = parseOptionalNumber(args.limit) ?? 50;
    const startAt = parseOptionalNumber(args.startAt);
    const endAt = parseOptionalNumber(args.endAt);
    const entries = await listExternalIntakeLogs({ limit, startAt, endAt });
    return { count: entries.length, entries };
  }

  throw new Error(`未対応のツールです: ${name}`);
}

export async function POST(request: NextRequest) {
  let body: JsonRpcRequest;

  try {
    body = (await request.json()) as JsonRpcRequest;
  } catch {
    return NextResponse.json(buildError(undefined, -32700, 'JSONの解析に失敗しました'));
  }

  if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return NextResponse.json(buildError(body?.id, -32600, '不正なJSON-RPCリクエストです'));
  }

  try {
    if (body.method === 'initialize') {
      return NextResponse.json(
        buildResult(body.id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'pfc-intake-mcp-server', version: '1.0.0' },
        }),
      );
    }

    if (body.method === 'tools/list') {
      return NextResponse.json(buildResult(body.id, listToolsResult));
    }

    if (body.method === 'tools/call') {
      const name = body.params?.name;
      if (typeof name !== 'string') {
        return NextResponse.json(buildError(body.id, -32602, 'ツール名が不正です'));
      }

      const args = (body.params?.arguments ?? {}) as Record<string, unknown>;
      const result = await callTool(name, args);
      return NextResponse.json(
        buildResult(body.id, {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        }),
      );
    }

    if (body.method === 'notifications/initialized') {
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json(buildError(body.id, -32601, `未対応のメソッドです: ${body.method}`));
  } catch (error) {
    const message = error instanceof Error ? error.message : '内部エラーが発生しました';
    return NextResponse.json(buildError(body.id, -32000, message));
  }
}
