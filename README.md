# YQhub

YQhub 是一个本地运行的 Electron 桌面工作台，用于通过小云雀 Skill API 调用 Seedance 2.0 生成视频。应用面向单机使用场景：账号、草稿、素材标注、任务队列、生成历史和导出目录都保存在本机，不提供云端多用户后台。

## 当前定位

- 用小云雀官网“连接 Agent”发放的 `ak-...` API Key 提交生成任务。
- 支持图片、视频、音频素材上传，并把素材标注合并到最终提示词。
- 支持 Seedance 2.0 Mini 和 Seedance 2.0 Fast 两个已映射模型。
- 支持时长、清晰度、画幅、输出文件名、当前任务和历史任务管理。
- 生成完成后自动下载 `.mp4` 到系统 Downloads，或用户在应用里选择的导出目录。
- 当前交付目标是 macOS Apple Silicon DMG 和 Windows x64 安装包。

## 生成链路

YQhub 不让渲染进程直接访问远端接口。React 界面只通过 preload 暴露的 `window.yqhub` 调用 Electron IPC，主进程负责账号密钥、任务提交、进度刷新和视频下载。

```text
React renderer
  -> electron/preload.ts
  -> electron/main.ts
  -> src/main/services/*
  -> src/services/xiaoyunqueClient.ts
  -> Xiaoyunque Skill API
```

远端接口以当前源码实现为准：

- `POST https://xyq.jianying.com/api/biz/v1/skill/upload_file`
- `POST https://xyq.jianying.com/api/biz/v1/skill/submit_run`
- `POST https://xyq.jianying.com/api/biz/v1/skill/get_thread`
- `Authorization: Bearer <ak-...>`
- `agent_name: "pippit_video_part_agent"`
- 默认模型：`Seedance_2.0_mini`
- 备选模型：`seedance2.0_fast_direct`

`docs/reference/` 中的接口资料只作为历史参考，不能直接等同于当前实现。

## 技术栈

- Electron 42
- React 19
- TypeScript 5
- Vite 8
- Vitest 4
- electron-builder 26
- electron-store + Electron `safeStorage`

## 目录结构

```text
.
├── electron/                  # Electron 主进程与 preload
├── src/
│   ├── domain/                # 领域类型、状态和持久化逻辑
│   ├── main/services/         # 账号、队列、任务刷新、下载服务
│   ├── services/              # 小云雀 Skill API 客户端
│   ├── shared/                # 模型能力配置
│   ├── App.tsx                # 主界面
│   └── styles.css             # 界面样式
├── scripts/                   # 构建、图标、发布整理脚本
├── docs/reference/            # 接口资料和历史参考
├── build/                     # 应用图标
└── release/                   # 本地安装包输出目录，已被 git 忽略
```

## 本地开发

建议使用 Node.js 24 和 npm 11，与当前开发环境保持一致。

```bash
npm ci
npm run electron:start
```

常用命令：

```bash
npm run dev             # 只启动 Vite renderer
npm run test            # 运行测试
npm run build           # TypeScript + renderer 构建
npm run electron:build  # 构建 Electron 主进程和 preload
npm run check           # test + build + electron:build
```

## 账号与本地数据

- API Key 必须是小云雀发放的 `ak-...` 格式。
- 账号列表保存在 Electron store 中。
- API Key 通过 Electron `safeStorage` 加密后写入本机 store。
- 主进程只向渲染进程返回脱敏后的 Key 预览。
- 默认导出目录是系统 Downloads；用户可在应用内选择新的保存位置。

不要把真实 API Key 写进 README、测试、截图、`.env` 或 issue。

## 发布

本项目的标准本地发布命令：

```bash
npm run release:local
```

该命令会先完成检查和双平台打包，再执行发布目录整理。最终交付文件统一放在：

```text
release/YQhub-v<version>/
```

目录内包含：

- `YQhub-<version>-mac-arm64.dmg`
- `YQhub-<version>-windows-x64.exe`
- `SHA256SUMS.txt`
- `manifest.json`
- `README.txt`

发布整理规则：

- 只保留当前版本目录和前一个版本目录。
- 删除更旧的 `YQhub-v*` 目录。
- 删除 `electron-builder` 留在 `release/` 根目录的临时安装器、blockmap、`latest*.yml`、`builder-debug.yml`、`mac-arm64/`、`win-unpacked/` 和 `.DS_Store`。

未配置代码签名证书时，macOS 或 Windows 可能提示未验证开发者。

## 质量检查

提交前至少运行：

```bash
npm run check
```

当前测试覆盖重点包括：

- 小云雀请求体、任务状态和错误归一化。
- 账号密钥存储与脱敏。
- 提交队列和任务刷新。
- 已完成任务的视频下载去重。
- 当前任务重复提交拦截。
- 当前任务列表布局和滚动行为。
- Electron IPC 与主进程行为。

## 公开仓库注意事项

本仓库公开后，源码、测试和文档会对外可见。请确保：

- 不提交 `.env`、`.env.*`、真实 API Key、账号截图或本地用户数据。
- 不提交 `dist/`、`dist-electron/`、`release/`、`node_modules/` 等生成产物。
- 安装包通过 GitHub Release、网盘或其他交付渠道发布，不直接提交到 git。
- 新增接口资料时标明“历史参考”或“当前实现依据”，避免 README 与源码再次漂移。

## License

当前仓库暂未添加开源许可证。除非后续补充 `LICENSE` 文件，否则默认不授予复制、分发或修改授权。
