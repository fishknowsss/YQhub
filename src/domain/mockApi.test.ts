import { describe, expect, it } from 'vitest';
import { createMockVideoApi } from './mockApi';

describe('mock video API', () => {
  it('keeps submitted tasks separated by account', async () => {
    const api = createMockVideoApi();

    const first = await api.submit({
      accountId: 'account-a',
      prompt: '视频 A',
      duration: '5s',
      resolution: '720p',
      assets: []
    });
    const second = await api.submit({
      accountId: 'account-b',
      prompt: '视频 B',
      duration: '10s',
      resolution: '1080p',
      assets: []
    });

    expect(first.taskId).not.toBe(second.taskId);
    expect(await api.query('account-a', first.taskId)).toMatchObject({
      taskId: first.taskId,
      accountId: 'account-a'
    });
    await expect(api.query('account-b', first.taskId)).rejects.toThrow('任务不属于当前账号');
  });
});
