# 更新记录

## 1.0.4 · 2026-10-19

- 移除运行时未使用的 TypeScript preload 副本，统一以实际打包的 CommonJS preload 为准。
- 修正文档中的 Electron 桥接入口路径。
- 新增针对实际 CommonJS preload 的九个原生 API、IPC 通道和参数转发回归测试。
