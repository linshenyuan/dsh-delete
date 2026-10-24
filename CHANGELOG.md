# 更新日志

本项目的所有重要变更都记录在这里。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-10-24

首个可用版本。面向 DSH（DeepSeek Harness）桌面端 0.2.1-rc.3。

### 新增

- 会话右键菜单（`⋯`）最下方新增「删除对话」，红色文字，`order: 500`，排在「复制 Session ID」之后。
- 快捷键 `Ctrl + Alt + D`，仅在本页生效，输入框内不触发。
- 二次确认弹窗：显示会话标题、不可恢复提示、红色描边的删除按钮。
- 支持 `Esc` 关闭弹窗，打开时自动聚焦。
- 删除时同步清理三处：会话目录、投影缓存、`workspace.json` 里的归档/置顶名单。
- 删除完成后广播 `api-session/removed`，侧边栏那一行**当场消失**，不刷新页面。
- 中英文双语（`locale/zh.json`、`locale/en.json`），并带 `meta.title` / `meta.description` 与图标。

### 安全

- `sessionId` 必须匹配 `^(?:session-)?<UUID>$`，拼出的路径 `resolve` 后必须仍在 sessions 根下。
- 用 `lstat` 判本体，符号链接 / junction 直接拒绝删除。
- 每个请求先过 `connection.requestRejection`（Host/Origin 栅栏 + 登录 cookie），拿不到栅栏则退化为 loopback 判定。
- 请求体 `content-length` 与流式累计双上限 64 KiB。
- 宿主侧串行化，同时只允许一个删除在跑。
- 响应不回传绝对路径。

### 修复

开发过程中踩到并修复的坑，均已写入 README 的「开发笔记」：

- 客户端 `inject.hooks` 传 hook 函数会被当成延迟工厂，必须传 `{getSnapshot, subscribe}` 快照 store。
- `use<Name>(selector)` 的 selector 是必填参数，无参调用抛 `selector is not a function`，
  会把整条 slot entry 判为崩溃。
- 客户端 `ctx` 是白名单代理，`shortcuts` 必须写进 `inject`，`ctx.get` 因 strict 语义拿不到未就绪服务。
- 按官方规范不再加载 `@deepseek-ai/dsh-client-ui-primitives`，控件全部自绘。
- 早期版本用 `window.location.reload()` 更新列表，已改为广播 `api-session/removed`。
- 会话 id 存在 `session-<uuid>` 与裸 `<uuid>` 两种形态，只认裸 UUID 会漏掉一半。
