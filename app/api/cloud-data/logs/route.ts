import { saveUserLogs } from '@/lib/cloud-data';
import { createCloudDataRoute, isPlainObject } from '../route-factory';

export const POST = createCloudDataRoute({
  key: 'logs',
  label: 'ログ',
  validate: isPlainObject,
  save: saveUserLogs,
});
