import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from 'mcp-handler';
import type { NextRequest } from 'next/server';
import { mcpResourceUrl, publicOrigin } from '@/lib/oauth';

/** RFC 9728 Protected Resource Metadata。認可サーバーはこのアプリ自身。 */
export function GET(request: NextRequest) {
  const origin = publicOrigin(request.headers);
  return protectedResourceHandler({
    authServerUrls: [origin],
    resourceUrl: mcpResourceUrl(origin),
  })(request);
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
