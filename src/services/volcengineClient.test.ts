import { describe, expect, it } from 'vitest';
import { buildSubmitPayload } from './volcengineClient';

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
});
