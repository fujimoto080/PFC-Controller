import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { ZodError, ZodType } from 'zod';
import { auth } from '@/auth';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RouteOptions<TBody, TParams, TAuth extends boolean> {
  label: string;
  /** false のときセッション認証を行わない（独自トークン認証のエンドポイント用）。 */
  auth: TAuth;
  body?: ZodType<TBody>;
  params?: ZodType<TParams>;
}

type RouteContext<TBody, TParams, TAuth extends boolean> = {
  body: TBody;
  params: TParams;
} & (TAuth extends true ? { userId: string } : unknown);

/**
 * Route Handler の定型（認証・params/body の zod 検証・エラーの JSON 化）をまとめる。
 * 検証に失敗した場合は 400、ApiError はその status、それ以外は 500 を返す。
 */
export function defineRoute<
  TBody = undefined,
  TParams = undefined,
  TAuth extends boolean = true,
>(
  options: RouteOptions<TBody, TParams, TAuth>,
  handler: (
    request: NextRequest,
    ctx: RouteContext<TBody, TParams, TAuth>,
  ) => Promise<NextResponse> | NextResponse,
) {
  return async function route(
    request: NextRequest,
    routeContext: { params: Promise<unknown> },
  ): Promise<NextResponse> {
    try {
      const params = options.params
        ? parse(options.params, await routeContext.params)
        : undefined;

      let userId: string | undefined;
      if (options.auth) {
        const session = await auth();
        userId = session?.user.id;
        if (!userId) throw new ApiError('認証が必要です', 401);
      }

      let body: TBody | undefined;
      if (options.body) {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          throw new ApiError('リクエスト JSON の解析に失敗しました', 400);
        }
        body = parse(options.body, raw);
      }

      return await handler(request, { body, params, userId } as RouteContext<
        TBody,
        TParams,
        TAuth
      >);
    } catch (error) {
      return toErrorResponse(options.label, error);
    }
  };
}

/** 本文なしの成功レスポンス。 */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError(formatZodError(parsed.error), 400);
  return parsed.data;
}

function formatZodError(error: ZodError): string {
  const first = error.issues[0];
  if (!first) return 'リクエストの形式が不正です';
  const path = first.path.join('.');
  return path ? `${path}: ${first.message}` : first.message;
}

function toErrorResponse(label: string, error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }
  console.error(`[${label}] unhandled error`, error);
  return NextResponse.json(
    { error: `${label}の処理に失敗しました` },
    { status: 500 },
  );
}
