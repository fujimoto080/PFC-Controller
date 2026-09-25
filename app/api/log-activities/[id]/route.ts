import { ApiError, defineRoute, noContent } from '@/lib/api/handler';
import { uuidParamsSchema } from '@/lib/api/schemas';
import { deleteLogActivity } from '@/lib/server/log-activities';

export const DELETE = defineRoute(
  { label: '運動記録の削除', auth: true, params: uuidParamsSchema },
  async (_req, { userId, params }) => {
    if (!(await deleteLogActivity(userId, params.id))) {
      throw new ApiError('対象が見つかりません', 404);
    }
    return noContent();
  },
);
