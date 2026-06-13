# YQhub 小云雀工作台全流程制作计划

## 1. 项目定位

YQhub 是本地运行的小云雀视频生成工作台，目标模型是 `seedance2.0fast`。普通用户只在桌面端填写小云雀官网发放的 `ak-...` API Key，不填写 Secret Key，不处理公网 URL，不使用云端统一账号系统。

第一版采用“本地桌面端 + Relay 服务”的结构：

- 桌面端负责素材选择、标注、提示词、队列、进度和历史。
- Relay 负责校验 API Key、临时托管本地素材、生成公网 URL、签名调用火山引擎视觉异步任务 API。

## 2. 范围调整

保留：

- 拖拽、点击选择、粘贴上传图片、视频、音频素材。
- 图片和视频可作为 Seedance 参考素材；音频第一版只作为标注文案进入提示词。
- 素材标注，例如“图一是萧衍”“视频一是动作参考”。
- 提示词编辑、自动缓存、清空草稿。
- `seedance2.0fast` 模型、时长、画幅比例选择。
- 生成按钮、队列、进度条、预计时间、生成历史。
- 完成后立即下载视频到本地，避免远程 `video_url` 过期。
- 多 API Key 本地管理，任务按账号绑定，单人多账号互不串用。

移除：

- 云端上线网站。
- 统一用户系统、真名登记、固定口令。
- 让普通用户填写 Secret Key。
- 让普通用户填写素材公网 URL。

## 3. 接口依据

目标接口为火山引擎视觉异步任务模式：

- 接口地址：`https://visual.volcengineapi.com`
- 提交任务：`Action=CVSync2AsyncSubmitTask&Version=2022-08-31`
- 查询任务：`Action=CVSync2AsyncGetResult&Version=2022-08-31`
- 固定鉴权参数：`Region=cn-north-1`，`Service=cv`

`seedance2.0fast` 对应“小云雀-智能生视频 Agent 2.0 有参考”文档：

- `req_key`：`pippit_iv2v_v20_cvtob_with_vinput`
- `prompt`：必填，最终提示词。
- `img_url_list`：可选，参考图片公网 URL，图片和视频总数不超过 50。
- `video_url_list`：可选，参考视频公网 URL。
- `ratio`：可选，`16:9`、`9:16`、`4:3`、`3:4`。
- `duration`：可选，`～15s`、`～30s`、`40～60s`。
- `language`：默认 `Chinese`。

查询接口使用同一个 `req_key` 和 `task_id`。查询成功后读取：

- `status`
- `video_url`
- `resp_data`
- `request_id`

状态包括 `processing`、`in_queue`、`generating`、`done`、`not_found`、`expired`。

## 4. 总体架构

```text
YQhub Desktop
  ├─ React UI
  ├─ Electron Main
  ├─ 本地草稿/任务/历史
  └─ 用户 API Key 安全保存
        │
        ▼
YQhub Relay
  ├─ 校验 x-yqhub-api-key
  ├─ 保存素材到临时目录
  ├─ 以公网 URL 暴露图片/视频
  ├─ 生成 Seedance 请求体
  └─ 用服务端 VOLCENGINE_* 密钥签名调用官方接口
```

普通用户只接触桌面端。Relay 部署者配置：

- `YQHUB_ALLOWED_KEYS`
- `YQHUB_PUBLIC_BASE_URL`
- `YQHUB_ASSET_DIR`
- `VOLCENGINE_ACCESS_KEY_ID`
- `VOLCENGINE_SECRET_ACCESS_KEY`
- `VOLCENGINE_ENDPOINT`
- `VOLCENGINE_REGION`
- `VOLCENGINE_SERVICE`

## 5. 页面布局

主界面是单屏工作台，不做营销页。

```text
AppShell
├─ TopBar
│  ├─ 当前账号
│  ├─ 账号数量
│  └─ 保存状态
├─ ComposePanel
│  ├─ AccountPanel
│  │  ├─ 当前账号选择
│  │  ├─ 账号名
│  │  └─ API Key
│  ├─ AssetDropzone
│  ├─ AssetGrid
│  │  └─ AssetCard
│  │     ├─ 预览
│  │     └─ 标注
│  ├─ PromptEditor
│  │  ├─ 提示词
│  │  ├─ 模型
│  │  ├─ 时长
│  │  └─ 画幅比例
│  └─ GenerateBar
│     ├─ 清空
│     └─ 生成
└─ TaskPanel
   ├─ QueueList
   └─ HistoryList
```

界面文案保持短、直接、中文自然，不展示实现说明。

## 6. 核心数据结构

### API 账号

- `id`
- `name`
- `apiKeyPreview`
- `apiKeyRef`
- `relayEndpoint`
- `concurrencyLimit`
- `enabled`
- `createdAt`
- `updatedAt`

桌面端不把原始 API Key 写入 renderer storage。Electron 主进程用本地 vault 保存原始 API Key。

### 参考素材

- `id`
- `type`：`image`、`video`、`audio`
- `label`
- `localName`
- `previewUrl`
- `dataUrl`
- `mimeType`
- `publicUrl`
- `uploadStatus`

桌面端提交给 Relay 时带 `dataUrl`，Relay 上传后补 `publicUrl`。

### 生成任务

- `id`
- `accountId`
- `model`
- `prompt`
- `finalPrompt`
- `assets`
- `duration`
- `resolution`
- `apiTaskId`
- `status`
- `progress`
- `etaSeconds`
- `videoUrl`
- `localVideoPath`
- `errorCode`
- `errorMessage`
- `requestId`
- `createdAt`
- `updatedAt`

## 7. 任务流程

### 生成

```text
用户添加 API Key
→ 上传图片/视频/音频
→ 填写素材标注
→ 填写提示词
→ 生成 finalPrompt
→ 桌面端提交 task 到 Relay
→ Relay 校验 API Key
→ Relay 保存图片/视频并生成公网 URL
→ Relay 构造 Seedance 请求体
→ Relay 签名调用官方提交接口
→ 返回 task_id
→ 桌面端进入队列
```

Seedance 提交体：

```json
{
  "req_key": "pippit_iv2v_v20_cvtob_with_vinput",
  "prompt": "提示词和素材标注",
  "img_url_list": ["https://relay.example.com/assets/xxx.png"],
  "video_url_list": ["https://relay.example.com/assets/xxx.mp4"],
  "ratio": "16:9",
  "duration": "～15s",
  "language": "Chinese"
}
```

### 查询

```text
按 apiTaskId 轮询
→ Relay 用 model 还原 req_key
→ 调用官方查询接口
→ 返回 status / video_url / resp_data / request_id
→ 桌面端更新进度
→ done 且有 video_url 时立即下载
```

### 本地保存

默认保存到：

```text
~/Movies/YQhub/exports/YYYY-MM-DD/task-id.mp4
```

历史优先打开本地文件，远程 `video_url` 只作为备用记录。

## 8. 多账号不冲突

每个任务固定绑定 `accountId`：

- 提交、查询、下载都使用同一个账号的 API Key。
- 切换账号只影响下一次生成，不改已有任务。
- 历史按任务保存，不随账号删除而清空。
- 同一桌面端可以添加多个 API Key，互不共用任务状态。

Relay 使用 `YQHUB_ALLOWED_KEYS` 校验用户 API Key。不同用户如果使用不同本地端和不同 API Key，不会共享桌面端本地状态。

## 9. 进度与预计时间

官方接口只返回状态，不返回精确百分比。前端使用状态估算：

- `in_queue`：排队中，约 18%。
- `processing`：处理中，约 35%。
- `generating`：生成中，约 72%。
- `done`：已完成，100%。
- `not_found` / `expired`：不可继续。

没有足够历史数据时预计时间显示“估算中”，不编造精确秒数。

## 10. 错误处理

用户侧提示保持短句：

- API Key 不可用。
- 素材数据格式不正确。
- 仅支持 jpg、png、mp4、mov、webm 参考素材。
- 提示词没有通过审核，请修改后重试。
- 生成失败，可以重试一次。
- 任务已过期，请重新生成。

技术信息保存在任务记录中：

- `errorCode`
- `errorMessage`
- `requestId`
- `respData`

## 11. 打包与交付

桌面端：

- macOS：DMG。
- Windows：NSIS 安装包。
- GitHub Actions 自动构建。

Relay：

- `npm run relay:build` 输出 `dist-relay/relayServer.js`。
- `npm run relay:start` 启动服务。
- 部署环境必须有公网 HTTPS 域名，否则官方接口无法读取参考素材。

## 12. 当前仍差的真实可用条件

代码层可以做完桌面端和 Relay，但真正让小白直接使用还差：

1. 部署一个公网 HTTPS Relay。
2. 在 Relay 环境变量里配置允许使用的用户 API Key。
3. 在 Relay 环境变量里配置服务端火山引擎签名密钥。
4. 确认用户 API Key 在小云雀官网侧已开通对应模型权限。
5. 用真实素材和真实 API Key 做一次端到端提交、查询、下载验证。

不应该把真实 API Key 或签名密钥提交到 GitHub。

## 13. 自检

- 桌面端只让用户填写 API Key。
- 不要求普通用户填写公网 URL。
- 不再把营销成片 Agent 当作目标模型。
- `seedance2.0fast` 使用官方智能生视频 Agent 2.0 有参考字段。
- 图片和视频通过 Relay 转公网 URL。
- 素材标注会合并进 `finalPrompt`。
- 保留本地缓存、队列、进度、历史和下载。
- UI 不展示实现说明。
