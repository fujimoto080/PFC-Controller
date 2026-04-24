import { z } from 'zod';
import { saveUserFoods } from '@/lib/cloud-data';
import { createCloudDataRoute } from '@/lib/api/cloud-data-handler';

export const POST = createCloudDataRoute({
  key: 'foods',
  label: '食品辞書',
  schema: z.array(z.unknown()),
  save: saveUserFoods,
});
