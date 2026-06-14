# YQhub 小云雀工作台全流程制作计划

## 1. 项目定位

YQhub 是本地运行的视频生成工作台，面向只会填写 `ak-...` API Key 的普通用户。应用运行在用户自己的电脑上，账号、草稿、素材、队列和历史都保存在本机，不做云端网站、不做统一登录、不要求用户填写 Secret Key 或公网素材地址。

目标模型是 Seedance 2.0 Fast。当前实现优先接入火山方舟内容生成异步任务 API：

- 提交：`POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks`
- 查询：`GET https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/{task_id}`
- 鉴权：`Authorization: Bearer ak-...`
- 模型 ID：`doubao-seedance-2-0-fast-260128`

## 2. 当前范围

保留：

- 本地添加多个 `ak-...` API Key。
- 每个任务固定绑定创建时选择的账号，避免多账号串用。
- 拖拽、点击选择、粘贴上传图片、视频、音频。
- 素材标注，例如“图一是萧衍”“视频一是动作参考”“音频一是旁白参考”。
- 当前直连提交支持本地图片和本地音频 Base64；本地视频只做预览和标注，除非上游提供 Ark 素材 ID 或视频 URL。
- 提示词编辑、草稿缓存、一键清空。
- 时长、清晰度、画幅比例选择。
- 生成队列、状态、进度估算、预计时间。
- 生成历史和本地下载记录。
- 浅色/深色模式，默认浅色红白工作台。

移除：

- 云端上线网站。
- 真名注册、固定口令、统一用户系统。
- Relay 服务、公网素材托管、Docker 部署。
- 让用户填写 Secret Key、公网 URL 或任何服务端参数。
- 营销成片 Agent 专用接口作为主路径。

## 3. 关键事实

用户提供的《小云雀-营销成片Agent-接口文档》描述的是火山视觉营销成片 Agent：

- 接口域名是 `visual.volcengineapi.com`。
- 需要火山签名鉴权。
- 固定 `req_key=pippit_iv2v_cvtob_master`。
- 图片输入要求公网 URL。

这份文档不是 Seedance 2.0 Fast 的直连视频生成接口。YQhub 不再把它当作主实现依据，只保留为接口对照资料。

## 4. 产品结构

```text
AppShell
├─ TopBar
│  ├─ YQhub 标识
│  ├─ 保存/桌面端/任务状态
│  └─ 深浅色切换
└─ Workbench
   ├─ AssetPanel
   │  ├─ 账号选择
   │  ├─ 账号添加
   │  ├─ 素材上传
   │  └─ 素材标注
   ├─ ComposerPanel
   │  ├─ 视频预览舞台
   │  ├─ 提示词
   │  ├─ 模型/时长/清晰度/画幅
   │  └─ 生成操作
   └─ QueuePanel
      ├─ 当前队列
      ├─ 完成历史
      └─ 缓存清理
```

窗口本身不滚动。三列内部独立滚动，避免用户在桌面端上下左右找内容。

## 5. 数据结构

### API 账号

- `id`
- `name`
- `apiKeyPreview`
- `apiKeyRef`
- `concurrencyLimit`
- `enabled`
- `createdAt`
- `updatedAt`

Renderer 只保存脱敏信息。Electron 主进程负责加密保存原始 API Key。

### 参考素材

- `id`
- `type`：`image`、`video`、`audio`
- `label`
- `localName`
- `previewUrl`
- `dataUrl`
- `mimeType`
- `uploadStatus`

### 生成任务

- `id`
- `accountId`
- `model`
- `prompt`
- `finalPrompt`
- `assets`
- `duration`
- `resolution`
- `ratio`
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

## 6. 生成流程

```text
用户添加 ak-... API Key
→ 选择当前账号
→ 上传参考素材并填写标注
→ 编辑提示词和视频参数
→ 本地生成 finalPrompt
→ Electron 主进程读取该账号 API Key
→ 调用 Ark 任务提交接口
→ 返回 task_id 后进入队列
→ 定时查询任务状态
→ 成功后读取 video_url
→ 下载到本机并写入历史
```

## 7. 多账号策略

- 每个任务创建时写入 `accountId`。
- 提交和查询都使用该任务绑定账号的 API Key。
- 切换账号只影响下一次生成。
- 历史不会因为删除或切换账号而消失。
- API Key 不进入前端缓存和导出包。

## 8. 进度策略

官方异步接口不返回稳定百分比时，YQhub 使用状态估算：

- `in_queue`：排队，约 18%。
- `processing`：处理中，约 35%。
- `generating`：生成中，约 72%。
- `done`：完成，100%。
- `failed` / `expired` / `not_found`：停止并显示原因。

预计时间只显示估算值，不编造精确秒数。

## 9. 交付物

本地 release 统一输出到：

```text
release/YQhub-v{version}/
```

包含：

- `YQhub-{version}-mac-arm64.dmg`
- `YQhub-{version}-win-x64.exe`
- `SHA256SUMS.txt`

macOS 只交付 Apple Silicon arm64 版本。

## 10. 验证要求

交付前必须完成：

- `npm run test`
- `npm run build`
- `npm run electron:build`
- 本地桌面端启动验证。
- 单屏工作台视觉检查。
- API Key 真实提交或真实接口错误验证。
- 安装包目录和版本号检查。

如果真实 `ak-...` 被上游接口拒绝，YQhub 必须展示明确错误，不得伪造成可生成。
