import type { AssetReference, GenerationTask } from '../domain/types';
import type {
  RemoteGetTaskResult,
  RemoteSubmitTaskInput,
  RemoteSubmitTaskResult,
  RemoteTaskStatus
} from '../main/services/taskService';
import { MODEL_CAPABILITIES, isKnownSubmitModelId } from '../shared/modelCapabilities';

const DEFAULT_ENDPOINT = 'https://xyq.jianying.com';
const UPLOAD_FILE_PATH = '/api/biz/v1/skill/upload_file';
const SUBMIT_RUN_PATH = '/api/biz/v1/skill/submit_run';
const GET_THREAD_PATH = '/api/biz/v1/skill/get_thread';
const VIDEO_PART_AGENT_NAME = 'pippit_video_part_agent';
const RUN_STATE_SUCCESS = 3;
const RUN_STATE_FAILED = 4;
const CLOUD_ASSET_SETTLE_MS = 3_000;

interface XiaoyunqueFetchResponseLike {
  ok?: boolean;
  status?: number;
  json(): Promise<unknown>;
  text?(): Promise<string>;
}

export interface XiaoyunqueFetcherLike {
  (url: string, init: RequestInit): Promise<XiaoyunqueFetchResponseLike>;
}

export interface CreateXiaoyunqueClientOptions {
  endpoint?: string;
  fetcher?: XiaoyunqueFetcherLike;
}

interface MediaAssetRef {
  pippit_asset_id?: string;
  url?: string;
}

export interface SeedanceUploadedAssets {
  imageAssetIds: string[];
  videoAssetIds: string[];
  audioAssetIds?: string[];
}

export interface XiaoyunqueSeedanceSubmitBody {
  agent_name: typeof VIDEO_PART_AGENT_NAME;
  message: string;
  video_part_tool_param: {
    images?: MediaAssetRef[];
    videos?: MediaAssetRef[];
    audios?: MediaAssetRef[];
    prompt: string;
    duration_sec: number;
    ratio: string;
    model: string;
    resolution: string;
  };
}

interface UploadFileResponse {
  ret?: string | number;
  errmsg?: string;
  log_id?: string;
  data?: {
    pippit_asset_id?: string;
    asset_id?: string;
  };
}

interface SubmitRunResponse {
  ret?: string | number;
  errmsg?: string;
  log_id?: string;
  data?: {
    web_thread_link?: string;
    run?: {
      thread_id?: string;
      run_id?: string;
    };
  };
}

interface GetThreadResponse {
  ret?: string | number;
  errmsg?: string;
  log_id?: string;
  data?: unknown;
}

export function createXiaoyunqueClient(options: CreateXiaoyunqueClientOptions = {}) {
  const fetcher = options.fetcher ?? defaultFetcher;
  const endpoint = normalizeEndpoint(options.endpoint ?? DEFAULT_ENDPOINT);

  return {
    async submitTask(input: RemoteSubmitTaskInput): Promise<RemoteSubmitTaskResult> {
      const uploaded = await uploadTaskAssets({
        fetcher,
        endpoint,
        apiKey: input.credentials.apiKey,
        task: input.task
      });

      if (hasLocalUploadedAssets(input.task)) {
        await wait(CLOUD_ASSET_SETTLE_MS);
      }

      const body = buildSeedanceSubmitBody(input.task, uploaded);
      const raw = await requestJson<SubmitRunResponse>(fetcher, endpoint, input.credentials.apiKey, SUBMIT_RUN_PATH, body);
      const data = assertSuccessEnvelope(raw, '提交生成失败');
      const threadId = data.run?.thread_id?.trim() ?? '';
      const runId = data.run?.run_id?.trim() ?? '';

      if (!threadId) {
        throw new Error('小云雀未返回 thread_id');
      }

      if (!runId) {
        throw new Error('小云雀未返回 run_id');
      }

      return {
        apiTaskId: encodeRemoteTaskId(threadId, runId),
        requestId: runId,
        status: 'in_queue'
      };
    },
    async getTaskResult(input: {
      credentials: RemoteSubmitTaskInput['credentials'];
      task: GenerationTask;
    }): Promise<RemoteGetTaskResult> {
      if (!input.task.apiTaskId) {
        throw new Error('任务还没有远端 task_id');
      }

      const remoteTaskId = decodeRemoteTaskId(input.task.apiTaskId);
      const raw = await requestJson<GetThreadResponse>(fetcher, endpoint, input.credentials.apiKey, GET_THREAD_PATH, {
        thread_id: remoteTaskId.threadId,
        run_id: remoteTaskId.runId
      });
      const data = assertSuccessEnvelope(raw, '查询生成进度失败');
      const thread = readThread(data);
      const run = thread.run_list.find((candidate) => candidate.run_id === remoteTaskId.runId);

      if (!run) {
        throw new Error(`小云雀未返回 run_id=${remoteTaskId.runId} 的任务`);
      }

      const status = normalizeRunState(run.state);
      const videoUrl = status === 'done' ? extractVideoUrl(run) : null;
      const errorMessage = status === 'failed' ? extractRunErrorMessage(run) || '生成失败' : null;

      return {
        requestId: remoteTaskId.runId,
        status: videoUrl ? 'done' : status,
        videoUrl,
        errorCode: null,
        errorMessage: status === 'done' && !videoUrl ? '未找到可下载的视频' : errorMessage,
        respData: data
      };
    }
  };
}

export function buildSeedanceSubmitBody(
  task: GenerationTask,
  uploadedAssets: SeedanceUploadedAssets
): XiaoyunqueSeedanceSubmitBody {
  const model = requireModel(task.model);
  const prompt = getPrompt(task);

  const body: XiaoyunqueSeedanceSubmitBody = {
    agent_name: VIDEO_PART_AGENT_NAME,
    message: prompt,
    video_part_tool_param: {
      prompt,
      duration_sec: parseDurationSeconds(task.duration),
      ratio: task.ratio,
      model: model.apiModelId,
      resolution: task.resolution
    }
  };

  const images = mediaRefs(uploadedAssets.imageAssetIds);
  const videos = mediaRefs(uploadedAssets.videoAssetIds);
  const audios = mediaRefs(uploadedAssets.audioAssetIds ?? []);

  if (images.length) {
    body.video_part_tool_param.images = images;
  }

  if (videos.length) {
    body.video_part_tool_param.videos = videos;
  }

  if (audios.length) {
    body.video_part_tool_param.audios = audios;
  }

  return body;
}

async function uploadTaskAssets(input: {
  fetcher: XiaoyunqueFetcherLike;
  endpoint: string;
  apiKey: string;
  task: GenerationTask;
}): Promise<SeedanceUploadedAssets> {
  const upload = (asset: AssetReference) =>
    uploadAsset(input.fetcher, input.endpoint, input.apiKey, asset);

  const [imageAssetIds, videoAssetIds, audioAssetIds] = await Promise.all([
    Promise.all(input.task.assets.filter((asset) => asset.type === 'image').map(upload)),
    Promise.all(input.task.assets.filter((asset) => asset.type === 'video').map(upload)),
    Promise.all(input.task.assets.filter((asset) => asset.type === 'audio').map(upload))
  ]);

  return {
    imageAssetIds,
    videoAssetIds,
    audioAssetIds
  };
}

async function uploadAsset(
  fetcher: XiaoyunqueFetcherLike,
  endpoint: string,
  apiKey: string,
  asset: AssetReference
): Promise<string> {
  if (asset.publicUrl?.trim() && !asset.dataUrl?.trim()) {
    return asset.publicUrl.trim();
  }

  const file = dataUrlToBlob(asset);
  const form = new FormData();
  form.append('file', file, asset.localName || `${asset.id}.${extensionForAsset(asset)}`);

  const raw = await requestForm<UploadFileResponse>(fetcher, endpoint, apiKey, UPLOAD_FILE_PATH, form);
  const data = assertSuccessEnvelope(raw, `${asset.localName} 上传失败`);
  const assetId = data.pippit_asset_id?.trim() || data.asset_id?.trim() || '';

  if (!assetId) {
    throw new Error(`${asset.localName} 上传后未返回 pippit_asset_id`);
  }

  return assetId;
}

async function requestJson<T>(
  fetcher: XiaoyunqueFetcherLike,
  endpoint: string,
  apiKey: string,
  path: string,
  body: unknown
): Promise<T> {
  const response = await runRequest(() =>
    fetcher(endpoint + path, {
      method: 'POST',
      headers: {
        ...authHeaders(apiKey),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
  );

  return parseCheckedResponse<T>(response);
}

async function requestForm<T>(
  fetcher: XiaoyunqueFetcherLike,
  endpoint: string,
  apiKey: string,
  path: string,
  body: FormData
): Promise<T> {
  const response = await runRequest(() =>
    fetcher(endpoint + path, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body
    })
  );

  return parseCheckedResponse<T>(response);
}

async function runRequest(
  request: () => Promise<XiaoyunqueFetchResponseLike>
): Promise<XiaoyunqueFetchResponseLike> {
  try {
    return await request();
  } catch (error) {
    throw new Error(normalizeTransportErrorMessage(error));
  }
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey.trim()}`,
    Accept: 'application/json',
    'User-Agent': 'Pippit-CLI/1.0'
  };
}

async function parseCheckedResponse<T>(response: XiaoyunqueFetchResponseLike): Promise<T> {
  const raw = await parseResponseBody(response);

  if (response.ok === false) {
    throw new Error(normalizeXiaoyunqueErrorMessage(readErrorMessage(raw, `小云雀接口请求失败 ${response.status ?? ''}`)));
  }

  return raw as T;
}

async function parseResponseBody(response: XiaoyunqueFetchResponseLike): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return typeof response.text === 'function' ? response.text() : null;
  }
}

function assertSuccessEnvelope<T extends { ret?: string | number; errmsg?: string; log_id?: string; data?: unknown }>(
  raw: T,
  fallback: string
): NonNullable<T['data']> {
  if (!isObject(raw)) {
    throw new Error('小云雀返回格式不正确');
  }

  if (String(raw.ret ?? '') !== '0') {
    const message = raw.errmsg?.trim() || fallback;
    const logId = raw.log_id ? ` log_id=${raw.log_id}` : '';
    throw new Error(normalizeXiaoyunqueErrorMessage(`${message}${logId}`));
  }

  if (raw.data === undefined || raw.data === null) {
    throw new Error(`${fallback}：小云雀未返回 data`);
  }

  return raw.data as NonNullable<T['data']>;
}

function dataUrlToBlob(asset: AssetReference): Blob {
  const dataUrl = asset.dataUrl?.trim();

  if (!dataUrl) {
    throw new Error(`${asset.localName} 缺少素材数据，请重新上传`);
  }

  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/u);

  if (!match) {
    throw new Error(`${asset.localName} 素材数据格式不正确`);
  }

  const mimeType = asset.mimeType || match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? '';
  const bytes = isBase64
    ? Uint8Array.from(Buffer.from(payload, 'base64'))
    : new TextEncoder().encode(decodeURIComponent(payload));

  return new Blob([bytes], { type: mimeType });
}

function mediaRefs(assetIds: string[]): MediaAssetRef[] {
  return assetIds
    .map((assetId) => assetId.trim())
    .filter(Boolean)
    .map((assetId) => (isHttpUrl(assetId) ? { url: assetId } : { pippit_asset_id: assetId }));
}

function hasLocalUploadedAssets(task: GenerationTask): boolean {
  return task.assets.some((asset) => !asset.publicUrl?.trim() || Boolean(asset.dataUrl?.trim()));
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function getPrompt(task: GenerationTask): string {
  const prompt = task.finalPrompt.trim() || task.prompt.trim();

  if (!prompt) {
    throw new Error('先写提示词');
  }

  return prompt;
}

function readThread(data: unknown): { thread_id: string; run_list: Array<Record<string, unknown>> } {
  if (!isObject(data)) {
    throw new Error('小云雀返回格式不正确');
  }

  const thread = isObject(data.thread) ? data.thread : null;

  if (!thread) {
    throw new Error('小云雀响应中未找到 thread');
  }

  const runList = Array.isArray(thread.run_list) ? thread.run_list.filter(isObject) : [];
  return {
    thread_id: readString(thread, 'thread_id'),
    run_list: runList
  };
}

function normalizeRunState(state: unknown): RemoteTaskStatus {
  if (state === RUN_STATE_SUCCESS || String(state) === String(RUN_STATE_SUCCESS)) {
    return 'done';
  }

  if (state === RUN_STATE_FAILED || String(state) === String(RUN_STATE_FAILED)) {
    return 'failed';
  }

  if (state === 0 || String(state) === '0') {
    return 'in_queue';
  }

  return 'generating';
}

function extractVideoUrl(run: Record<string, unknown>): string | null {
  for (const content of readRunContents(run)) {
    if (readString(content, 'sub_type') !== 'biz/x_data_video') {
      continue;
    }

    const data = normalizeContentData(content.data);
    const video = isObject(data.video) ? data.video : data;
    const url = readString(video, 'download_url') || readString(video, 'url');

    if (url) {
      return url;
    }
  }

  return null;
}

function extractRunErrorMessage(run: Record<string, unknown>): string {
  const runMessage = readString(run, 'error_message') || readString(run, 'error_msg') || readString(run, 'errmsg');

  if (runMessage) {
    return runMessage;
  }

  for (const content of readRunContents(run)) {
    const data = normalizeContentData(content.data);
    const message = readString(data, 'error_message') || readString(data, 'error_msg') || readString(data, 'errmsg');

    if (message) {
      return message;
    }
  }

  return '';
}

function readRunContents(run: Record<string, unknown>): Array<Record<string, unknown>> {
  const entries = Array.isArray(run.entry_list) ? run.entry_list.filter(isObject) : [];
  const contents: Array<Record<string, unknown>> = [];

  for (const entry of entries) {
    const artifact = isObject(entry.artifact) ? entry.artifact : null;
    const artifactContent = artifact && Array.isArray(artifact.content) ? artifact.content.filter(isObject) : [];
    contents.push(...artifactContent);
  }

  return contents;
}

function normalizeContentData(value: unknown): Record<string, unknown> {
  if (isObject(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return {};
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return {};
  }

  try {
    const decoded = JSON.parse(trimmed);
    return isObject(decoded) ? decoded : {};
  } catch {
    return {};
  }
}

function encodeRemoteTaskId(threadId: string, runId: string): string {
  return `${threadId}:${runId}`;
}

function decodeRemoteTaskId(value: string): { threadId: string; runId: string } {
  const index = value.lastIndexOf(':');

  if (index <= 0 || index === value.length - 1) {
    throw new Error('任务远端标识不正确');
  }

  return {
    threadId: value.slice(0, index),
    runId: value.slice(index + 1)
  };
}

function requireModel(model: string) {
  if (!isKnownSubmitModelId(model)) {
    throw new Error('模型不存在');
  }

  return MODEL_CAPABILITIES[model];
}

function parseDurationSeconds(duration: string): number {
  const match = duration.match(/\d+/u);
  return match ? Number(match[0]) : 5;
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/u, '');
}

async function defaultFetcher(url: string, init: RequestInit): Promise<XiaoyunqueFetchResponseLike> {
  return fetch(url, init);
}

function readErrorMessage(raw: unknown, fallback: string): string {
  if (!isObject(raw)) {
    return fallback;
  }

  if (isObject(raw.error)) {
    return readString(raw.error, 'message') || readString(raw.error, 'code') || fallback;
  }

  return (
    readString(raw, 'errmsg') ||
    readString(raw, 'message') ||
    readString(raw, 'Message') ||
    readString(raw, 'code') ||
    readString(raw, 'Code') ||
    fallback
  );
}

function normalizeXiaoyunqueErrorMessage(message: string): string {
  if (/ak\s*(?:无效|为空)|access key|invalid accesskey|invalid api.?key|unauthorized/iu.test(message)) {
    return 'Access Key 未通过小云雀鉴权';
  }

  if (/check login error/iu.test(message)) {
    return 'Access Key 未通过小云雀鉴权';
  }

  return message;
}

function normalizeTransportErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '');

  if (/fetch failed|network|ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|UND_ERR/iu.test(message)) {
    return '网络连接失败，请稍后重试';
  }

  return message.trim() || '小云雀接口请求失败';
}

function extensionForAsset(asset: AssetReference): string {
  if (asset.type === 'video') {
    return 'mp4';
  }

  if (asset.type === 'audio') {
    return 'mp3';
  }

  return 'png';
}

function isHttpUrl(value: string): boolean {
  return value.startsWith('https://') || value.startsWith('http://');
}

function readString(source: Record<string, unknown>, key: string): string {
  return typeof source[key] === 'string' ? source[key] : '';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
