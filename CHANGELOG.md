# 更新日志

本项目的所有重要变更都记录在这里。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.2.0] - 2026-11-01

新增批量删除。单删行为完全不变。

### 新增

- 会话右键菜单新增「批量删除…」，`order: 501`，紧跟在「删除对话」之后。
- 快捷键 `Ctrl + Alt + Shift + D` 打开批量删除弹窗。
- 批量删除弹窗：
  - 列出**所有工作区**的会话，按标题排序；
  - 默认**一个都不勾**，必须手动选；
  - 一次最多选 **5 个**，到上限后未勾选项自动禁用并提示；
  - 当前正在看的会话、空会话在列表里禁用并打标（`当前` / `空对话`）；
  - 顶部显示「共 N 个」，底部显示「已选 N / 上限 5」；
  - 删除按钮直接显示数量（`删除 3 个`）。
- 批量删除逐条执行，**部分失败不中断整批**：成功的照常删，失败的（正在运行 / 找不到 / 是符号链接）在弹窗里逐条列出原因，列表自动刷新。
- 全部成功才关弹窗；有失败则保留弹窗让用户看到原因。

### 服务端

- 新增 `deleteMany` 端点，入参 `{ sessionIds: string[] }`，1–5 个，自动去重保序。
- 单删逻辑抽成内部 `deleteOne(sessionId)`，单删与批量共用，安全校验完全一致
  （UUID 格式、路径越界、符号链接拒绝、运行中拒绝）。
- 批量与单删共用同一把「单飞」锁，避免两种操作并发。
- 超过 5 个直接整批拒绝（`dsh-delete/too-many`），不做部分执行。
- 返回 `{ requested, deleted: [...], skipped: [{sessionId, code, message}] }`。

### 测试

- 服务端离线测试 25 项全通过（假 `DSH_HOME`，不触碰真实数据）：
  单删回归、参数校验、去重、上限边界、运行中跳过、不存在跳过、junction 拒绝、广播与摘名单调用次数。
- 客户端 `apply()` 在桩 ctx 下注册 4 个插槽 + 2 个快捷键，无异常。

## [0.1.0] - 2026-10-24

首个可用版本。面向 DSH（DeepSeek Harness）桌面端 0.2.1-rc.3。

### 新增

- 会话右键菜单（`⋯`）最下方新增「删除对话」，红色文字，`order: 500`，排在「复制 Session ID」之后。
- 快捷键 `Ctrl + Alt + D`，仅在本页生效，输入框内不触发。
- 二次确认弹窗：显示会话标题、不可恢复提示、红色描边的删除按钮。
- 支持 `Esc` 关闭弹窗，打开时自动聚焦。
- 删除时同步清理三处：会话目录、投影缓存、`workspace.json` 里的归档/置顶名单。
- 删除前检查会话是否正在运行（`ctx.agents.get(id).status === "running"`），正在运行直接拒绝 ——
  否则 Linux/macOS 上 `rm` 会立即成功，而 Agent 还在往已删文件里写，造成静默数据丢失。
- 删除完成后广播 `api-session/removed`，侧边栏那一行**当场消失**，不刷新页面。
- 中英文双语（`locale/zh.json`、`locale/en.json`），并带 `meta.title` / `meta.description` 与图标。

### 安全

- `sessionId` 必须匹配 `^(?:session-)?<UUID>$`，拼出的路径 `resolve` 后必须仍在 sessions 根下。
- 用 `lstat` 判本体，符号链接 / junction 直接拒绝删除。
- 每个请求先过 `connection.requestRejection`（Host/Origin 栅栏 + 登录 cookie），拿不到栅栏则退化为 loopback 判定。
- 回退栅栏：Host 必须解析为回环地址（含 IPv6 `[::1]`），**缺少 `Origin` 一律拒绝**，`Origin` 必须与 Host 一致。
- 请求体 `content-length` 与流式累计双上限 64 KiB。
- `GET` / `HEAD` 不带 body 构造请求，非法方法返回 404 而不是 500。
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
- 并发删除的互斥标志在第一个 `await` 之后才置位，两个请求能同时通过检查；
  已改为 `await` 之前置位，并用 `try/finally` 保证任何分支都会释放。
- 回退栅栏三处：IPv6 `[::1]` 恒被拒、缺 `Origin` 直接放行、`GET` 带 body 返回 500。
- 不检测会话是否正在运行，只靠 `rm` 失败兜底 —— 该兜底只在 Windows 成立。
