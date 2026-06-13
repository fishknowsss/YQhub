import { createInitialState } from './state';
import type { WorkspaceState } from './types';

export const WORKSPACE_STORAGE_KEY = 'yq-workspace:v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const storageCache = new WeakMap<StorageLike, Map<string, string | null>>();

export function saveWorkspaceState(storage: StorageLike, state: WorkspaceState): void {
  const value = JSON.stringify(state);

  try {
    storage.setItem(WORKSPACE_STORAGE_KEY, value);
    getStorageCache(storage).set(WORKSPACE_STORAGE_KEY, value);
  } catch {
    getStorageCache(storage).delete(WORKSPACE_STORAGE_KEY);
  }
}

export function loadWorkspaceState(storage: StorageLike): WorkspaceState {
  try {
    const cachedValue = getCachedStorageValue(storage, WORKSPACE_STORAGE_KEY);

    if (!cachedValue) {
      return createInitialState();
    }

    const parsed = JSON.parse(cachedValue) as WorkspaceState;

    if (parsed.version !== 1 || !parsed.draft || !Array.isArray(parsed.accounts)) {
      return createInitialState();
    }

    return parsed;
  } catch {
    return createInitialState();
  }
}

export function clearWorkspaceState(storage: StorageLike): void {
  try {
    storage.removeItem(WORKSPACE_STORAGE_KEY);
  } finally {
    getStorageCache(storage).delete(WORKSPACE_STORAGE_KEY);
  }
}

export function createMemoryStorage(): StorageLike {
  const items = new Map<string, string>();

  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    }
  };
}

function getCachedStorageValue(storage: StorageLike, key: string): string | null {
  const cache = getStorageCache(storage);

  if (!cache.has(key)) {
    cache.set(key, storage.getItem(key));
  }

  return cache.get(key) ?? null;
}

function getStorageCache(storage: StorageLike): Map<string, string | null> {
  const existing = storageCache.get(storage);

  if (existing) {
    return existing;
  }

  const next = new Map<string, string | null>();
  storageCache.set(storage, next);
  return next;
}
