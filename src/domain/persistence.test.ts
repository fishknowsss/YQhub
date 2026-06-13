import { describe, expect, it } from 'vitest';
import { createInitialState, updateDraft } from './state';
import {
  createMemoryStorage,
  loadWorkspaceState,
  saveWorkspaceState,
  WORKSPACE_STORAGE_KEY
} from './persistence';

describe('workspace persistence', () => {
  it('saves and restores the last local draft with a versioned key', () => {
    const storage = createMemoryStorage();
    const state = updateDraft(createInitialState(), {
      prompt: '一支干净利落的产品视频',
      duration: '～30s',
      resolution: '9:16'
    });

    saveWorkspaceState(storage, state);

    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toContain('一支干净利落的产品视频');
    expect(WORKSPACE_STORAGE_KEY).toBe('yqhub-workspace:v1');
    expect(WORKSPACE_STORAGE_KEY).toMatch(/:v\d+$/);
    expect(loadWorkspaceState(storage)).toMatchObject({
      draft: {
        prompt: '一支干净利落的产品视频',
        duration: '～30s',
        resolution: '9:16'
      }
    });
  });

  it('returns a fresh state when cached data is broken', () => {
    const storage = createMemoryStorage();
    storage.setItem(WORKSPACE_STORAGE_KEY, '{broken');

    const state = loadWorkspaceState(storage);

    expect(state).toEqual(createInitialState());
  });

  it('loads the previous yq workspace key during brand migration', () => {
    const storage = createMemoryStorage();
    const state = updateDraft(createInitialState(), {
      prompt: '旧缓存里的提示词'
    });

    storage.setItem('yq-workspace:v1', JSON.stringify(state));

    expect(loadWorkspaceState(storage)).toMatchObject({
      draft: {
        prompt: '旧缓存里的提示词'
      }
    });
  });

  it('normalizes stale draft options after the seedance migration', () => {
    const storage = createMemoryStorage();
    const staleState = updateDraft(createInitialState(), {
      model: 'pippit_iv2v_cvtob_master',
      duration: '5s',
      resolution: '1:1'
    });

    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(staleState));

    expect(loadWorkspaceState(storage).draft).toMatchObject({
      model: 'seedance2.0fast',
      duration: '～15s',
      resolution: '16:9'
    });
  });
});
