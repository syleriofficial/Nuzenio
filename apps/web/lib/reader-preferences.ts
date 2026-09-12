'use client';

import { useSyncExternalStore } from 'react';
import {
  createReaderStore,
  INITIAL_READER_STATE,
  READER_KEYS,
} from './reader-state';

const store = createReaderStore(() => window.localStorage);
function subscribe(listener: () => void) {
  const unsubscribe = store.subscribe(listener);
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === null ||
      Object.values(READER_KEYS).some((key) => key === event.key)
    )
      store.refresh();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('focus', store.refresh);
  store.refresh();
  return () => {
    unsubscribe();
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('focus', store.refresh);
  };
}
export function useReaderPreferences() {
  const state = useSyncExternalStore(
    subscribe,
    store.getSnapshot,
    () => INITIAL_READER_STATE,
  );
  return {
    ...state,
    toggle: store.toggle,
    setPersonalized: store.setPersonalized,
  };
}
