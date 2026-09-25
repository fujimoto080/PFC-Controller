import { NextResponse, type NextRequest } from 'next/server';
import { authorizationServerMetadata, publicOrigin } from '@/lib/oauth';

export function GET(request: NextRequest) {
  return NextResponse.json(
    authorizationServerMetadata(publicOrigin(request.headers)),
  );
}
