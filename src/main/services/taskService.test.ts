import { describe, expect, it } from 'vitest';
import { createTaskService } from './taskService';
import { createAccountService, createMemorySecretVault } from './accountService';
import type { GenerationTask } from '../../domain/types';
import type { DownloadService } from './downloadService';
import type { VideoTaskClient } from './taskService';

describe('task service', () => {
  it('queries with the task account and downloads the result when done', async () => {
    const accountService = createAccountService({ vault: createMemorySecretVault() });
    const account = accountService.addAccount({
      name: '剪辑账号',
      accessKeyId: 'ak-local',
      secretAccessKey: 'sk-local'
    });
    const credentialCalls: string[] = [];
    const client: VideoTaskClient = {
      submitTask: async () => {
        throw new Error('not used');
      },
      getTaskResult: async ({ credentials, apiTaskId }) => {
        credentialCalls.push(`${credentials.accountId}:${credentials.accessKeyId}:${apiTaskId}`);
        return {
          requestId: 'request-query-1',
          status: 'done',
          videoUrl: 'https://cdn.example.com/result.mp4',
          respData: '{"Duration":"5.05"}'
        };
      }
    };
    const downloadService: DownloadService = {
      downloadGeneratedVideo: async ({ taskId, videoUrl }) => {
        expect(taskId).toBe('remote-task-1');
        expect(videoUrl).toBe('https://cdn.example.com/result.mp4');
        return '/Users/tester/Movies/YQhub/exports/2026-06-13/remote-task-1.mp4';
      }
    };
    const service = createTaskService({ accountService, client, downloadService });
    const task = createRemoteTask(account.id);

    await expect(service.refreshTask(task)).resolves.toMatchObject({
      accountId: account.id,
      status: 'done',
      progress: 100,
      videoUrl: 'https://cdn.example.com/result.mp4',
      localVideoPath: '/Users/tester/Movies/YQhub/exports/2026-06-13/remote-task-1.mp4',
      requestId: 'request-query-1'
    });
    expect(credentialCalls).toEqual([`${account.id}:ak-local:remote-task-1`]);
  });
});

function createRemoteTask(accountId: string): GenerationTask {
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
    status: 'generating',
    progress: 72,
    etaSeconds: 20,
    apiTaskId: 'remote-task-1',
    videoUrl: null,
    localVideoPath: null,
    errorCode: null,
    errorMessage: null,
    requestId: null,
    createdAt: '2026-06-13T00:00:00.000Z',
    updatedAt: '2026-06-13T00:00:00.000Z'
  };
}
