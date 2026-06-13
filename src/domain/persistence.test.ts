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
      duration: '10s',
      resolution: '1080p'
    });

    saveWorkspaceState(storage, state);

    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toContain('一支干净利落的产品视频');
    expect(WORKSPACE_STORAGE_KEY).toMatch(/:v\d+$/);
    expect(loadWorkspaceState(storage)).toMatchObject({
      draft: {
        prompt: '一支干净利落的产品视频',
        duration: '10s',
        resolution: '1080p'
      }
    });
  });

  it('returns a fresh state when cached data is broken', () => {
    const storage = createMemoryStorage();
    storage.setItem(WORKSPACE_STORAGE_KEY, '{broken');

    const state = loadWorkspaceState(storage);

    expect(state).toEqual(createInitialState());
  });
});
