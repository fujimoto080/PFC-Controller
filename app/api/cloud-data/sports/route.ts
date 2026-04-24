import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'sports は /insert または /update エンドポイントを利用してください' },
    { status: 400 },
  );
}
