import { defineRoute, noContent } from '@/lib/api/handler';
import { settingsSchema } from '@/lib/api/schemas';
import { replaceSettings } from '@/lib/server/settings';

export const PUT = defineRoute(
  { label: '設定の保存', auth: true, body: settingsSchema },
  async (_req, { userId, body }) => {
    await replaceSettings(userId, body);
    return noContent();
  },
);
