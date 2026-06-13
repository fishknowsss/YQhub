# 小云雀本地生成端

本项目是本地运行的视频生成客户端原型，不是云端网站。每个使用者在自己的电脑上配置自己的 API 账号，草稿、任务、历史和账号元数据保存在本地，不做统一登录、真名注册或固定口令。

## 当前进度

- Vite + React + TypeScript 主界面。
- 本地多 API 账号管理。
- 任务创建时绑定 `accountId`。
- 草稿、账号和任务通过版本化 storage key 自动保存。
- 支持素材拖拽、点击选择、标注输入。
- 支持为素材填写公网 URL，真实提交前会阻止本地路径直传。
- 支持提示词、模型、时长、分辨率选择。
- 支持 Mock 生成队列、进度条和生成历史。
- 已建立模型能力层，`seedance2.0fast` 标记为 `pending-docs`。
- 已建立火山引擎提交 payload 适配层，只映射文档已确认的 `pippit_iv2v_cvtob_master` 字段。
- Electron 环境下生成任务会走主进程提交、查询和下载服务。

## 本地运行

```bash
npm install
npm run dev
```

## 本地桌面端

```bash
npm run electron:start
```

Electron 版本通过 preload 暴露 `window.yqLocal`，新增账号时由主进程保存 Secret。Renderer 只拿到账号元数据和 `secretAccessKeyRef`。

## 验证

```bash
npm test
npm run build
npm run electron:build
```

## 关键约束

- `Secret Access Key` 不进入任务数据，只保存本地密钥引用。
- 本地文件路径不能作为接口素材 URL。
- 真实提交前，素材必须有公网可访问的 `publicUrl`。
- `seedance2.0fast` 的真实提交字段未补齐前，不生成伪造请求字段。
- 已知接口模型 `pippit_iv2v_cvtob_master` 只支持当前文档确认的图片字段。

## 真实 API 测试前置

真实提交需要同时具备：

- Access Key ID
- Secret Access Key
- 至少 1 个公网可访问 jpg/png 图片 URL
- 使用已确认映射的 `pippit_iv2v_cvtob_master`

不要把 AK/SK 写进源码、README、测试或提交记录。真实凭据只应通过本地客户端账号入口录入。

## 后续阶段

1. 接入 Electron 主进程。
2. 使用 `safeStorage` 或系统 Keychain 保存真实密钥。
3. 通过 IPC 调用 API、队列、下载和本地文件服务。
4. 补充对象存储上传服务，把本地素材转换为公网 URL。
5. 打包为 macOS 本地应用。
