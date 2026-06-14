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
      duration: '10',
      resolution: '480p',
      ratio: '9:16'
    });

    saveWorkspaceState(storage, state);

    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toContain('一支干净利落的产品视频');
    expect(WORKSPACE_STORAGE_KEY).toBe('yqhub-workspace:v1');
    expect(WORKSPACE_STORAGE_KEY).toMatch(/:v\d+$/);
    expect(loadWorkspaceState(storage)).toMatchObject({
      draft: {
        prompt: '一支干净利落的产品视频',
        duration: '10',
        resolution: '480p',
        ratio: '9:16'
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
      duration: '40',
      resolution: '1:1'
    });
    delete (staleState.draft as Partial<typeof staleState.draft>).ratio;

    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(staleState));

    expect(loadWorkspaceState(storage).draft).toMatchObject({
      model: 'seedance2.0fast',
      duration: '15',
      resolution: '720p',
      ratio: '1:1'
    });
  });

  it('fills missing draft fields from incompatible cached workspaces', () => {
    const storage = createMemoryStorage();
    const incompatibleState = {
      ...createInitialState(),
      draft: {
        model: 'seedance2.0fast',
        duration: '5',
        resolution: '720p',
        ratio: '16:9'
      }
    };

    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(incompatibleState));

    expect(loadWorkspaceState(storage).draft).toMatchObject({
      prompt: '',
      assets: [],
      model: 'seedance2.0fast'
    });
  });

  it('drops placeholder example.com video links from old cached history', () => {
    const storage = createMemoryStorage();
    const state = {
      ...createInitialState(),
      tasks: [
        {
          id: 'local-task-1',
          accountId: 'account-1',
          prompt: '生成一条茶饮短片',
          finalPrompt: '生成一条茶饮短片',
          assets: [],
          duration: '5',
          resolution: '720p',
          ratio: '16:9',
          model: 'seedance2.0fast',
          status: 'done' as const,
          progress: 100,
          etaSeconds: 0,
          apiTaskId: 'remote-task-1',
          videoUrl: 'https://example.com/generated/remote-task-1.mp4',
          localVideoPath: '~/Movies/YQhub/exports/local-task-1.mp4',
          errorCode: null,
          errorMessage: null,
          requestId: 'request-1',
          createdAt: '2026-06-13T00:00:00.000Z',
          updatedAt: '2026-06-13T00:00:00.000Z'
        }
      ]
    };

    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(state));

    expect(loadWorkspaceState(storage).tasks[0]).toMatchObject({
      videoUrl: null,
      localVideoPath: null
    });
  });
});
