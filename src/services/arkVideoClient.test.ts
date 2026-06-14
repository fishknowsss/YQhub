import { describe, expect, it } from 'vitest';
import type { GenerationTask } from '../domain/types';
import { buildArkVideoPayload, createArkVideoClient, type ArkFetcherLike } from './arkVideoClient';

describe('ark video client', () => {
  it('builds Seedance 2.0 Fast payload with local reference data', () => {
    const payload = buildArkVideoPayload(createTask());

    expect(payload).toMatchObject({
      model: 'doubao-seedance-2-0-fast-260128',
      duration: 5,
      resolution: '720p',
      ratio: '16:9',
      content: [
        {
          type: 'text',
          text: expect.stringContaining('--ratio 16:9 --resolution 720p --dur 5')
        },
        {
          type: 'image_url',
          image_url: {
            url: 'data:image/png;base64,ZmFrZQ=='
          },
          role: 'reference_image'
        }
      ]
    });
  });

  it('passes local audio references as data URLs', () => {
    const payload = buildArkVideoPayload({
      ...createTask(),
      assets: [
        {
          id: 'asset-audio',
          type: 'audio',
          label: '音频一是旁白',
          localName: 'voice.wav',
          previewUrl: 'data:audio/wav;base64,ZmFrZQ==',
          dataUrl: 'data:audio/wav;base64,ZmFrZQ==',
          mimeType: 'audio/wav',
          uploadStatus: 'local'
        }
      ]
    });

    expect(payload.content).toContainEqual({
      type: 'audio_url',
      audio_url: {
        url: 'data:audio/wav;base64,ZmFrZQ=='
      },
      role: 'reference_audio'
    });
  });

  it('rejects local video references because Ark requires a video URL or asset id', () => {
    expect(() =>
      buildArkVideoPayload({
        ...createTask(),
        assets: [
          {
            id: 'asset-video',
            type: 'video',
            label: '视频一是动作参考',
            localName: 'motion.mp4',
            previewUrl: 'data:video/mp4;base64,ZmFrZQ==',
            dataUrl: 'data:video/mp4;base64,ZmFrZQ==',
            mimeType: 'video/mp4',
            uploadStatus: 'local'
          }
        ]
      })
    ).toThrow('motion.mp4 当前不支持本地视频参考，请改用图片或音频参考');
  });

  it('keeps remote video references when an upstream asset url is available', () => {
    const payload = buildArkVideoPayload({
      ...createTask(),
      assets: [
        {
          id: 'asset-video',
          type: 'video',
          label: '视频一是动作参考',
          localName: 'motion.mp4',
          previewUrl: 'data:video/mp4;base64,ZmFrZQ==',
          dataUrl: 'data:video/mp4;base64,ZmFrZQ==',
          publicUrl: 'asset://motion-reference',
          mimeType: 'video/mp4',
          uploadStatus: 'uploaded'
        }
      ]
    });

    expect(payload.content).toContainEqual({
      type: 'video_url',
      video_url: {
        url: 'asset://motion-reference'
      },
      role: 'reference_video'
    });
  });

  it('submits with bearer auth and returns the remote task id', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetcher: ArkFetcherLike = async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'cgt-2026-task'
        })
      };
    };
    const client = createArkVideoClient({ fetcher });

    await expect(
      client.submitTask({
        credentials: {
          accountId: 'account-1',
          apiKey: 'ak-localUserKey1234567890'
        },
        task: createTask()
      })
    ).resolves.toMatchObject({
      apiTaskId: 'cgt-2026-task',
      status: 'in_queue'
    });

    expect(calls[0].url).toBe('https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks');
    expect(calls[0].init.headers).toMatchObject({
      authorization: 'Bearer ak-localUserKey1234567890',
      'content-type': 'application/json'
    });
  });

  it('maps Ark query results to local task states', async () => {
    const client = createArkVideoClient({
      fetcher: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'cgt-2026-task',
          status: 'succeeded',
          content: {
            video_url: 'https://cdn.example.com/result.mp4'
          }
        })
      })
    });

    await expect(
      client.getTaskResult({
        credentials: {
          accountId: 'account-1',
          apiKey: 'ak-localUserKey1234567890'
        },
        task: {
          ...createTask(),
          apiTaskId: 'cgt-2026-task'
        }
      })
    ).resolves.toMatchObject({
      requestId: 'cgt-2026-task',
      status: 'done',
      videoUrl: 'https://cdn.example.com/result.mp4'
    });
  });

  it('surfaces Ark API errors clearly', async () => {
    const client = createArkVideoClient({
      fetcher: async () => ({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: 'Unauthorized',
            message: 'API Key 不可用'
          }
        })
      })
    });

    await expect(
      client.submitTask({
        credentials: {
          accountId: 'account-1',
          apiKey: 'ak-localUserKey1234567890'
        },
        task: createTask()
      })
    ).rejects.toThrow('API Key 不可用');
  });

  it('translates Ark API key format errors', async () => {
    const client = createArkVideoClient({
      fetcher: async () => ({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: 'AuthenticationError',
            message: 'The API key format is incorrect. Request id: test'
          }
        })
      })
    });

    await expect(
      client.submitTask({
        credentials: {
          accountId: 'account-1',
          apiKey: 'ak-localUserKey1234567890'
        },
        task: createTask()
      })
    ).rejects.toThrow('API Key 被方舟接口拒绝：格式不正确');
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
    duration: '5',
    resolution: '720p',
    ratio: '16:9',
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
