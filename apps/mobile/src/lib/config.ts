import { useEffect } from 'react';
import Storage from 'expo-sqlite/kv-store';
import { useConfig, type AppConfig } from '@whyme/data';

const STORAGE_KEY = 'whyme.config';

function savedConfig(): AppConfig | undefined {
  try {
    const value = Storage.getItemSync(STORAGE_KEY);
    return value ? (JSON.parse(value) as AppConfig) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * /config with a device copy: a cold start without internet still has the
 * language list, minimum app version and public flags (docs/01 §5.6).
 */
export function useAppConfig() {
  const query = useConfig({ initialData: savedConfig(), initialDataUpdatedAt: 0 });

  useEffect(() => {
    if (query.isFetchedAfterMount && query.data) {
      Storage.setItemSync(STORAGE_KEY, JSON.stringify(query.data));
    }
  }, [query.isFetchedAfterMount, query.data]);

  return query;
}
