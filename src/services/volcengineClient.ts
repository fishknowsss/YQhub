import type { AssetReference } from '../domain/types';
import { MODEL_CAPABILITIES, type ModelId } from '../shared/modelCapabilities';
import { createHash, createHmac } from 'node:crypto';

export interface BuildSubmitPayloadInput {
  model: ModelId;
  productName: string;
  assets: AssetReference[];
}

export interface PippitSubmitPayload {
  req_key: 'pippit_iv2v_cvtob_master';
  product_name: string;
  product_img_url_list: string[];
  model_img_url_list?: string[];
}

export interface VisualCredentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  region: string;
  service: string;
}

export interface SignedVisualRequestInput {
  action: string;
  version: string;
  credentials: VisualCredentials;
  body: unknown;
  now: Date;
}

export interface SignedVisualRequest {
  url: string;
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
  };
}

export interface FetchResponseLike {
  json(): Promise<unknown>;
}

export interface FetcherLike {
  (url: string, init: SignedVisualRequest['init']): Promise<FetchResponseLike>;
}

export interface CreateVolcengineClientOptions {
  fetcher?: FetcherLike;
  now?: () => Date;
}

export interface SubmitTaskInput {
  credentials: VisualCredentials;
  payload: PippitSubmitPayload;
  task?: unknown;
}

export interface SubmitTaskResult {
  apiTaskId: string;
  requestId: string;
  status: 'in_queue';
}

export function buildSubmitPayload(input: BuildSubmitPayloadInput): PippitSubmitPayload {
  const capabilities = MODEL_CAPABILITIES[input.model];

  if (capabilities.submitMappingStatus !== 'known') {
    throw new Error('当前模型接口字段未配置，请补充接口文档后再提交');
  }

  const publicImageUrls = input.assets
    .filter((asset) => asset.type === 'image')
    .map((asset) => asset.publicUrl?.trim() ?? '');

  if (publicImageUrls.length === 0 || publicImageUrls.some((url) => !url)) {
    throw new Error('请先配置素材上传方式，或粘贴公网图片链接。');
  }

  const [productImageUrl, modelImageUrl] = publicImageUrls;
  const payload: PippitSubmitPayload = {
    req_key: capabilities.reqKey,
    product_name: input.productName.trim() || '未命名商品',
    product_img_url_list: [productImageUrl]
  };

  if (modelImageUrl) {
    payload.model_img_url_list = [modelImageUrl];
  }

  return payload;
}

export function buildSignedVisualRequest(input: SignedVisualRequestInput): SignedVisualRequest {
  const endpoint = new URL(input.credentials.endpoint);
  const body = JSON.stringify(input.body);
  const payloadHash = sha256Hex(body);
  const dateTime = formatDateTime(input.now);
  const shortDate = dateTime.slice(0, 8);
  const query = canonicalQuery({
    Action: input.action,
    Version: input.version
  });
  const signedHeaders = 'content-type;host;x-content-sha256;x-date';
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    host: endpoint.host,
    'x-content-sha256': payloadHash,
    'x-date': dateTime
  };
  const canonicalHeaders = signedHeaders
    .split(';')
    .map((name) => `${name}:${headers[name].trim()}`)
    .join('\n');
  const canonicalRequest = [
    'POST',
    '/',
    query,
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash
  ].join('\n');
  const credentialScope = `${shortDate}/${input.credentials.region}/${input.credentials.service}/request`;
  const stringToSign = [
    'HMAC-SHA256',
    dateTime,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n');
  const signingKey = getSigningKey(
    input.credentials.secretAccessKey,
    shortDate,
    input.credentials.region,
    input.credentials.service
  );
  const signature = hmacHex(signingKey, stringToSign);

  headers.authorization = [
    `HMAC-SHA256 Credential=${input.credentials.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(', ');

  return {
    url: `${endpoint.origin}/?${query}`,
    init: {
      method: 'POST',
      headers,
      body
    }
  };
}

export function createVolcengineClient(options: CreateVolcengineClientOptions = {}) {
  const fetcher = options.fetcher ?? defaultFetcher;
  const now = options.now ?? (() => new Date());

  return {
    async submitTask(input: SubmitTaskInput): Promise<SubmitTaskResult> {
      const request = buildSignedVisualRequest({
        action: 'CVSync2AsyncSubmitTask',
        version: '2022-08-31',
        credentials: input.credentials,
        body: input.payload,
        now: now()
      });
      const response = await fetcher(request.url, request.init);
      const raw = await response.json();

      return normalizeSubmitTaskResponse(raw);
    }
  };
}

function normalizeSubmitTaskResponse(raw: unknown): SubmitTaskResult {
  if (!isObject(raw)) {
    throw new Error('接口返回格式不正确');
  }

  if (raw.code !== 10000) {
    throw new Error(String(raw.message ?? '提交失败'));
  }

  const data = isObject(raw.data) ? raw.data : null;
  const taskId = typeof data?.task_id === 'string' ? data.task_id : '';

  if (!taskId) {
    throw new Error('接口未返回 task_id');
  }

  return {
    apiTaskId: taskId,
    requestId: typeof raw.request_id === 'string' ? raw.request_id : '',
    status: 'in_queue'
  };
}

async function defaultFetcher(url: string, init: SignedVisualRequest['init']): Promise<FetchResponseLike> {
  return fetch(url, init);
}

function canonicalQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join('&');
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function formatDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmacBuffer(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

function hmacHex(key: string | Buffer, value: string): string {
  return createHmac('sha256', key).update(value).digest('hex');
}

function getSigningKey(secret: string, shortDate: string, region: string, service: string): Buffer {
  const dateKey = hmacBuffer(secret, shortDate);
  const regionKey = hmacBuffer(dateKey, region);
  const serviceKey = hmacBuffer(regionKey, service);
  return hmacBuffer(serviceKey, 'request');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
