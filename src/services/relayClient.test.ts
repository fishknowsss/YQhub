import { describe, expect, it } from 'vitest';
import { createRelayClient } from './relayClient';
import type { GenerationTask } from '../domain/types';

describe('relay client', () => {
  it('submits local asset data with the user API key header', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = createRelayClient({
      fetcher: async (url, init) => {
        calls.push({ url, init });
        return {
          json: async () => ({
            task_id: 'relay-task-1',
            request_id: 'relay-request-1',
            status: 'in_queue'
          })
        };
      }
    });

    await expect(
      client.submitTask({
        credentials: {
          accountId: 'account-1',
          apiKey: 'ak-user',
          relayEndpoint: 'https://relay.example.com'
        },
        task: createTask()
      })
    ).resolves.toEqual({
      apiTaskId: 'relay-task-1',
      requestId: 'relay-request-1',
      status: 'in_queue'
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://relay.example.com/v1/tasks');
    expect(calls[0].init.headers).toMatchObject({
      'content-type': 'application/json',
      'x-yqhub-api-key': 'ak-user'
    });
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      prompt: '生成一条茶饮短片',
      finalPrompt: '生成一条茶饮短片\n\n图一是产品',
      model: 'seedance2.0fast',
      duration: '～15s',
      resolution: '16:9',
      assets: [
        {
          localName: 'product.png',
          dataUrl: 'data:image/png;base64,ZmFrZQ=='
        }
      ]
    });
  });
});

function createTask(): GenerationTask {
  return {
    id: 'local-task-1',
    accountId: 'account-1',
    prompt: '生成一条茶饮短片',
    finalPrompt: '生成一条茶饮短片\n\n图一是产品',
    assets: [
      {
        id: 'asset-1',
        type: 'image',
        label: '图一是产品',
        localName: 'product.png',
        previewUrl: 'data:image/png;base64,ZmFrZQ==',
        dataUrl: 'data:image/png;base64,ZmFrZQ==',
        mimeType: 'image/png',
        uploadStatus: 'local'
      }
    ],
    duration: '～15s',
    resolution: '16:9',
    model: 'seedance2.0fast',
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
