# YQhub

YQhub 是本地运行的小云雀视频生成工作台。桌面端面向普通用户，只需要填写小云雀官网发放的 `ak-...` API Key；素材、草稿、队列和历史保存在本机。

## 当前能力

- 默认接入 `seedance2.0fast`。
- 支持多个本地 API Key，任务按账号绑定，互不串用。
- 拖拽或选择图片、视频、音频素材。
- 图片、视频会通过 Relay 转成公网 URL；音频目前只作为标注文案进入提示词。
- 素材标注会合并进最终提示词，例如“图一是萧衍”“视频一是动作参考”。
- 支持提示词、时长、画幅比例、队列进度和生成历史。
- 生成完成后会立即下载到 `~/Movies/YQhub/exports`。
- 可构建 macOS DMG 和 Windows NSIS 安装包。

## 为什么需要 Relay

Seedance 官方接口仍要求公网可访问的参考图片/视频 URL，并且火山引擎视觉接口使用服务端签名。为了让普通用户不处理公网 URL、不填写 Secret Key，YQhub 拆成两层：

- 桌面端：只保存用户填写的 API Key，上传本地素材数据。
- Relay：校验 API Key、临时托管素材、生成公网 URL、签名调用 `visual.volcengineapi.com`。

因此，真正给小白一键使用前，还需要部署一个公网 Relay，并把允许使用的 API Key 配到 Relay 环境变量里。不要把真实 API Key 写进源码或提交记录。

## 真正可用的部署顺序

1. 部署 Relay 到一个支持长期运行 Node 服务的平台，例如 VPS、Railway、Render、Fly.io 或同类 Docker 服务。
2. 给 Relay 配 HTTPS 域名，例如 `https://relay.example.com`。
3. 在 Relay 环境变量里配置 `YQHUB_ALLOWED_KEYS`、`YQHUB_PUBLIC_BASE_URL` 和 `VOLCENGINE_*`。
4. 确认 `https://relay.example.com/health` 返回 `{"ok":true}`。
5. 在 GitHub 仓库变量里设置 `YQHUB_RELAY_URL=https://relay.example.com`。
6. 重新运行 GitHub Actions 的 `Build Installers`，下载新的 macOS/Windows 安装包。
7. 普通用户安装后只填写允许列表里的 `ak-...` API Key。

## Relay 环境变量

```bash
YQHUB_ALLOWED_KEYS="ak-xxx,ak-yyy"
YQHUB_PUBLIC_BASE_URL="https://your-relay.example.com"
YQHUB_ASSET_DIR="/var/lib/yqhub/assets"

VOLCENGINE_ACCESS_KEY_ID="..."
VOLCENGINE_SECRET_ACCESS_KEY="..."
VOLCENGINE_ENDPOINT="https://visual.volcengineapi.com"
VOLCENGINE_REGION="cn-north-1"
VOLCENGINE_SERVICE="cv"
PORT="8787"
```

`YQHUB_ALLOWED_KEYS` 是普通用户在桌面端填写的 API Key 允许列表。`VOLCENGINE_*` 只放在 Relay 服务端。

## Docker 启动 Relay

在服务器上创建 `.env`，内容参考 `.env.example`，然后运行：

```bash
docker compose -f docker-compose.relay.yml up -d --build
```

如果使用反向代理或平台自带 HTTPS，`YQHUB_PUBLIC_BASE_URL` 必须填写外部可访问的 HTTPS 地址。`/assets/...` 会公开访问，因为官方视频接口需要直接拉取参考图片和视频。

## 开发运行

```bash
npm install
npm run electron:start
```

## Relay 构建与启动

```bash
npm run relay:build
npm run relay:start
```

桌面端默认连接 `YQHUB_RELAY_URL` 指定的 Relay；没有设置时会使用占位地址 `https://relay.yqhub.local`。
GitHub Actions 也会读取仓库变量 `YQHUB_RELAY_URL`，并把它写入安装包。

## 验证

```bash
npm run check
npm audit
```

## 打包

```bash
npm run release:local
```

最终交付文件会统一放在 `release/YQhub-v版本号/`：

- `YQhub-版本号-mac-universal.dmg`：macOS Apple Silicon / Intel 通用安装包。
- `YQhub-版本号-windows-x64.exe`：Windows x64 安装包。
- `SHA256SUMS.txt`：安装包校验和。
- `manifest.json`：版本、平台、文件大小和校验信息。

GitHub Actions 也只上传这个版本化目录。未配置代码签名证书时，系统可能提示未验证开发者。
