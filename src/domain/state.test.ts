import { describe, expect, it } from 'vitest';
import {
  addApiAccount,
  clearDraft,
  createGenerationTask,
  createInitialState,
  isXiaoyunqueApiKey,
  selectAccount,
  updateDraft
} from './state';

describe('workspace state', () => {
  it('starts with seedance2.0fast and documented default parameters', () => {
    expect(createInitialState().draft).toMatchObject({
      model: 'seedance2.0fast',
      duration: '15',
      resolution: '720p',
      ratio: '9:16'
    });
  });

  it('binds every generation task to the selected local API account', () => {
    let state = createInitialState();

    state = addApiAccount(state, {
      name: '萧衍账号',
      apiKey: 'ak-xiaoUserKey1234567890'
    });
    state = addApiAccount(state, {
      name: '言笑账号',
      apiKey: 'ak-yanUserKey1234567890'
    });

    const [xiao, yan] = state.accounts;

    state = selectAccount(state, xiao.id);
    state = updateDraft(state, {
      prompt: '生成一条茶饮短片',
      duration: '5s',
      resolution: '720p',
      ratio: '16:9'
    });
    state = createGenerationTask(state);

    state = selectAccount(state, yan.id);
    state = updateDraft(state, {
      prompt: '生成一条香水短片',
      duration: '10s',
      resolution: '480p',
      ratio: '9:16'
    });
    state = createGenerationTask(state);

    expect(state.tasks).toHaveLength(2);
    expect(state.tasks[0]).toMatchObject({
      accountId: xiao.id,
      prompt: '生成一条茶饮短片',
      duration: '5s',
      resolution: '720p',
      ratio: '16:9'
    });
    expect(state.tasks[1]).toMatchObject({
      accountId: yan.id,
      prompt: '生成一条香水短片',
      duration: '10s',
      resolution: '480p',
      ratio: '9:16'
    });
  });

  it('stores only local key references on API accounts', () => {
    const state = addApiAccount(createInitialState(), {
      name: '本地账号',
      apiKey: 'ak-localUserKey1234567890'
    });

    expect(state.accounts[0]).toMatchObject({
      name: '本地账号',
      apiKeyPreview: 'ak-...7890'
    });
    expect(state.accounts[0].apiKeyRef).toMatch(/^local-key:/);
    expect(JSON.stringify(state.accounts[0])).not.toContain('ak-localUserKey1234567890');
  });

  it('accepts only Xiaoyunque-style ak API keys', () => {
    expect(isXiaoyunqueApiKey('ak-localUserKey1234567890')).toBe(true);
    expect(isXiaoyunqueApiKey('sk-localUserKey1234567890')).toBe(false);
    expect(isXiaoyunqueApiKey('ak-short')).toBe(false);
    expect(() =>
      addApiAccount(createInitialState(), {
        name: '错误账号',
        apiKey: 'sk-localUserKey1234567890'
      })
    ).toThrow('只支持小云雀官网发放的 ak- API Key');
  });

  it('clears the current draft without deleting accounts or history', () => {
    let state = addApiAccount(createInitialState(), {
      name: '本地账号',
      apiKey: 'ak-localUserKey1234567890'
    });

    state = updateDraft(state, {
      prompt: '生成一条新品视频',
      assets: [
        {
          id: 'asset-1',
          type: 'image',
          label: '图一是产品',
          localName: 'product.png',
          previewUrl: 'blob:product'
        }
      ]
    });
    state = createGenerationTask(state);
    state = clearDraft(state);

    expect(state.accounts).toHaveLength(1);
    expect(state.tasks).toHaveLength(1);
    expect(state.draft.prompt).toBe('');
    expect(state.draft.assets).toEqual([]);
  });

  it('builds finalPrompt from the manual prompt and asset labels', () => {
    let state = addApiAccount(createInitialState(), {
      name: '本地账号',
      apiKey: 'ak-localUserKey1234567890'
    });

    state = updateDraft(state, {
      prompt: '保持人物关系清楚，镜头干净',
      assets: [
        {
          id: 'asset-1',
          type: 'image',
          label: '图一是萧衍',
          localName: 'xiao.png',
          previewUrl: 'blob:xiao'
        },
        {
          id: 'asset-2',
          type: 'image',
          label: '图二是言笑',
          localName: 'yan.png',
          previewUrl: 'blob:yan'
        }
      ]
    });
    state = createGenerationTask(state);

    expect(state.tasks[0].finalPrompt).toBe('保持人物关系清楚，镜头干净\n\n图一是萧衍\n图二是言笑');
  });
});
