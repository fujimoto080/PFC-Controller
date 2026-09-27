import { defineRoute, noContent } from '@/lib/api/handler';
import { pushSubscriptionSchema } from '@/lib/api/schemas';
import { deleteSubscription, saveSubscription } from '@/lib/server/push';

export const POST = defineRoute(
  { label: '通知の購読', auth: true, body: pushSubscriptionSchema },
  async (_req, { userId, body }) => {
    await saveSubscription(userId, body);
    return noContent();
  },
);

export const DELETE = defineRoute(
  {
    label: '通知の購読解除',
    auth: true,
    body: pushSubscriptionSchema.pick({ endpoint: true }),
  },
  async (_req, { userId, body }) => {
    await deleteSubscription(userId, body.endpoint);
    return noContent();
  },
);
