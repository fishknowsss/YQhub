import type { GenerationTask, TaskStatus } from '../domain/types';
import type {
  RelayGetTaskResult,
  RelaySubmitTaskInput,
  RelaySubmitTaskResult,
  RelayTaskStatus
} from '../main/services/taskService';

interface RelayFetchResponseLike {
  json(): Promise<unknown>;
}

export interface RelayFetcherLike {
  (url: string, init: RequestInit): Promise<RelayFetchResponseLike>;
}

export interface CreateRelayClientOptions {
  fetcher?: RelayFetcherLike;
}

export function createRelayClient(options: CreateRelayClientOptions = {}) {
  const fetcher = options.fetcher ?? defaultFetcher;

  return {
    async submitTask(input: RelaySubmitTaskInput): Promise<RelaySubmitTaskResult> {
      const raw = await requestRelay(fetcher, input.credentials.relayEndpoint, '/v1/tasks', {
        method: 'POST',
        apiKey: input.credentials.apiKey,
        body: serializeTask(input.task)
      });

      return normalizeSubmitResponse(raw);
    },
    async getTaskResult(input: {
      credentials: RelaySubmitTaskInput['credentials'];
      task: GenerationTask;
    }): Promise<RelayGetTaskResult> {
      if (!input.task.apiTaskId) {
        throw new Error('任务还没有远端 task_id');
      }

      const raw = await requestRelay(fetcher, input.credentials.relayEndpoint, `/v1/tasks/${encodeURIComponent(input.task.apiTaskId)}`, {
        method: 'GET',
        apiKey: input.credentials.apiKey,
        searchParams: {
          model: input.task.model
        }
      });

      return normalizeQueryResponse(raw);
    }
  };
}

async function requestRelay(
  fetcher: RelayFetcherLike,
  endpoint: string,
  pathname: string,
  options: {
    method: 'GET' | 'POST';
    apiKey: string;
    body?: unknown;
    searchParams?: Record<string, string>;
  }
): Promise<unknown> {
  const url = new URL(pathname, normalizeEndpoint(endpoint));
  for (const [name, value] of Object.entries(options.searchParams ?? {})) {
    url.searchParams.set(name, value);
  }
  const response = await fetcher(url.toString(), {
    method: options.method,
    headers: {
      'content-type': 'application/json',
      'x-yqhub-api-key': options.apiKey
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  return response.json();
}

function serializeTask(task: GenerationTask) {
  return {
    taskId: task.id,
    prompt: task.prompt,
    finalPrompt: task.finalPrompt,
    model: task.model,
    duration: task.duration,
    resolution: task.resolution,
    assets: task.assets.map((asset) => ({
      id: asset.id,
      type: asset.type,
      label: asset.label,
      localName: asset.localName,
      dataUrl: asset.dataUrl,
      mimeType: asset.mimeType
    }))
  };
}

function normalizeSubmitResponse(raw: unknown): RelaySubmitTaskResult {
  if (!isObject(raw)) {
    throw new Error('Relay 返回格式不正确');
  }

  if (typeof raw.error === 'string') {
    throw new Error(String(raw.message ?? raw.error));
  }

  const taskId = typeof raw.task_id === 'string' ? raw.task_id : '';

  if (!taskId) {
    throw new Error('Relay 未返回 task_id');
  }

  return {
    apiTaskId: taskId,
    requestId: typeof raw.request_id === 'string' ? raw.request_id : '',
    status: normalizeTaskStatus(raw.status)
  };
}

function normalizeQueryResponse(raw: unknown): RelayGetTaskResult {
  if (!isObject(raw)) {
    throw new Error('Relay 返回格式不正确');
  }

  if (typeof raw.error === 'string') {
    throw new Error(String(raw.message ?? raw.error));
  }

  return {
    requestId: typeof raw.request_id === 'string' ? raw.request_id : '',
    status: normalizeRelayStatus(raw.status),
    videoUrl: typeof raw.video_url === 'string' ? raw.video_url : null,
    respData: raw.resp_data ?? null
  };
}

function normalizeTaskStatus(value: unknown): TaskStatus {
  if (value === 'in_queue' || value === 'processing' || value === 'generating' || value === 'done') {
    return value;
  }

  return 'in_queue';
}

function normalizeRelayStatus(value: unknown): RelayTaskStatus {
  if (
    value === 'in_queue' ||
    value === 'processing' ||
    value === 'generating' ||
    value === 'done' ||
    value === 'not_found' ||
    value === 'expired'
  ) {
    return value;
  }

  throw new Error('Relay 任务状态不正确');
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
}

async function defaultFetcher(url: string, init: RequestInit): Promise<RelayFetchResponseLike> {
  return fetch(url, init);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
