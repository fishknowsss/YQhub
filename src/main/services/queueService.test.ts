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
      accessKeyId: 'ak-xiao',
      secretAccessKey: 'sk-xiao'
    });
    const secondAccount = accountService.addAccount({
      name: '言笑账号',
      accessKeyId: 'ak-yan',
      secretAccessKey: 'sk-yan'
    });
    const calls: string[] = [];
    const client: VideoClient = {
      submitTask: async ({ credentials }) => {
        calls.push(`${credentials.accountId}:${credentials.accessKeyId}:${credentials.secretAccessKey}`);
        return {
          apiTaskId: 'remote-task-1',
          requestId: 'request-1',
          status: 'in_queue'
        };
      }
    };
    const queue = createQueueService({ accountService, client });
    const task = createTaskForAccount(firstAccount.id);

    const submitted = await queue.submit(task, secondAccount.id);

    expect(submitted).toMatchObject({
      accountId: firstAccount.id,
      apiTaskId: 'remote-task-1',
      requestId: 'request-1'
    });
    expect(calls).toEqual([`${firstAccount.id}:ak-xiao:sk-xiao`]);
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
        publicUrl: 'https://cdn.example.com/product.png',
        uploadStatus: 'uploaded'
      }
    ],
    duration: '5s',
    resolution: '16:9',
    model: 'pippit_iv2v_cvtob_master',
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
