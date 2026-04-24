import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
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

export interface AuthContext {
  userId: string;
}

type RouteHandler<C> = (request: NextRequest, ctx: C) => Promise<NextResponse> | NextResponse;

interface RouteOptions<TBody, TRequireAuth extends boolean> {
  label: string;
  auth?: TRequireAuth;
  body?: ZodType<TBody>;
}

type HandlerContext<TBody, TRequireAuth extends boolean> = (TRequireAuth extends true
  ? AuthContext
  : Record<string, never>) &
  (TBody extends undefined ? Record<string, never> : { body: TBody });

export function defineRoute<TBody = undefined, TRequireAuth extends boolean = false>(
  options: RouteOptions<TBody, TRequireAuth>,
  handler: RouteHandler<HandlerContext<TBody, TRequireAuth>>,
) {
  return async function route(request: NextRequest) {
    try {
      const ctx = {} as HandlerContext<TBody, TRequireAuth>;

      if (options.auth) {
        const session = await auth();
        if (!session?.user?.id) {
          throw new ApiError('認証が必要です', 401);
        }
        (ctx as AuthContext).userId = session.user.id;
      }

      if (options.body) {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          throw new ApiError('リクエスト JSON の解析に失敗しました', 400);
        }
        const parsed = options.body.safeParse(raw);
        if (!parsed.success) {
          throw new ApiError(formatZodError(parsed.error), 400);
        }
        (ctx as { body: TBody }).body = parsed.data;
      }

      return await handler(request, ctx);
    } catch (error) {
      return toErrorResponse(options.label, error);
    }
  };
}

function formatZodError(error: ZodError): string {
  const first = error.issues[0];
  if (!first) return 'リクエストの形式が不正です';
  const path = first.path.join('.');
  return path ? `${path}: ${first.message}` : first.message;
}

function toErrorResponse(label: string, error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(`[${label}] unhandled error`, error);
  return NextResponse.json({ error: `${label}の処理に失敗しました` }, { status: 500 });
}
