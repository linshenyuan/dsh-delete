# dsh-delete

>由于官方只有归档对话没有删除，想删除只能在文件管理器里删，所以写了一个插件给DSH（DeepSeek Harness）的会话列表加一个**「删除对话」**——右键菜单一项 + `Ctrl + Alt + D`，带二次确认。

DSH 0.2.1-rc.3 只有「归档」，没有「删除」。归档只是从列表里隐藏，文件还留在磁盘上。
本插件补上这一步：**真正把会话目录从磁盘删掉**。

## 目录

- [安装](#安装)
- [兼容性](#兼容性)
- [目录结构](#目录结构)
- [License](#license)

### 安装

### 推荐：通过 DSH 插件管理器

用 `plugin_manager` 的 `install_bundle`，`target` 指向本目录的绝对路径。
DSH 会自己完成依赖声明、bundle 对账与链接。

### 手动：三步

```jsonc
// <profile>/package.json
"dependencies": {
  "dsh-delete": "file:path/to/your/dsh-delete"
},
"dsh": {
  "profile": {
    "bundles": [ ..., "dsh-delete" ]
  }
}
```

```powershell
# <profile>/node_modules 里建一个指向本目录的 junction
New-Item -ItemType Junction `
  -Path "<profile>\node_modules\dsh-delete" `
  -Target "path\to]your\dsh-delete"
```

然后重启 DSH。

> **不要用 `pnpm add`。** DSH 的 `pnpm-workspace.yaml` 里 `autoInstallPeers: false`，
> 而插件的 `@deepseek-ai/*` 依赖全靠 DSH 从 `app.asar` 投影到 profile 的 `node_modules`。
> 任何 pnpm 写操作都会把这些投影 prune 掉，所有第三方插件立刻 `ERR_MODULE_NOT_FOUND`，
> DSH 起不来。

## 兼容性

| 项 | 值 |
|---|---|
| DSH | 0.2.1-rc.3（会话格式 v4） |
| 平台 | Windows / macOS / Linux 桌面端，以及 Web |
| 运行依赖 | 无 |
| 客户端依赖 | 仅 `react`（平台 seed 模块） |

会话格式升级到 v5 之后，`session.v4.jsonl.zstd` 这个文件名会变；定位走的是目录层级，
通常不受影响，但生成日志的文件名常量需要同步更新。

## 目录结构

```
dsh-delete/
├── .editorconfig
├── .gitignore
├── CHANGELOG.md
├── LICENSE
├── README.md
├── package.json          # dsh.bundle / dsh.client 清单
├── cordis.patch.yml      # bundle patch：插入 dsh-delete 插件行
├── icon.svg              # 插件列表图标
├── src/
│   ├── index.js          # 宿主侧入口：apply / 挂路由 / 广播事件
│   ├── delete.js         # 定位会话目录 + 删除 + 清理缓存与名单
│   ├── route.js          # HTTP 传输层：信封、栅栏、body 上限
│   └── client.js         # 浏览器侧 bundle：菜单项 / 弹窗 / 快捷键
└── locale/
    ├── en.json           # meta.title / meta.description
    └── zh.json
```
## License

[MIT](LICENSE) © 2026 Aland
