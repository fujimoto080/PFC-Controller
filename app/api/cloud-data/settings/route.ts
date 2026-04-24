import { z } from 'zod';
import { saveUserSettings } from '@/lib/cloud-data';
import { createCloudDataRoute } from '@/lib/api/cloud-data-handler';

export const POST = createCloudDataRoute({
  key: 'settings',
  label: '設定',
  schema: z.record(z.string(), z.unknown()),
  save: saveUserSettings,
});
