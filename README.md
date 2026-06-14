# YQhub

YQhub 是本地运行的小云雀视频生成工作台。用户只需要填写小云雀官网发放的 `ak-...` API Key；账号、草稿、素材标注、队列和历史都保存在本机。

## 当前能力

- 默认使用 Seedance 2.0 Fast，对应 Ark Model ID：`doubao-seedance-2-0-fast-260128`。
- 支持多个本地 API Key，每个任务绑定提交时选择的账号，不会串用。
- 支持拖拽、选择或粘贴图片、视频、音频素材。
- 支持素材标注，例如“图一是萧衍”“视频一是动作参考”“音频一是旁白参考”。
- 支持提示词、时长、清晰度、画幅、队列进度和生成历史。
- 生成完成后自动下载到 `~/Movies/YQhub/exports`。
- 支持 macOS Apple Silicon DMG 和 Windows x64 安装包。

## 接口方式

桌面端直接调用火山方舟视频生成 API：

- 创建任务：`POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks`
- 查询任务：`GET https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/{id}`
- 鉴权：`Authorization: Bearer ak-...`

参考图片会以 `image_url` 内容项提交，可使用本地文件转出的 Base64 Data URL。音频参考同样支持 Base64 Data URL。官方视频参考字段只接受视频 URL 或 Ark 素材 ID，因此当前直连模式不会把本地视频文件伪装成 `video_url` 提交。

## 开发运行

```bash
npm install
npm run electron:start
```

## 验证

```bash
npm run check
```

## 打包

```bash
npm run release:local
```

最终交付文件统一放在 `release/YQhub-v版本号/`：

- `YQhub-版本号-mac-arm64.dmg`：macOS Apple Silicon 安装包。
- `YQhub-版本号-windows-x64.exe`：Windows x64 安装包。
- `SHA256SUMS.txt`：安装包校验和。
- `manifest.json`：版本、平台、文件大小和校验信息。

未配置代码签名证书时，系统可能提示未验证开发者。
