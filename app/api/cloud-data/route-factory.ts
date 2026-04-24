import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

interface RouteConfig<T> {
  key: string;
  label: string;
  validate: (value: unknown) => value is T;
  save: (userId: string, value: T) => Promise<void>;
}

export function createCloudDataRoute<T>({ key, label, validate, save }: RouteConfig<T>) {
  return async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    try {
      const body = (await request.json()) as Record<string, unknown>;
      const value = body[key];
      if (!validate(value)) {
        return NextResponse.json(
          { error: `${key} の形式が不正です` },
          { status: 400 },
        );
      }

      await save(session.user.id, value);
      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error(`${label}保存エラー`, error);
      return NextResponse.json(
        { error: `${label}の保存に失敗しました` },
        { status: 500 },
      );
    }
  };
}

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const isUnknownArray = (value: unknown): value is unknown[] =>
  Array.isArray(value);
