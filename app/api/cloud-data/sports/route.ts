import { z } from 'zod';
import { saveUserSports } from '@/lib/cloud-data';
import { createCloudDataRoute } from '@/lib/api/cloud-data-handler';

export const POST = createCloudDataRoute({
  key: 'sports',
  label: 'スポーツ',
  schema: z.array(z.unknown()),
  save: saveUserSports,
});
