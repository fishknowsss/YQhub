import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRelayHandler } from './relayServer';
import type { RelayVisualClient } from './relayServer';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { force: true, recursive: true })));
  tempDirs.length = 0;
});

describe('relay server', () => {
  it('allows health checks without a user API key', async () => {
    const handler = createRelayHandler({
      allowedKeys: ['ak-allowed'],
      assetDir: await createTempDir(),
      publicBaseUrl: 'https://relay.example.com',
      visualClient: createVisualClient()
    });

    const response = await handler(new Request('http://relay.local/health'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('serves public assets without a user API key so the visual API can fetch references', async () => {
    const assetDir = await createTempDir();
    const visualClient = createVisualClient();
    const handler = createRelayHandler({
      allowedKeys: ['ak-user'],
      assetDir,
      publicBaseUrl: 'https://relay.example.com',
      visualClient
    });

    const submitResponse = await handler(
      new Request('http://relay.local/v1/tasks', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-yqhub-api-key': 'ak-user'
        },
        body: JSON.stringify({
          prompt: '生成一条茶饮短片',
          model: 'seedance2.0fast',
          duration: '～15s',
          resolution: '16:9',
          assets: [
            {
              id: 'asset-1',
              type: 'image',
              label: '图一是产品',
              localName: 'product.png',
              dataUrl: 'data:image/png;base64,ZmFrZQ==',
              mimeType: 'image/png'
            }
          ]
        })
      })
    );
    expect(submitResponse.status).toBe(200);
    const [filename] = await readdir(assetDir);

    const assetResponse = await handler(new Request(`http://relay.local/assets/${filename}`));

    expect(assetResponse.status).toBe(200);
    expect(assetResponse.headers.get('content-type')).toBe('image/png');
    await expect(assetResponse.text()).resolves.toBe('fake');
  });

  it('rejects requests when the user API key is not allowed', async () => {
    const handler = createRelayHandler({
      allowedKeys: ['ak-allowed'],
      assetDir: await createTempDir(),
      publicBaseUrl: 'https://relay.example.com',
      visualClient: createVisualClient()
    });

    const response = await handler(
      new Request('http://relay.local/v1/tasks', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-yqhub-api-key': 'ak-denied'
        },
        body: JSON.stringify({ prompt: '测试', assets: [] })
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      message: 'API Key 不可用'
    });
  });

  it('stores local asset data and submits public URLs to the visual client', async () => {
    const assetDir = await createTempDir();
    const submittedPayloads: unknown[] = [];
    const visualClient = createVisualClient({
      submitTask: async ({ payload }) => {
        submittedPayloads.push(payload);
        return {
          apiTaskId: 'remote-task-1',
          requestId: 'request-1',
          status: 'in_queue'
        };
      }
    });
    const handler = createRelayHandler({
      allowedKeys: ['ak-user'],
      assetDir,
      publicBaseUrl: 'https://relay.example.com',
      visualClient
    });

    const response = await handler(
      new Request('http://relay.local/v1/tasks', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-yqhub-api-key': 'ak-user'
        },
        body: JSON.stringify({
          prompt: '生成一条茶饮短片',
          finalPrompt: '生成一条茶饮短片\n\n图一是产品\n视频一是动作参考',
          model: 'seedance2.0fast',
          duration: '～15s',
          resolution: '16:9',
          assets: [
            {
              id: 'asset-1',
              type: 'image',
              label: '图一是产品',
              localName: 'product.png',
              dataUrl: 'data:image/png;base64,ZmFrZQ==',
              mimeType: 'image/png'
            },
            {
              id: 'asset-2',
              type: 'video',
              label: '视频一是动作参考',
              localName: 'motion.mp4',
              dataUrl: 'data:video/mp4;base64,ZmFrZQ==',
              mimeType: 'video/mp4'
            }
          ]
        })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      task_id: 'remote-task-1',
      request_id: 'request-1',
      status: 'in_queue'
    });
    expect(submittedPayloads).toHaveLength(1);
    expect(submittedPayloads[0]).toMatchObject({
      req_key: 'pippit_iv2v_v20_cvtob_with_vinput',
      prompt: '生成一条茶饮短片\n\n图一是产品\n视频一是动作参考',
      ratio: '16:9',
      duration: '～15s',
      language: 'Chinese',
      img_url_list: [expect.stringMatching(/^https:\/\/relay\.example\.com\/assets\/.+\.png$/)],
      video_url_list: [expect.stringMatching(/^https:\/\/relay\.example\.com\/assets\/.+\.mp4$/)]
    });
    const submittedPayload = submittedPayloads[0] as {
      img_url_list: string[];
      video_url_list: string[];
    };

    const storedImage = path.join(assetDir, path.basename(new URL(submittedPayload.img_url_list[0]).pathname));
    const storedVideo = path.join(assetDir, path.basename(new URL(submittedPayload.video_url_list[0]).pathname));
    await expect(readFile(storedImage, 'utf8')).resolves.toBe('fake');
    await expect(readFile(storedVideo, 'utf8')).resolves.toBe('fake');
  });

  it('queries seedance tasks with the same documented req_key', async () => {
    const queryBodies: unknown[] = [];
    const visualClient = createVisualClient({
      getTaskResult: async ({ payload }) => {
        queryBodies.push(payload);
        return {
          requestId: 'request-query-1',
          status: 'done',
          videoUrl: 'https://cdn.example.com/result.mp4',
          respData: null
        };
      }
    });
    const handler = createRelayHandler({
      allowedKeys: ['ak-user'],
      assetDir: await createTempDir(),
      publicBaseUrl: 'https://relay.example.com',
      visualClient
    });

    const response = await handler(
      new Request('http://relay.local/v1/tasks/remote-task-1?model=seedance2.0fast', {
        method: 'GET',
        headers: {
          'x-yqhub-api-key': 'ak-user'
        }
      })
    );

    expect(response.status).toBe(200);
    expect(queryBodies).toEqual([
      {
        req_key: 'pippit_iv2v_v20_cvtob_with_vinput',
        task_id: 'remote-task-1'
      }
    ]);
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'yqhub-relay-'));
  tempDirs.push(dir);
  return dir;
}

function createVisualClient(overrides: Partial<RelayVisualClient> = {}): RelayVisualClient {
  return {
    submitTask: async () => ({
      apiTaskId: 'remote-task-1',
      requestId: 'request-1',
      status: 'in_queue'
    }),
    getTaskResult: async () => ({
      requestId: 'request-query-1',
      status: 'done',
      videoUrl: 'https://cdn.example.com/result.mp4',
      respData: null
    }),
    ...overrides
  };
}
