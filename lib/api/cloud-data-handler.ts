import 'server-only';
import { NextResponse } from 'next/server';
import { z, type ZodType } from 'zod';
import { defineRoute } from './handler';

interface CloudDataRouteConfig<T> {
  key: string;
  label: string;
  schema: ZodType<T>;
  save: (userId: string, value: T) => Promise<void>;
}

export function createCloudDataRoute<T>({ key, label, schema, save }: CloudDataRouteConfig<T>) {
  const bodySchema = z.object({ [key]: schema }) as ZodType<Record<string, T>>;

  return defineRoute(
    { label, auth: true, body: bodySchema },
    async (_req, { userId, body }) => {
      await save(userId, body[key]);
      return NextResponse.json({ ok: true });
    },
  );
}
