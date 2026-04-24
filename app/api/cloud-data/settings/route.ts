import { saveUserSettings } from '@/lib/cloud-data';
import { createCloudDataRoute, isPlainObject } from '../route-factory';

export const POST = createCloudDataRoute({
  key: 'settings',
  label: '設定',
  validate: isPlainObject,
  save: saveUserSettings,
});
