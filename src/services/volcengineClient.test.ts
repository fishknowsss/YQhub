import { describe, expect, it } from 'vitest';
import {
  buildSignedVisualRequest,
  buildSubmitPayload,
  createVolcengineClient
} from './volcengineClient';

describe('volcengine submit payload', () => {
  it('does not invent submit fields for seedance2.0fast while docs are incomplete', () => {
    expect(() =>
      buildSubmitPayload({
        model: 'seedance2.0fast',
        productName: '茶饮',
        assets: []
      })
    ).toThrow('当前模型接口字段未配置，请补充接口文档后再提交');
  });

  it('rejects local assets that do not have a public URL', () => {
    expect(() =>
      buildSubmitPayload({
        model: 'pippit_iv2v_cvtob_master',
        productName: '茶饮',
        assets: [
          {
            id: 'asset-1',
            type: 'image',
            label: '图一是产品',
            localName: 'product.png',
            previewUrl: 'blob:product',
            uploadStatus: 'local'
          }
        ]
      })
    ).toThrow('请先配置素材上传方式，或粘贴公网图片链接。');
  });

  it('maps the known 小云雀营销成片 Agent fields from public image URLs', () => {
    expect(
      buildSubmitPayload({
        model: 'pippit_iv2v_cvtob_master',
        productName: '茶饮',
        assets: [
          {
            id: 'asset-1',
            type: 'image',
            label: '图一是产品',
            localName: 'product.png',
            previewUrl: 'blob:product',
            publicUrl: 'https://cdn.example.com/product.png',
            uploadStatus: 'uploaded'
          },
          {
            id: 'asset-2',
            type: 'image',
            label: '图二是模特',
            localName: 'model.png',
            previewUrl: 'blob:model',
            publicUrl: 'https://cdn.example.com/model.png',
            uploadStatus: 'uploaded'
          }
        ]
      })
    ).toEqual({
      req_key: 'pippit_iv2v_cvtob_master',
      product_name: '茶饮',
      product_img_url_list: ['https://cdn.example.com/product.png'],
      model_img_url_list: ['https://cdn.example.com/model.png']
    });
  });

  it('builds a signed visual request with the task-bound credential scope', () => {
    const request = buildSignedVisualRequest({
      action: 'CVSync2AsyncSubmitTask',
      version: '2022-08-31',
      credentials: {
        accountId: 'account-1',
        accessKeyId: 'ak-xiao',
        secretAccessKey: 'sk-xiao',
        endpoint: 'https://visual.volcengineapi.com',
        region: 'cn-north-1',
        service: 'cv'
      },
      body: { req_key: 'pippit_iv2v_cvtob_master' },
      now: new Date('2026-06-13T08:00:00.000Z')
    });

    expect(request.url).toBe(
      'https://visual.volcengineapi.com/?Action=CVSync2AsyncSubmitTask&Version=2022-08-31'
    );
    expect(request.init.method).toBe('POST');
    expect(request.init.body).toBe('{"req_key":"pippit_iv2v_cvtob_master"}');
    expect(request.init.headers).toMatchObject({
      'content-type': 'application/json',
      host: 'visual.volcengineapi.com',
      'x-date': '20260613T080000Z'
    });
    expect(request.init.headers.authorization).toContain(
      'Credential=ak-xiao/20260613/cn-north-1/cv/request'
    );
    expect(request.init.headers.authorization).toContain(
      'SignedHeaders=content-type;host;x-content-sha256;x-date'
    );
  });

  it('submits through the supplied fetcher and normalizes the async task response', async () => {
    const client = createVolcengineClient({
      now: () => new Date('2026-06-13T08:00:00.000Z'),
      fetcher: async (url, init) => {
        expect(url).toContain('Action=CVSync2AsyncSubmitTask');
        expect(init.headers.authorization).toContain('Credential=ak-xiao/');
        return {
          json: async () => ({
            code: 10000,
            data: { task_id: '7392616336519610409' },
            message: 'Success',
            request_id: 'request-1'
          })
        };
      }
    });

    await expect(
      client.submitTask({
        credentials: {
          accountId: 'account-1',
          accessKeyId: 'ak-xiao',
          secretAccessKey: 'sk-xiao',
          endpoint: 'https://visual.volcengineapi.com',
          region: 'cn-north-1',
          service: 'cv'
        },
        payload: {
          req_key: 'pippit_iv2v_cvtob_master',
          product_name: '茶饮',
          product_img_url_list: ['https://cdn.example.com/product.png']
        },
        task: undefined
      })
    ).resolves.toEqual({
      apiTaskId: '7392616336519610409',
      requestId: 'request-1',
      status: 'in_queue'
    });
  });

  it('queries through the supplied fetcher and normalizes done responses', async () => {
    const client = createVolcengineClient({
      now: () => new Date('2026-06-13T08:00:00.000Z'),
      fetcher: async (url, init) => {
        expect(url).toContain('Action=CVSync2AsyncGetResult');
        expect(init.body).toContain('remote-task-1');
        return {
          json: async () => ({
            code: 10000,
            data: {
              status: 'done',
              video_url: 'https://cdn.example.com/result.mp4',
              resp_data: '{"Duration":"5.05"}'
            },
            message: 'Success',
            request_id: 'request-query-1'
          })
        };
      }
    });

    await expect(
      client.getTaskResult({
        credentials: {
          accountId: 'account-1',
          accessKeyId: 'ak-xiao',
          secretAccessKey: 'sk-xiao',
          endpoint: 'https://visual.volcengineapi.com',
          region: 'cn-north-1',
          service: 'cv'
        },
        apiTaskId: 'remote-task-1'
      })
    ).resolves.toEqual({
      requestId: 'request-query-1',
      status: 'done',
      videoUrl: 'https://cdn.example.com/result.mp4',
      respData: '{"Duration":"5.05"}'
    });
  });
});
