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
      apiKey: 'ak-localUserKey1234567890'
    });
    const credentialCalls: string[] = [];
    const client: VideoTaskClient = {
      submitTask: async () => {
        throw new Error('not used');
      },
      getTaskResult: async ({ credentials, task }) => {
        credentialCalls.push(`${credentials.accountId}:${credentials.apiKey}:${task.apiTaskId}:${task.model}`);
        return {
          requestId: 'request-query-1',
          status: 'done',
          videoUrl: 'https://cdn.example.com/result.mp4',
          respData: '{"Duration":"5.05"}'
        };
      }
    };
    const downloadService: DownloadService = {
      downloadGeneratedVideo: async ({ taskId, videoUrl, outputName, prompt }) => {
        expect(taskId).toBe('remote-task-1');
        expect(videoUrl).toBe('https://cdn.example.com/result.mp4');
        expect(outputName).toBe('茶饮上市-横版开场');
        expect(prompt).toBe('生成一条茶饮短片');
        return '/Users/tester/Movies/YQhub/exports/2026-06-13/茶饮上市-横版开场.mp4';
      }
    };
    const service = createTaskService({ accountService, client, downloadService });
    const task = createRemoteTask(account.id);
    const beforeRefresh = Date.now() - 1000;

    const refreshed = await service.refreshTask(task);

    expect(refreshed).toMatchObject({
      accountId: account.id,
      status: 'done',
      progress: 100,
      videoUrl: 'https://cdn.example.com/result.mp4',
      localVideoPath: '/Users/tester/Movies/YQhub/exports/2026-06-13/茶饮上市-横版开场.mp4',
      requestId: 'request-query-1'
    });
    expect(Date.parse(refreshed.updatedAt)).toBeGreaterThanOrEqual(beforeRefresh);
    expect(credentialCalls).toEqual([
      `${account.id}:ak-localUserKey1234567890:remote-task-1:seedance2.0fast`
    ]);
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
        dataUrl: 'data:image/png;base64,ZmFrZQ==',
        mimeType: 'image/png',
        uploadStatus: 'local'
      }
    ],
    duration: '5',
    resolution: '720p',
    ratio: '16:9',
    model: 'seedance2.0fast',
    outputName: '茶饮上市-横版开场',
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
