# YQhub

YQhub 是本地运行的小云雀工作台，用于在自己的电脑上接入火山引擎视觉异步任务 API 生成视频。它不是云端网站，不做统一登录；每个使用者在本机添加自己的 API 账号，草稿、任务、历史和账号元数据都保存在本地。

## 现在能做什么

- 管理多个本地 API 账号。
- 每个任务绑定自己的账号，单人多账号也不会共用全局密钥。
- Secret Access Key 只在 Electron 主进程保存，前端只拿账号元数据。
- 拖拽或选择图片、视频、音频素材。
- 给素材填写标注，例如“图一是萧衍”。
- 为素材填写公网 URL，真实提交前会阻止本地路径直传。
- 编辑提示词，选择模型、时长和分辨率。
- 提交、查询生成进度，并在完成后下载到 `~/Movies/YQhub/exports`。
- 通过 GitHub Actions 构建 macOS 和 Windows 安装包。

## 真实可用还需要什么

真实调用火山引擎接口必须同时具备：

- Access Key ID。
- 对应的 Secret Access Key。
- 至少 1 个公网可访问的 jpg/png 图片 URL。
- 使用已确认映射的 `pippit_iv2v_cvtob_master` 模型。

只有 Access Key 不能完成真实测试，因为接口签名必须 AK/SK 成对。当前文档没有补齐 `seedance2.0fast` 的真实提交字段，所以 YQhub 不会伪造字段提交该模型。

## 普通用户怎么用

1. 下载适合自己系统的安装包。
2. 打开 YQhub。
3. 添加账号：填写账号名、Access Key、Secret Key。
4. 添加素材，并填写素材的公网 URL。
5. 写提示词，选择模型、时长和分辨率。
6. 点击“生成”。
7. 生成完成后，视频会保存到本机 `Movies/YQhub/exports`。

## 开发运行

```bash
npm install
npm run electron:start
```

## 验证

```bash
npm run check
npm audit
```

## 打包

```bash
npm run dist:mac
npm run dist:win
```

macOS 和 Windows 成品也可以在 GitHub Actions 的 `Build Installers` 工作流里生成。macOS/Windows 的完全免提示安装需要代码签名证书；当前配置会生成未签名安装包。

## 安全约束

- 不要把 AK/SK 写进源码、README、测试或提交记录。
- 不要把本地文件路径当成接口素材 URL。
- 真实素材需要公网 URL，或者后续接入对象存储上传服务。
- 各用户在各自电脑上保存自己的账号，不使用共享云端密钥。
