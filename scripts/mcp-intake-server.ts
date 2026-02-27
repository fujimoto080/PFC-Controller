import { stdin, stdout } from 'node:process';
import { listExternalIntakeLogs, saveExternalIntakeLogs } from '../lib/external-intake-kv';
import {
  ExternalIntakeInput,
  normalizeExternalIntakeInput,
  isExternalIntakeInput,
} from '../lib/external-intake';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

const SERVER_INFO = {
  name: 'pfc-intake-mcp-server',
  version: '1.0.0',
};

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

const sendMessage = (payload: JsonRpcResponse) => {
  const body = JSON.stringify(payload);
  const header = `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n`;
  stdout.write(header + body);
};

const sendResult = (id: string | number | undefined, result: unknown) => {
  if (id === undefined) return;
  sendMessage({ jsonrpc: '2.0', id, result });
};

const sendError = (id: string | number | undefined, code: number, message: string) => {
  if (id === undefined) return;
  sendMessage({
    jsonrpc: '2.0',
    id,
    error: { code, message },
  });
};

const handleInitialize = (id: string | number | undefined) => {
  sendResult(id, {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
    },
    serverInfo: SERVER_INFO,
  });
};

const handleListTools = (id: string | number | undefined) => {
  sendResult(id, {
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
  });
};

const registerIntakes = async (args: Record<string, unknown> | undefined) => {
  const entries = args?.entries;
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

  return {
    count: normalizedLogs.length,
    entries: normalizedLogs,
  };
};

const listIntakes = async (args: Record<string, unknown> | undefined) => {
  const limit = parseOptionalNumber(args?.limit) ?? 50;
  const startAt = parseOptionalNumber(args?.startAt);
  const endAt = parseOptionalNumber(args?.endAt);

  const entries = await listExternalIntakeLogs({ limit, startAt, endAt });

  return { count: entries.length, entries };
};

const handleCallTool = async (id: string | number | undefined, params?: Record<string, unknown>) => {
  const name = params?.name;
  const args = (params?.arguments ?? {}) as Record<string, unknown>;

  if (typeof name !== 'string') {
    sendError(id, -32602, 'ツール名が不正です');
    return;
  }

  try {
    if (name === TOOL_REGISTER_INTAKES) {
      const result = await registerIntakes(args);
      sendResult(id, {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      });
      return;
    }

    if (name === TOOL_LIST_INTAKES) {
      const result = await listIntakes(args);
      sendResult(id, {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      });
      return;
    }

    sendError(id, -32601, `未対応のツールです: ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : '内部エラーが発生しました';
    sendError(id, -32000, message);
  }
};

const handleRequest = async (request: JsonRpcRequest) => {
  if (!request || request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
    sendError(request?.id, -32600, '不正なJSON-RPCリクエストです');
    return;
  }

  switch (request.method) {
    case 'initialize':
      handleInitialize(request.id);
      return;
    case 'tools/list':
      handleListTools(request.id);
      return;
    case 'tools/call':
      await handleCallTool(request.id, request.params);
      return;
    case 'notifications/initialized':
      return;
    default:
      sendError(request.id, -32601, `未対応のメソッドです: ${request.method}`);
  }
};

let buffer = Buffer.alloc(0);
let contentLength: number | null = null;

stdin.on('data', async (chunk: Buffer) => {
  buffer = Buffer.concat([buffer, chunk]);

  while (true) {
    if (contentLength === null) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const headerText = buffer.slice(0, headerEnd).toString('utf8');
      const contentLengthHeader = headerText
        .split('\r\n')
        .find((line) => line.toLowerCase().startsWith('content-length:'));

      if (!contentLengthHeader) {
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }

      const rawLength = contentLengthHeader.split(':')[1]?.trim();
      const parsedLength = Number(rawLength);
      if (!Number.isFinite(parsedLength) || parsedLength < 0) {
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }

      contentLength = parsedLength;
      buffer = buffer.slice(headerEnd + 4);
    }

    if (contentLength === null || buffer.length < contentLength) break;

    const body = buffer.slice(0, contentLength).toString('utf8');
    buffer = buffer.slice(contentLength);
    contentLength = null;

    try {
      const request = JSON.parse(body) as JsonRpcRequest;
      await handleRequest(request);
    } catch {
      sendError(null, -32700, 'JSONの解析に失敗しました');
    }
  }
});
