import type { GenerationTask } from '../domain/types';
import type {
  RemoteGetTaskResult,
  RemoteSubmitTaskInput,
  RemoteSubmitTaskResult,
  RemoteTaskStatus
} from '../main/services/taskService';
import { MODEL_CAPABILITIES, type ModelId } from '../shared/modelCapabilities';

const DEFAULT_ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';

interface ArkFetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text?(): Promise<string>;
}

export interface ArkFetcherLike {
  (url: string, init: RequestInit): Promise<ArkFetchResponseLike>;
}

export interface CreateArkVideoClientOptions {
  baseUrl?: string;
  fetcher?: ArkFetcherLike;
}

type ArkContentItem =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'image_url';
      image_url: {
        url: string;
      };
      role: 'reference_image';
    }
  | {
      type: 'video_url';
      video_url: {
        url: string;
      };
      role: 'reference_video';
    }
  | {
      type: 'audio_url';
      audio_url: {
        url: string;
      };
      role: 'reference_audio';
    };

export interface ArkVideoSubmitPayload {
  model: string;
  content: ArkContentItem[];
  duration: number;
  ratio: string;
  resolution: string;
}

export function createArkVideoClient(options: CreateArkVideoClientOptions = {}) {
  const fetcher = options.fetcher ?? defaultFetcher;
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_ARK_BASE_URL);

  return {
    async submitTask(input: RemoteSubmitTaskInput): Promise<RemoteSubmitTaskResult> {
      const raw = await requestArk(fetcher, baseUrl, '/contents/generations/tasks', {
        method: 'POST',
        apiKey: input.credentials.apiKey,
        body: buildArkVideoPayload(input.task)
      });

      return normalizeSubmitResponse(raw);
    },
    async getTaskResult(input: {
      credentials: RemoteSubmitTaskInput['credentials'];
      task: GenerationTask;
    }): Promise<RemoteGetTaskResult> {
      if (!input.task.apiTaskId) {
        throw new Error('任务还没有远端 ID');
      }

      const raw = await requestArk(
        fetcher,
        baseUrl,
        `/contents/generations/tasks/${encodeURIComponent(input.task.apiTaskId)}`,
        {
          method: 'GET',
          apiKey: input.credentials.apiKey
        }
      );

      return normalizeQueryResponse(raw);
    }
  };
}

export function buildArkVideoPayload(task: GenerationTask): ArkVideoSubmitPayload {
  const model = requireModel(task.model);
  const duration = parseDurationSeconds(task.duration);
  const prompt = [
    task.finalPrompt.trim() || task.prompt.trim() || '生成一条视频',
    `--ratio ${task.ratio}`,
    `--resolution ${task.resolution}`,
    `--dur ${duration}`
  ].join(' ');

  return {
    model: model.apiModelId,
    duration,
    ratio: task.ratio,
    resolution: task.resolution,
    content: [
      {
        type: 'text',
        text: prompt
      },
      ...task.assets.map(toArkContentItem)
    ]
  };
}

function toArkContentItem(asset: GenerationTask['assets'][number]): ArkContentItem {
  const url = getSupportedAssetUrl(asset);

  if (!url) {
    throw new Error(`${asset.localName} 缺少素材数据，请重新上传`);
  }

  if (asset.type === 'image') {
    return {
      type: 'image_url',
      image_url: {
        url
      },
      role: 'reference_image'
    };
  }

  if (asset.type === 'video') {
    return {
      type: 'video_url',
      video_url: {
        url
      },
      role: 'reference_video'
    };
  }

  return {
    type: 'audio_url',
    audio_url: {
      url
    },
    role: 'reference_audio'
  };
}

function getSupportedAssetUrl(asset: GenerationTask['assets'][number]): string {
  const publicUrl = asset.publicUrl?.trim();

  if (publicUrl) {
    return publicUrl;
  }

  const dataUrl = asset.dataUrl?.trim();

  if (!dataUrl) {
    return '';
  }

  if (asset.type === 'video') {
    throw new Error(`${asset.localName} 当前不支持本地视频参考，请改用图片或音频参考`);
  }

  return dataUrl;
}

async function requestArk(
  fetcher: ArkFetcherLike,
  baseUrl: string,
  pathname: string,
  options: {
    method: 'GET' | 'POST';
    apiKey: string;
    body?: unknown;
  }
): Promise<unknown> {
  const response = await fetcher(`${baseUrl}${pathname}`, {
    method: options.method,
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      'content-type': 'application/json'
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const raw = await parseResponseBody(response);

  if (!response.ok) {
    throw new Error(normalizeArkErrorMessage(readErrorMessage(raw, `方舟接口请求失败 ${response.status}`)));
  }

  return raw;
}

async function parseResponseBody(response: ArkFetchResponseLike): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return typeof response.text === 'function' ? response.text() : null;
  }
}

function normalizeSubmitResponse(raw: unknown): RemoteSubmitTaskResult {
  if (!isObject(raw)) {
    throw new Error('方舟返回格式不正确');
  }

  if (isObject(raw.error)) {
    throw new Error(readErrorMessage(raw, '提交失败'));
  }

  const taskId = typeof raw.id === 'string' ? raw.id : '';

  if (!taskId) {
    throw new Error('方舟未返回任务 ID');
  }

  return {
    apiTaskId: taskId,
    requestId: typeof raw.request_id === 'string' ? raw.request_id : taskId,
    status: 'in_queue'
  };
}

function normalizeQueryResponse(raw: unknown): RemoteGetTaskResult {
  if (!isObject(raw)) {
    throw new Error('方舟返回格式不正确');
  }

  if (isObject(raw.error)) {
    throw new Error(readErrorMessage(raw, '查询失败'));
  }

  const arkStatus = typeof raw.status === 'string' ? raw.status : '';
  const status = normalizeArkStatus(arkStatus);
  const content = isObject(raw.content) ? raw.content : {};

  return {
    requestId: typeof raw.id === 'string' ? raw.id : '',
    status,
    videoUrl: typeof content.video_url === 'string' ? content.video_url : null,
    errorCode: isObject(raw.error) && typeof raw.error.code === 'string' ? raw.error.code : null,
    errorMessage: readErrorMessage(raw, ''),
    respData: raw
  };
}

function normalizeArkStatus(status: string): RemoteTaskStatus {
  const statusMap: Record<string, RemoteTaskStatus> = {
    queued: 'in_queue',
    pending: 'in_queue',
    running: 'generating',
    processing: 'generating',
    succeeded: 'done',
    failed: 'failed',
    expired: 'expired',
    cancelled: 'failed',
    canceled: 'failed'
  };

  return statusMap[status] ?? 'processing';
}

function requireModel(model: string) {
  if (!(model in MODEL_CAPABILITIES)) {
    throw new Error('模型不存在');
  }

  return MODEL_CAPABILITIES[model as ModelId];
}

function parseDurationSeconds(duration: string): number {
  const match = duration.match(/\d+/u);
  return match ? Number(match[0]) : 5;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/u, '');
}

async function defaultFetcher(url: string, init: RequestInit): Promise<ArkFetchResponseLike> {
  return fetch(url, init);
}

function readErrorMessage(raw: unknown, fallback: string): string {
  if (!isObject(raw)) {
    return fallback;
  }

  if (isObject(raw.error)) {
    if (typeof raw.error.message === 'string') {
      return raw.error.message;
    }

    if (typeof raw.error.code === 'string') {
      return raw.error.code;
    }
  }

  if (typeof raw.message === 'string') {
    return raw.message;
  }

  return fallback;
}

function normalizeArkErrorMessage(message: string): string {
  if (/api key format is incorrect/iu.test(message)) {
    return 'API Key 被方舟接口拒绝：格式不正确';
  }

  if (/authentication|unauthorized/iu.test(message)) {
    return 'API Key 未通过方舟鉴权';
  }

  return message;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
