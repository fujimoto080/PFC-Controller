import { Redis } from '@upstash/redis';

const BACKUP_TTL_SECONDS = 60 * 60 * 24;
const BACKUP_KEY_PREFIX = 'backup:temp:';
const redis = Redis.fromEnv();

function normalizeBackupId(value) {
  return String(value ?? '').trim();
}

function buildBackupKey(backupId) {
  return `${BACKUP_KEY_PREFIX}${normalizeBackupId(backupId)}`;
}

function generateBackupId() {
  return crypto.randomUUID().replaceAll('-', '');
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isBackupPayload(value) {
  if (!isObject(value)) return false;

  const data = value;
  return (
    data.version === 1 &&
    typeof data.createdAt === 'number' &&
    Number.isFinite(data.createdAt) &&
    isObject(data.logs) &&
    isObject(data.settings) &&
    Array.isArray(data.foods) &&
    (data.sports === undefined || Array.isArray(data.sports))
  );
}

async function createCloudBackup(payload) {
  const backupId = generateBackupId();
  const key = buildBackupKey(backupId);
  const expiresAt = Date.now() + BACKUP_TTL_SECONDS * 1000;

  await redis.set(key, payload, { ex: BACKUP_TTL_SECONDS });

  return { backupId, expiresAt };
}

async function getCloudBackup(backupId) {
  const key = buildBackupKey(backupId);
  const payload = await redis.get(key);
  return payload ?? null;
}

const TOOL_DEFINITIONS = [
  {
    name: 'create_temp_backup',
    description:
      '外部クライアントからバックアップデータを投稿して一時バックアップIDを発行します。',
    inputSchema: {
      type: 'object',
      properties: {
        payload: {
          type: 'object',
          description: 'バックアップ本体',
          properties: {
            version: { type: 'number', enum: [1] },
            createdAt: { type: 'number' },
            logs: { type: 'object' },
            settings: { type: 'object' },
            foods: { type: 'array' },
            sports: { type: 'array' },
          },
          required: ['version', 'createdAt', 'logs', 'settings', 'foods'],
          additionalProperties: true,
        },
      },
      required: ['payload'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_temp_backup',
    description: '発行済みバックアップIDから一時バックアップデータを取得します。',
    inputSchema: {
      type: 'object',
      properties: {
        backupId: {
          type: 'string',
          description: 'create_temp_backup が返すバックアップID',
        },
      },
      required: ['backupId'],
      additionalProperties: false,
    },
  },
];

function writeMessage(message) {
  const body = JSON.stringify(message);
  const content = `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
  process.stdout.write(content);
}

function createError(id, code, message, data) {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  };
}

async function handleRequest(request) {
  const { id, method, params } = request;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'pfc-backup-mcp-server',
          version: '1.0.0',
        },
      },
    };
  }

  if (method === 'notifications/initialized') {
    return null;
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: { tools: TOOL_DEFINITIONS },
    };
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments;

    if (toolName === 'create_temp_backup') {
      if (!isObject(args) || !isBackupPayload(args.payload)) {
        return createError(id, -32602, 'payload の形式が不正です');
      }

      const result = await createCloudBackup(args.payload);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
          structuredContent: result,
        },
      };
    }

    if (toolName === 'get_temp_backup') {
      if (!isObject(args) || typeof args.backupId !== 'string') {
        return createError(id, -32602, 'backupId は文字列で指定してください');
      }

      const normalizedBackupId = normalizeBackupId(args.backupId);
      if (!normalizedBackupId) {
        return createError(id, -32602, 'backupId が空です');
      }

      const payload = await getCloudBackup(normalizedBackupId);
      if (!isBackupPayload(payload)) {
        return createError(id, -32004, 'バックアップが見つかりませんでした');
      }

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ payload }),
            },
          ],
          structuredContent: { payload },
        },
      };
    }

    return createError(id, -32601, `未対応のツールです: ${toolName}`);
  }

  return createError(id, -32601, `未対応のメソッドです: ${method}`);
}

let buffer = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', async (chunk) => {
  buffer += chunk;

  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) return;

    const rawHeaders = buffer.slice(0, headerEnd).split('\r\n');
    const contentLengthHeader = rawHeaders.find((line) =>
      line.toLowerCase().startsWith('content-length:'),
    );

    if (!contentLengthHeader) {
      buffer = '';
      return;
    }

    const contentLength = Number(contentLengthHeader.split(':')[1]?.trim());
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + contentLength;

    if (buffer.length < bodyEnd) return;

    const rawBody = buffer.slice(bodyStart, bodyEnd);
    buffer = buffer.slice(bodyEnd);

    let request;
    try {
      request = JSON.parse(rawBody);
    } catch {
      writeMessage(createError(null, -32700, 'JSONの解析に失敗しました'));
      continue;
    }

    try {
      const response = await handleRequest(request);
      if (response) writeMessage(response);
    } catch (error) {
      writeMessage(
        createError(
          request.id ?? null,
          -32603,
          'サーバー内部エラー',
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }
});
