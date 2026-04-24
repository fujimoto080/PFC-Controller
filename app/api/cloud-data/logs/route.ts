import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'logs は /insert または /update エンドポイントを利用してください' },
    { status: 400 },
  );
}
