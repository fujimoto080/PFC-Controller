import { defineRoute, noContent } from '@/lib/api/handler';
import { sportsSchema } from '@/lib/api/schemas';
import { replaceSports } from '@/lib/server/sports';

export const PUT = defineRoute(
  { label: 'スポーツの保存', auth: true, body: sportsSchema },
  async (_req, { userId, body }) => {
    await replaceSports(userId, body);
    return noContent();
  },
);
