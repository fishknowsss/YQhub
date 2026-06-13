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

GitHub Actions 会构建 macOS 和 Windows 安装包。未配置代码签名证书时，系统可能提示未验证开发者。
