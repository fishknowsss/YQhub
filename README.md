# YQhub

YQhub 是本地运行的小云雀 Seedance 2.0 视频生成工作台。用户只填写小云雀官网发放的 `ak-...` API Key；账号、草稿、素材标注、队列和历史都保存在本机。

## 当前能力

- 默认调用小云雀 `Seedance_2.0_mini`，并保留 `seedance2.0_fast_direct` 作为备选模型。
- 支持多个本地 API Key，每个任务绑定提交时选择的账号，不会串用。
- 支持拖拽、选择或粘贴图片、视频、音频素材。
- 支持素材标注，例如“图一是萧衍”“视频一是动作参考”“音频一是旁白参考”。
- 支持提示词、时长、清晰度、画幅、队列进度和生成历史。
- 生成完成后自动下载到 `~/Movies/YQhub/exports`。
- 支持 macOS Apple Silicon DMG 和 Windows x64 安装包。

## 接口方式

桌面端使用小云雀官网“连接 Agent”发放的 `ak-...` Access Key。用户不需要准备公网 URL，本地图片、视频、音频会先上传到小云雀 Skill 接口，再用返回的 `pippit_asset_id` 提交生成。

- 上传素材：`POST https://xyq.jianying.com/api/biz/v1/skill/upload_file`
- 提交任务：`POST https://xyq.jianying.com/api/biz/v1/skill/submit_run`
- 查询任务：`POST https://xyq.jianying.com/api/biz/v1/skill/get_thread`
- 鉴权：`Authorization: Bearer <ak-...>`
- 生成参数：`agent_name: "pippit_video_part_agent"`，默认 `video_part_tool_param.model: "Seedance_2.0_mini"`。

仓库里的《小云雀-营销成片Agent-接口文档》只保留为历史参考；它不是 YQhub 当前生成链路的实现依据。YQhub 以小云雀 Skill / Seedance 2.0 工作台为准。

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
