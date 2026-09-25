import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import type { NextRequest } from 'next/server';
import { PROTECTED_RESOURCE_METADATA_PATH, publicOrigin } from '@/lib/oauth';
import { registerMealPlanningTools } from '@/lib/server/mcp-tools';
import { verifyAccessToken } from '@/lib/server/oauth';

const mcpHandler = createMcpHandler(registerMealPlanningTools, {
  serverInfo: { name: 'pfc-balance', version: '1.0.0' },
  instructions:
    'PFC Balance（食事記録アプリ）のデータを読み取って目標 PFC とカロリーに収まる献立を提案し、食べた物や運動を記録するためのツール群です。',
});

async function verifyToken(_request: Request, bearerToken?: string) {
  if (!bearerToken) return undefined;
  const info = await verifyAccessToken(bearerToken);
  if (!info) return undefined;
  return {
    token: bearerToken,
    clientId: info.clientId,
    scopes: [],
    expiresAt: info.expiresAt,
    extra: { userId: info.userId },
  };
}

function handler(request: NextRequest) {
  return withMcpAuth(mcpHandler, verifyToken, {
    required: true,
    resourceMetadataPath: PROTECTED_RESOURCE_METADATA_PATH,
    resourceUrl: publicOrigin(request.headers),
  })(request);
}

export { handler as GET, handler as POST };
