import { z, type ZodType } from 'zod';
import { NextResponse } from 'next/server';
import { defineDynamicRoute } from '@/lib/api/handler';
import { saveUserResource, type CloudResource } from '@/lib/cloud-data';

// 各リソースの body スキーマとエラーラベル
const resourceConfigs: Record<CloudResource, { schema: ZodType<unknown>; label: string }> = {
  foods: { schema: z.array(z.unknown()), label: '食品辞書' },
  logs: { schema: z.record(z.string(), z.unknown()), label: 'ログ' },
  settings: { schema: z.record(z.string(), z.unknown()), label: '設定' },
  sports: { schema: z.array(z.unknown()), label: 'スポーツ' },
};

const isCloudResource = (value: string): value is CloudResource =>
  Object.prototype.hasOwnProperty.call(resourceConfigs, value);

type Params = { resource: string };
type Body = Record<string, unknown>;

export const POST = defineDynamicRoute<Body, true, Params>(
  {
    label: ({ resource }) =>
      isCloudResource(resource) ? resourceConfigs[resource].label : 'クラウド保存',
    auth: true,
    validateParams: ({ resource }) =>
      isCloudResource(resource) ? true : { status: 404, message: '未対応のリソースです' },
    body: ({ resource }) => {
      // validateParams で弾いた後しか呼ばれない
      const config = resourceConfigs[resource as CloudResource];
      return z.object({ [resource]: config.schema }) as ZodType<Body>;
    },
  },
  async (_req, { userId, body, params }) => {
    const resource = params.resource as CloudResource;
    await saveUserResource(userId, resource, body[resource]);
    return NextResponse.json({ ok: true });
  },
);
