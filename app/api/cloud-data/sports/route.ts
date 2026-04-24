import { saveUserSports } from '@/lib/cloud-data';
import { createCloudDataRoute, isUnknownArray } from '../route-factory';

export const POST = createCloudDataRoute({
  key: 'sports',
  label: 'スポーツ',
  validate: isUnknownArray,
  save: saveUserSports,
});
