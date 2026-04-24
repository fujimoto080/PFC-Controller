import { saveUserFoods } from '@/lib/cloud-data';
import { createCloudDataRoute, isUnknownArray } from '../route-factory';

export const POST = createCloudDataRoute({
  key: 'foods',
  label: '食品辞書',
  validate: isUnknownArray,
  save: saveUserFoods,
});
