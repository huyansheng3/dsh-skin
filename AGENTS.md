# dsh-skin Agent Guide

本文件适用于仓库根目录及其全部子目录。`Codex-Dream-Skin/AGENTS.md` 只约束被复制进来的上游参考项目；本项目的实现、测试和发布判断以本文件为准。

## 项目定位

本项目的唯一目标是把 Codex Dream Skin 的主题能力适配为 DeepSeek Harness 的原生 Cordis 插件：

- 运行时只接入 DeepSeek Harness Web `webServer`；通过 `tapIndex()` 注入 CSS link，并由插件路由提供 CSS、背景图和主题管理 API。
- 主题库由 `src/lib/theme-manager.mjs` 管理，CLI 入口是 `src/cli/dsh-skin.mjs`。
- `Codex-Dream-Skin/` 是主题格式、安全规则和视觉验收的参考来源，不是本插件的运行时入口。
- 不再恢复已删除的 Chrome extension、CDP injector、Electron 注入或 Codex Desktop 安装脚本，除非用户明确提出新的兼容目标。

## 事实来源

发生冲突时按以下顺序判断：用户当前明确需求、本文档、`src/` 的实现与测试、`docs/`、`Codex-Dream-Skin/` 上游参考资料。不要从旧 commit 或过时架构文档恢复能力。

| 问题 | 来源 |
| --- | --- |
| 插件入口和 HTTP 生命周期 | `src/index.js` |
| 主题发现、导入、状态和 ZIP 限制 | `src/lib/theme-manager.mjs` |
| Safe CSS 允许/禁止规则 | `src/lib/safe-css.mjs` 与 `test/safe-css.test.mjs` |
| CLI 行为 | `src/cli/dsh-skin.mjs` |
| 主题样例 | `themes/`、`examples/themes/` |
| Dream Skin 兼容依据 | `Codex-Dream-Skin/README.md`、`Codex-Dream-Skin/AGENTS.md` |

## 不变量与安全边界

- 不修改 DeepSeek Harness 官方安装包、`app.asar`、签名或 API 配置。
- 插件在没有 `webServer` 的模式中必须保持 no-op；不要引入顶层注入让 headless/ACP/Electron 启动失败。
- 主题未明确激活前不改变用户当前主题；导入只写入主题库。
- 主题 CSS 必须先通过 Safe CSS 校验；禁止脚本、`@import`、`javascript:`、`data:`、表达式和未授权布局/定位能力。
- ZIP 导入必须有界、拒绝路径穿越和不可信内容；失败时清理临时目录，不留下半安装状态。
- 背景层必须 `pointer-events: none`，不能覆盖或替代原生 UI；侧栏、输入框、菜单、任务内容必须继续使用真实 DOM。
- 不在插件中加入网络下载、API Key/Base URL 改写、遥测或静默外部进程。

## AI 工作流

1. 开始前读取本文件、`TASK_PROGRESS.md`、`README.md`、相关源码和 `git status`；保留用户已有改动。
2. 先写清任务属于：插件生命周期、主题格式、导入安全、CSS 生成、CLI、文档，还是测试。不要跨边界顺手重构。
3. 修改复杂生产文件时，在 header 注释写清职责、状态/数据流、入口和不负责的边界（遵守仓库根指令 T1）。
4. 先补或更新针对行为的测试，再实现；实现后至少运行 `npm test`。涉及 ZIP、HTTP 或跨平台行为时补充静态检查并记录不能执行的验证。
5. 每个里程碑更新 `TASK_PROGRESS.md`，明确“已实现 / 已验证 / 未验证”，不把推测写成完成。
6. 完成前检查文档是否仍描述已删除的 extension/CDP 路径，并检查 diff 只包含当前任务。

## 变更验收

- 任何主题能力变更：合法主题、缺失文件、非法 schema、Safe CSS 攻击样例和恢复/停用行为都有测试或明确说明。
- 任何插件变更：验证无主题、激活主题、主题切换后的缓存版本、背景资源和错误响应。
- 任何导入变更：验证 ZIP 大小/条目/解压上限、单层目录、哈希、重复安装和失败清理。
- 任何文档变更：命令、路径、格式和当前实现一致；不引用不存在的 `src/extension` 或 `src/injector`。

## 明确不做

- 不把上游 Dream Skin 的整套 macOS/Windows 客户端搬进本项目。
- 不为了“兼容”恢复旧的 CDP 或 Chrome extension 文件。
- 不把视觉效果图当作运行时 UI，也不把背景图当作包含 UI 的截图。
- 不在没有真实测试证据时声称“已兼容 DeepSeek Harness 所有版本”。
