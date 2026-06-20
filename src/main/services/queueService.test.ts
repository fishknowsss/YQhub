import { describe, expect, it } from 'vitest';
import { createAccountService, createMemorySecretVault } from './accountService';
import { createQueueService } from './queueService';
import type { GenerationTask } from '../../domain/types';
import type { VideoClient } from './queueService';

describe('queue service', () => {
  it('submits a task with the credentials bound to task.accountId', async () => {
    const accountService = createAccountService({ vault: createMemorySecretVault() });
    const firstAccount = accountService.addAccount({
      name: '萧衍账号',
      apiKey: 'ak-xiaoUserKey1234567890'
    });
    const secondAccount = accountService.addAccount({
      name: '言笑账号',
      apiKey: 'ak-yanUserKey1234567890'
    });
    const calls: string[] = [];
    const client: VideoClient = {
      submitTask: async ({ credentials }) => {
        calls.push(`${credentials.accountId}:${credentials.apiKey}`);
        return {
          apiTaskId: 'remote-task-1',
          requestId: 'request-1',
          status: 'in_queue'
        };
      }
    };
    const queue = createQueueService({ accountService, client });
    const task = createTaskForAccount(firstAccount.id);
    const beforeSubmit = Date.now() - 1000;

    const submitted = await queue.submit(task, secondAccount.id);

    expect(submitted).toMatchObject({
      accountId: firstAccount.id,
      apiTaskId: 'remote-task-1',
      requestId: 'request-1'
    });
    expect(Date.parse(submitted.updatedAt)).toBeGreaterThanOrEqual(beforeSubmit);
    expect(calls).toEqual([`${firstAccount.id}:ak-xiaoUserKey1234567890`]);
  });

  it('normalizes transport failures before they cross the Electron IPC boundary', async () => {
    const accountService = createAccountService({ vault: createMemorySecretVault() });
    const account = accountService.addAccount({
      name: '萧衍账号',
      apiKey: 'ak-xiaoUserKey1234567890'
    });
    const client: VideoClient = {
      submitTask: async () => {
        throw new TypeError('fetch failed');
      }
    };
    const queue = createQueueService({ accountService, client });

    await expect(queue.submit(createTaskForAccount(account.id))).rejects.toThrow(
      '网络连接失败，请稍后重试'
    );
  });
});

function createTaskForAccount(accountId: string): GenerationTask {
  return {
    id: 'local-task-1',
    accountId,
    prompt: '生成一条茶饮短片',
    finalPrompt: '生成一条茶饮短片',
    assets: [
      {
        id: 'asset-1',
        type: 'image',
        label: '图一是产品',
        localName: 'product.png',
        previewUrl: 'blob:product',
        dataUrl: 'data:image/png;base64,ZmFrZQ==',
        mimeType: 'image/png',
        uploadStatus: 'local'
      }
    ],
    duration: '5',
    resolution: '720p',
    ratio: '16:9',
    model: 'Seedance_2.0_mini',
    outputName: '茶饮短片',
    status: 'in_queue',
    progress: 10,
    etaSeconds: null,
    apiTaskId: null,
    videoUrl: null,
    localVideoPath: null,
    errorCode: null,
    errorMessage: null,
    requestId: null,
    createdAt: '2026-06-13T00:00:00.000Z',
    updatedAt: '2026-06-13T00:00:00.000Z'
  };
}
