import type { AssetReference } from '../domain/types';
import { MODEL_CAPABILITIES, type ModelId } from '../shared/modelCapabilities';

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
