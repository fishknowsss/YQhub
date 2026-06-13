import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AssetReference } from '../src/domain/types';
import { isModelId, type ModelId } from '../src/shared/modelCapabilities';
import {
  buildQueryPayload,
  buildSubmitPayload,
  createVolcengineClient,
  type GetTaskResult,
  type SubmitTaskResult,
  type VisualQueryPayload,
  type VisualSubmitPayload,
  type VisualCredentials
} from '../src/services/volcengineClient';

export interface RelaySubmitTaskInput {
  credentials?: VisualCredentials;
  payload: VisualSubmitPayload;
}

export interface RelayVisualClient {
  submitTask(input: RelaySubmitTaskInput): Promise<SubmitTaskResult>;
  getTaskResult(input: {
    credentials?: VisualCredentials;
    payload: VisualQueryPayload;
  }): Promise<GetTaskResult>;
}

export interface CreateRelayHandlerOptions {
  allowedKeys: string[];
  assetDir: string;
  publicBaseUrl: string;
  visualClient: RelayVisualClient;
  visualCredentials?: VisualCredentials;
}

interface RelayTaskRequest {
  prompt?: string;
  finalPrompt?: string;
  model?: string;
  duration?: string;
  resolution?: string;
  assets?: RelayAssetInput[];
}

interface RelayAssetInput {
  id?: string;
  type?: AssetReference['type'];
  label?: string;
  localName?: string;
  dataUrl?: string;
  mimeType?: string;
}

export function createRelayHandler(options: CreateRelayHandlerOptions) {
  const allowedKeys = new Set(options.allowedKeys.map((key) => key.trim()).filter(Boolean));

  return async function handleRelayRequest(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (request.method === 'POST' && url.pathname === '/v1/tasks') {
        if (!isAllowed(request, allowedKeys)) {
          return jsonResponse({ error: 'unauthorized', message: 'API Key 不可用' }, 401);
        }

        const body = (await request.json()) as RelayTaskRequest;
        const publicAssets = await uploadAssets(body.assets ?? [], options);
        const model = parseModelId(body.model);
        const payload = buildSubmitPayload({
          model,
          prompt: body.finalPrompt ?? body.prompt ?? '',
          duration: body.duration ?? '～15s',
          resolution: body.resolution ?? '16:9',
          assets: publicAssets
        });
        const result = await options.visualClient.submitTask({
          credentials: options.visualCredentials,
          payload
        });

        return jsonResponse({
          task_id: result.apiTaskId,
          request_id: result.requestId,
          status: result.status
        });
      }

      if (request.method === 'GET' && url.pathname.startsWith('/v1/tasks/')) {
        if (!isAllowed(request, allowedKeys)) {
          return jsonResponse({ error: 'unauthorized', message: 'API Key 不可用' }, 401);
        }

        const apiTaskId = decodeURIComponent(url.pathname.replace('/v1/tasks/', ''));
        const model = parseModelId(url.searchParams.get('model') ?? undefined);
        const result = await options.visualClient.getTaskResult({
          credentials: options.visualCredentials,
          payload: buildQueryPayload({
            model,
            apiTaskId
          })
        });

        return jsonResponse({
          request_id: result.requestId,
          status: result.status,
          video_url: result.videoUrl,
          resp_data: result.respData
        });
      }

      if (request.method === 'GET' && url.pathname.startsWith('/assets/')) {
        return serveAsset(options.assetDir, url.pathname);
      }

      if (request.method === 'GET' && url.pathname === '/health') {
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ error: 'not_found', message: '接口不存在' }, 404);
    } catch (error) {
      return jsonResponse(
        {
          error: 'relay_error',
          message: error instanceof Error ? error.message : 'Relay 处理失败'
        },
        500
      );
    }
  };
}

export function createRelayHandlerFromEnv(): ReturnType<typeof createRelayHandler> {
  const visualCredentials = readVisualCredentialsFromEnv();

  return createRelayHandler({
    allowedKeys: splitEnvList(process.env.YQHUB_ALLOWED_KEYS),
    assetDir: process.env.YQHUB_ASSET_DIR ?? path.join(process.cwd(), '.yqhub-assets'),
    publicBaseUrl: requireEnv('YQHUB_PUBLIC_BASE_URL'),
    visualClient: createVolcengineClient(),
    visualCredentials
  });
}

async function uploadAssets(
  assets: RelayAssetInput[],
  options: CreateRelayHandlerOptions
): Promise<AssetReference[]> {
  const uploaded: AssetReference[] = [];

  for (const asset of assets) {
    if (asset.type !== 'image' && asset.type !== 'video') {
      continue;
    }

    const parsed = parseDataUrl(asset.dataUrl ?? '');
    const extension = extensionFromMimeType(asset.mimeType ?? parsed.mimeType);
    const filename = `${randomUUID()}${extension}`;
    const outputPath = path.join(options.assetDir, filename);
    await mkdir(options.assetDir, { recursive: true });
    await writeFile(outputPath, parsed.bytes);
    uploaded.push({
      id: asset.id ?? filename,
      type: asset.type,
      label: asset.label ?? '',
      localName: asset.localName ?? filename,
      previewUrl: '',
      publicUrl: new URL(`/assets/${filename}`, normalizeBaseUrl(options.publicBaseUrl)).toString(),
      uploadStatus: 'uploaded'
    });
  }

  return uploaded;
}

async function serveAsset(assetDir: string, pathname: string): Promise<Response> {
  const filename = path.basename(decodeURIComponent(pathname));
  const filePath = path.join(assetDir, filename);
  const bytes = await readFile(filePath);

  return new Response(bytes, {
    headers: {
      'content-type': mimeTypeFromExtension(path.extname(filename)),
      'cache-control': 'public, max-age=3600'
    }
  });
}

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Buffer } {
  const match = /^data:([^;,]+);base64,(.+)$/u.exec(dataUrl);

  if (!match) {
    throw new Error('素材数据格式不正确');
  }

  return {
    mimeType: match[1],
    bytes: Buffer.from(match[2], 'base64')
  };
}

function extensionFromMimeType(mimeType: string): string {
  if (mimeType === 'image/png') {
    return '.png';
  }

  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return '.jpg';
  }

  if (mimeType === 'video/mp4') {
    return '.mp4';
  }

  if (mimeType === 'video/quicktime') {
    return '.mov';
  }

  if (mimeType === 'video/webm') {
    return '.webm';
  }

  throw new Error('仅支持 jpg 和 png 图片');
}

function mimeTypeFromExtension(extension: string): string {
  if (extension === '.png') {
    return 'image/png';
  }

  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }

  if (extension === '.mp4') {
    return 'video/mp4';
  }

  if (extension === '.mov') {
    return 'video/quicktime';
  }

  if (extension === '.webm') {
    return 'video/webm';
  }

  return 'application/octet-stream';
}

function parseModelId(value: string | undefined): ModelId {
  if (value && isModelId(value)) {
    return value;
  }

  return 'seedance2.0fast';
}

function isAllowed(request: Request, allowedKeys: Set<string>): boolean {
  if (allowedKeys.size === 0) {
    return false;
  }

  const key = request.headers.get('x-yqhub-api-key')?.trim() ?? '';
  return allowedKeys.has(key);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json'
    }
  });
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

function splitEnvList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readVisualCredentialsFromEnv(): VisualCredentials {
  return {
    accountId: 'relay-volcengine',
    accessKeyId: requireEnv('VOLCENGINE_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('VOLCENGINE_SECRET_ACCESS_KEY'),
    endpoint: process.env.VOLCENGINE_ENDPOINT ?? 'https://visual.volcengineapi.com',
    region: process.env.VOLCENGINE_REGION ?? 'cn-north-1',
    service: process.env.VOLCENGINE_SERVICE ?? 'cv'
  };
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }

  return value;
}

async function nodeRequestToWebRequest(request: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const protocol = process.env.YQHUB_RELAY_PROTOCOL ?? 'http';
  const host = request.headers.host ?? '127.0.0.1';
  const url = `${protocol}://${host}${request.url ?? '/'}`;
  const method = request.method ?? 'GET';

  return new Request(url, {
    method,
    headers: request.headers as HeadersInit,
    body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks)
  });
}

async function writeWebResponse(response: Response, serverResponse: ServerResponse): Promise<void> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  serverResponse.writeHead(response.status, headers);
  serverResponse.end(Buffer.from(await response.arrayBuffer()));
}

export function startRelayServer(port = Number(process.env.PORT ?? 8787)): void {
  const handler = createRelayHandlerFromEnv();
  const server = createServer(async (request, response) => {
    const webRequest = await nodeRequestToWebRequest(request);
    const webResponse = await handler(webRequest);
    await writeWebResponse(webResponse, response);
  });

  server.listen(port, () => {
    console.log(`YQhub Relay listening on ${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startRelayServer();
}
