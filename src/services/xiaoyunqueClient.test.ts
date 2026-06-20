import { describe, expect, it, vi } from 'vitest';
import type { GenerationTask } from '../domain/types';
import {
  buildSeedanceSubmitBody,
  createXiaoyunqueClient,
  type XiaoyunqueFetcherLike
} from './xiaoyunqueClient';

describe('xiaoyunque seedance client', () => {
  it('builds the official Skill submit body from prompt, asset ids and controls', () => {
    expect(
      buildSeedanceSubmitBody(createTask(), {
        imageAssetIds: ['img-asset-1'],
        videoAssetIds: ['video-asset-1']
      })
    ).toEqual({
      agent_name: 'pippit_video_part_agent',
      message: '图一是产品，视频二是动作参考。生成一条茶饮短片',
      video_part_tool_param: {
        images: [{ pippit_asset_id: 'img-asset-1' }],
        videos: [{ pippit_asset_id: 'video-asset-1' }],
        prompt: '图一是产品，视频二是动作参考。生成一条茶饮短片',
        duration_sec: 5,
        ratio: '16:9',
        model: 'Seedance_2.0_mini',
        resolution: '720p'
      }
    });
  });

  it('uploads local image and video references before submitting a Seedance run', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetcher: XiaoyunqueFetcherLike = async (url, init) => {
      calls.push({ url, init });

      if (url.endsWith('/api/biz/v1/skill/upload_file')) {
        return okJson({
          ret: '0',
          data: {
            pippit_asset_id: `asset-${calls.length}`
          }
        });
      }

      return okJson({
        ret: '0',
        data: {
          run: {
            thread_id: 'thread_123',
            run_id: 'run_456'
          },
          web_thread_link: 'https://xyq.jianying.com/home?thread_id=thread_123'
        }
      });
    };
    const client = createXiaoyunqueClient({ fetcher });

    await expect(
      client.submitTask({
        credentials: createCredentials(),
        task: createTask()
      })
    ).resolves.toEqual({
      apiTaskId: 'thread_123:run_456',
      requestId: 'run_456',
      status: 'in_queue'
    });

    expect(calls.map((call) => call.url)).toEqual([
      'https://xyq.jianying.com/api/biz/v1/skill/upload_file',
      'https://xyq.jianying.com/api/biz/v1/skill/upload_file',
      'https://xyq.jianying.com/api/biz/v1/skill/submit_run'
    ]);
    expect(calls[0].init.headers).toMatchObject({
      Authorization: 'Bearer ak-testKey1234567890',
      Accept: 'application/json',
      'User-Agent': 'Pippit-CLI/1.0'
    });
    expect(calls[2].init.headers).toMatchObject({
      Authorization: 'Bearer ak-testKey1234567890',
      'Content-Type': 'application/json'
    });
    expect(JSON.parse(String(calls[2].init.body))).toMatchObject({
      agent_name: 'pippit_video_part_agent',
      video_part_tool_param: {
        images: [{ pippit_asset_id: 'asset-1' }],
        videos: [{ pippit_asset_id: 'asset-2' }],
        model: 'Seedance_2.0_mini'
      }
    });
    expect(calls[2].url).not.toContain('visual.volcengineapi.com');
    expect(calls[2].url).not.toContain('ark.cn-beijing');
  });

  it('waits briefly after local uploads before submitting to let cloud assets settle', async () => {
    vi.useFakeTimers();
    try {
      const calls: string[] = [];
      const fetcher: XiaoyunqueFetcherLike = async (url) => {
        calls.push(url);

        if (url.endsWith('/api/biz/v1/skill/upload_file')) {
          return okJson({
            ret: '0',
            data: {
              pippit_asset_id: `asset-${calls.length}`
            }
          });
        }

        return okJson({
          ret: '0',
          data: {
            run: {
              thread_id: 'thread_123',
              run_id: 'run_456'
            }
          }
        });
      };
      const client = createXiaoyunqueClient({ fetcher });

      const submit = client.submitTask({
        credentials: createCredentials(),
        task: createTask()
      });

      await Promise.resolve();
      await Promise.resolve();
      expect(calls).toEqual([
        'https://xyq.jianying.com/api/biz/v1/skill/upload_file',
        'https://xyq.jianying.com/api/biz/v1/skill/upload_file'
      ]);

      await vi.advanceTimersByTimeAsync(2_999);
      expect(calls).toHaveLength(2);

      await vi.advanceTimersByTimeAsync(1);

      await expect(submit).resolves.toMatchObject({
        apiTaskId: 'thread_123:run_456'
      });
      expect(calls[2]).toBe('https://xyq.jianying.com/api/biz/v1/skill/submit_run');
    } finally {
      vi.useRealTimers();
    }
  });

  it('turns transport fetch failures into a readable retry message', async () => {
    const client = createXiaoyunqueClient({
      fetcher: async () => {
        throw new TypeError('fetch failed');
      }
    });

    await expect(
      client.submitTask({
        credentials: createCredentials(),
        task: createTask()
      })
    ).rejects.toThrow('网络连接失败，请稍后重试');
  });

  it('keeps the previous Fast model submit mapping available', () => {
    expect(
      buildSeedanceSubmitBody({ ...createTask(), model: 'seedance2.0fast' }, {
        imageAssetIds: [],
        videoAssetIds: []
      }).video_part_tool_param.model
    ).toBe('seedance2.0_fast_direct');
  });

  it('queries and normalizes completed video results', async () => {
    const client = createXiaoyunqueClient({
      fetcher: async () =>
        okJson({
          ret: '0',
          data: {
            thread: {
              thread_id: 'thread_123',
              run_list: [
                {
                  run_id: 'run_456',
                  state: 3,
                  entry_list: [
                    {
                      artifact: {
                        content: [
                          {
                            sub_type: 'biz/x_data_video',
                            data: JSON.stringify({
                              video: {
                                download_url: 'https://cdn.example.com/result.mp4',
                                title: 'result'
                              }
                            })
                          }
                        ]
                      }
                    }
                  ]
                }
              ]
            }
          },
          log_id: 'log-query'
        })
    });

    await expect(
      client.getTaskResult({
        credentials: createCredentials(),
        task: {
          ...createTask(),
          apiTaskId: 'thread_123:run_456'
        }
      })
    ).resolves.toMatchObject({
      requestId: 'run_456',
      status: 'done',
      videoUrl: 'https://cdn.example.com/result.mp4'
    });
  });

  it('keeps an unfinished run in progress', async () => {
    const client = createXiaoyunqueClient({
      fetcher: async () =>
        okJson({
          ret: '0',
          data: {
            thread: {
              thread_id: 'thread_123',
              run_list: [
                {
                  run_id: 'run_456',
                  state: 1
                }
              ]
            }
          }
        })
    });

    await expect(
      client.getTaskResult({
        credentials: createCredentials(),
        task: {
          ...createTask(),
          apiTaskId: 'thread_123:run_456'
        }
      })
    ).resolves.toMatchObject({
      status: 'generating',
      videoUrl: null
    });
  });

  it('translates Xiaoyunque Access Key errors', async () => {
    const client = createXiaoyunqueClient({
      fetcher: async () =>
        okJson({
          ret: '2',
          errmsg: 'Ak无效'
        })
    });

    await expect(
      client.submitTask({
        credentials: createCredentials(),
        task: createTask()
      })
    ).rejects.toThrow('Access Key 未通过小云雀鉴权');
  });
});

function okJson(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body
  };
}

function createCredentials() {
  return {
    accountId: 'account-1',
    apiKey: 'ak-testKey1234567890'
  };
}

function createTask(): GenerationTask {
  return {
    id: 'local-task-1',
    accountId: 'account-1',
    prompt: '生成一条茶饮短片',
    finalPrompt: '图一是产品，视频二是动作参考。生成一条茶饮短片',
    assets: [
      {
        id: 'asset-1',
        type: 'image',
        label: '产品',
        localName: 'product.png',
        previewUrl: 'blob:product',
        dataUrl: 'data:image/png;base64,ZmFrZQ==',
        mimeType: 'image/png',
        uploadStatus: 'local'
      },
      {
        id: 'asset-video',
        type: 'video',
        label: '动作参考',
        localName: 'motion.mp4',
        previewUrl: 'blob:motion',
        dataUrl: 'data:video/mp4;base64,ZmFrZQ==',
        mimeType: 'video/mp4',
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
