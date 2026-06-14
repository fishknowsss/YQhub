# YQhub 小云雀工作台全流程制作计划

## 1. 项目定位

YQhub 是本地运行的 Seedance 2.0 Fast 视频生成工作台。应用运行在用户自己的电脑上，账号、草稿、素材、队列和历史都保存在本机，不做云端网站、不做统一登录。

主线要求：

- UI 保持 Seedance 视频生成工作台，不改成营销成片商品图表单。
- 用户只填写小云雀官网发放的 `ak-...` API Key。
- 后端不调用旧直连接口，改走小云雀 Skill / Seedance 生成入口。
- 每个任务固定绑定创建时选择的账号，避免多账号串用。

## 2. 当前范围

保留：

- 本地添加多个 `ak-...` API Key。
- 拖拽、点击选择、粘贴上传图片、视频、音频。
- 素材标注，例如“图一是萧衍”“视频一是动作参考”“音频一是旁白参考”。
- 提示词编辑、草稿缓存、一键清空。
- 时长、清晰度、画幅比例选择。
- 生成队列、状态、进度估算、预计时间。
- 生成历史和本地下载记录。
- 浅色/深色模式，默认浅色工作台。

移除：

- 云端上线网站。
- 真名注册、固定口令、统一用户系统。
- Relay 服务、公网素材托管、Docker 部署。
- 额外密钥表单。
- 偏离 Seedance 工作台的商品信息表单。
- 旧直连域名和旧模型 ID。

## 3. 接口策略

YQhub 主进程使用小云雀官网“连接 Agent”对应的 Skill API：

- Endpoint：`https://xyq.jianying.com`
- 上传素材：`POST /api/biz/v1/skill/upload_file`
- 提交任务：`POST /api/biz/v1/skill/submit_run`
- 查询任务：`POST /api/biz/v1/skill/get_thread`
- 鉴权：`Authorization: Bearer <ak-...>`
- 输出：查询成功后从 `biz/x_data_video.data.video.download_url` 取得成片。

请求体保持 Seedance 工作台语义：

- `agent_name`: `pippit_video_part_agent`
- `message`: 提示词加素材标注合成后的文本。
- `video_part_tool_param.prompt`: 同 `message`。
- `video_part_tool_param.model`: `seedance2.0_fast_direct`
- `video_part_tool_param.duration_sec`
- `video_part_tool_param.resolution`
- `video_part_tool_param.ratio`
- `video_part_tool_param.images/videos/audios`: 本地素材上传后得到的 `pippit_asset_id`。

仓库里的《小云雀-营销成片Agent-接口文档》只作为历史参考。它不是 YQhub 当前接口实现或前端表单的设计依据。

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

## 5. 生成流程

```text
用户添加 ak-... API Key
→ 选择当前账号
→ 上传参考素材并填写标注
→ 编辑提示词和视频参数
→ 本地生成 finalPrompt
→ Electron 主进程读取该账号 API Key
→ 上传本地素材并取得 pippit_asset_id
→ 调用小云雀 Skill 提交接口
→ 返回 thread_id 和 run_id 后进入队列
→ 定时查询任务状态
→ 成功后读取 download_url
→ 下载到本机并写入历史
```

## 6. 多账号策略

- 每个任务创建时写入 `accountId`。
- 提交和查询都使用该任务绑定账号的 API Key。
- 切换账号只影响下一次生成。
- 历史不会因为删除或切换账号而消失。
- API Key 不进入前端缓存和导出包。

## 7. 交付物

本地 release 统一输出到：

```text
release/YQhub-v{version}/
```

包含：

- `YQhub-{version}-mac-arm64.dmg`
- `YQhub-{version}-win-x64.exe`
- `SHA256SUMS.txt`
- `manifest.json`

macOS 只交付 Apple Silicon arm64 版本。

## 8. 验证要求

交付前必须完成：

- `npm run test`
- `npm run build`
- `npm run electron:build`
- 本地桌面端启动验证。
- 单屏工作台视觉检查。
- 小云雀真实提交或真实接口错误验证。
- 安装包目录和版本号检查。

如果真实 `ak-...` 被上游接口拒绝，YQhub 必须展示明确错误，不得伪造成可生成。
