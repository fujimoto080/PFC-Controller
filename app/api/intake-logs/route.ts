import { NextRequest, NextResponse } from 'next/server';
import { listExternalIntakeLogs, saveExternalIntakeLogs } from '@/lib/external-intake-kv';
import {
  ExternalIntakeInput,
  isExternalIntakeInput,
  normalizeExternalIntakeInput,
} from '@/lib/external-intake';

interface CreateExternalIntakeRequest {
  entries?: unknown;
}

function createLogId(): string {
  return crypto.randomUUID().replaceAll('-', '');
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateExternalIntakeRequest;

    if (!Array.isArray(body.entries) || body.entries.length === 0) {
      return NextResponse.json(
        { error: 'entries に1件以上の摂取履歴を指定してください' },
        { status: 400 },
      );
    }

    const invalidEntry = body.entries.find((entry) => !isExternalIntakeInput(entry));
    if (invalidEntry) {
      return NextResponse.json(
        { error: '摂取履歴の形式が不正です' },
        { status: 400 },
      );
    }

    const now = Date.now();
    const normalizedLogs = (body.entries as ExternalIntakeInput[]).map((entry) => {
      const normalized = normalizeExternalIntakeInput(entry);
      return {
        ...normalized,
        id: createLogId(),
        createdAt: now,
      };
    });

    await saveExternalIntakeLogs(normalizedLogs);

    return NextResponse.json({
      message: '摂取履歴を登録しました',
      count: normalizedLogs.length,
      entries: normalizedLogs,
    });
  } catch (error) {
    console.error('Error in POST /api/intake-logs:', error);
    return NextResponse.json(
      { error: '摂取履歴の登録中にエラーが発生しました' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Number(searchParams.get('limit') ?? '50');
    const startAt = Number(searchParams.get('startAt') ?? Number.NEGATIVE_INFINITY);
    const endAt = Number(searchParams.get('endAt') ?? Number.POSITIVE_INFINITY);

    const entries = await listExternalIntakeLogs({ limit, startAt, endAt });

    return NextResponse.json({ entries, count: entries.length });
  } catch (error) {
    console.error('Error in GET /api/intake-logs:', error);
    return NextResponse.json(
      { error: '摂取履歴の取得中にエラーが発生しました' },
      { status: 500 },
    );
  }
}
