import 'server-only';

import { getCloudDataStore } from '@/lib/persistent-store';

export const getDb = getCloudDataStore;
