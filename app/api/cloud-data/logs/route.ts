import { z } from 'zod';
import { saveUserLogs } from '@/lib/cloud-data';
import { createCloudDataRoute } from '@/lib/api/cloud-data-handler';

export const POST = createCloudDataRoute({
  key: 'logs',
  label: 'ログ',
  schema: z.record(z.string(), z.unknown()),
  save: saveUserLogs,
});
