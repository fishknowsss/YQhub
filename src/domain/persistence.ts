import { createInitialState } from './state';
import { getDefaultModelCapabilities, isModelId, MODEL_CAPABILITIES } from '../shared/modelCapabilities';
import type { GenerationTask, WorkspaceState } from './types';

export const WORKSPACE_STORAGE_KEY = 'yqhub-workspace:v1';
const LEGACY_WORKSPACE_STORAGE_KEY = 'yq-workspace:v1';

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
    const cachedValue =
      getCachedStorageValue(storage, WORKSPACE_STORAGE_KEY) ??
      getCachedStorageValue(storage, LEGACY_WORKSPACE_STORAGE_KEY);

    if (!cachedValue) {
      return createInitialState();
    }

    const parsed = JSON.parse(cachedValue) as WorkspaceState;

    if (parsed.version !== 1 || !parsed.draft || !Array.isArray(parsed.accounts)) {
      return createInitialState();
    }

    return normalizeWorkspaceState(parsed);
  } catch {
    return createInitialState();
  }
}

export function clearWorkspaceState(storage: StorageLike): void {
  try {
    storage.removeItem(WORKSPACE_STORAGE_KEY);
    storage.removeItem(LEGACY_WORKSPACE_STORAGE_KEY);
  } finally {
    getStorageCache(storage).delete(WORKSPACE_STORAGE_KEY);
    getStorageCache(storage).delete(LEGACY_WORKSPACE_STORAGE_KEY);
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

function normalizeWorkspaceState(state: WorkspaceState): WorkspaceState {
  const defaultModel = getDefaultModelCapabilities();
  const model = isModelId(state.draft.model) ? state.draft.model : defaultModel.model;
  const capabilities = MODEL_CAPABILITIES[model];
  const normalizedModel =
    capabilities.submitMappingStatus === 'known' ? model : defaultModel.model;
  const normalizedCapabilities = MODEL_CAPABILITIES[normalizedModel];
  const durationOptions: string[] = [...normalizedCapabilities.supportedDurations];
  const resolutionOptions: string[] = [...normalizedCapabilities.supportedResolutions];
  const ratioOptions: string[] = [...normalizedCapabilities.supportedRatios];

  return {
    ...state,
    draft: {
      ...state.draft,
      model: normalizedModel,
      duration: durationOptions.includes(state.draft.duration)
        ? state.draft.duration
        : defaultModel.supportedDurations[0],
      resolution: resolutionOptions.includes(state.draft.resolution)
        ? state.draft.resolution
        : defaultModel.supportedResolutions[0],
      ratio: ratioOptions.includes(state.draft.ratio)
        ? state.draft.ratio
        : inferLegacyRatio(state.draft.resolution, defaultModel.supportedRatios[0])
    },
    tasks: state.tasks.map(normalizeCachedTask)
  };
}

function inferLegacyRatio(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  return value.includes(':') ? value : fallback;
}

function normalizeCachedTask(task: GenerationTask): GenerationTask {
  const normalizedTask: GenerationTask = {
    ...task,
    ratio: task.ratio ?? inferLegacyRatio(task.resolution, '16:9'),
    resolution: task.resolution?.includes(':') ? '720p' : task.resolution
  };
  const hasPlaceholderVideoUrl = isPlaceholderVideoUrl(task.videoUrl);
  const hasPlaceholderLocalPath = task.localVideoPath?.startsWith('~/Movies/YQhub/exports/') ?? false;

  if (!hasPlaceholderVideoUrl && !hasPlaceholderLocalPath) {
    return normalizedTask;
  }

  return {
    ...normalizedTask,
    videoUrl: hasPlaceholderVideoUrl ? null : task.videoUrl,
    localVideoPath: hasPlaceholderLocalPath ? null : task.localVideoPath
  };
}

function isPlaceholderVideoUrl(value: string | null): boolean {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === ['example', 'com'].join('.');
  } catch {
    return false;
  }
}
