# Task Progress

## Objective

把 `Codex-Dream-Skin` 的主题能力收敛为 DeepSeek Harness 原生 Cordis 插件，
主题选择和 ZIP 导入只出现在 Harness 原“设置 > 通用设置”中；DreamSkin Gallery
热门前 100 经质量裁剪后可在本地物化 76 套，并筛选其中约 20 套随安装包默认可选。

## Current State

- 已完成从 Chrome extension/CDP 方案到双端 Cordis 插件的迁移。
- Host 入口 `src/index.js` 只在 `webServer` 存在时注册 CSS、背景资源和同源 API。
- Client bundle 通过 `settings.general.item` 在原生通用设置中贡献皮肤选择与 ZIP 导入。
- 不存在插件自建设置路由、导航入口、浮动按钮或 iframe。
- `theme-manager.mjs` 支持 legacy DSH 与 DreamSkin，并执行有界 ZIP 导入和失败清理。
- 公开包内置 Cyndi 与 Gothic Void Crusade 两套带图 DreamSkin 主题；权利未确认的
  Arina Hashimoto 素材只保留在本地参考目录，不进入 GitHub 或发布包。
- 发布 bundle 默认保持官方外观；只有显式选择或部署配置才会启用主题。
- Gallery 热门前 100 原始审计已冻结；`gallery/exclusions.json` 排除 24 个可导入但
  源对比度不合格的主题，vendoring 原子物化剩余 76 个且不自动激活。
- npm 发布包直接集成其中 20 个经审计且许可允许再分发的 Gallery 主题；其余保留主题
  通过显式 vendoring 在本地物化。
- 下一发布版本为 `0.3.0`；已发布的 `v0.2.0` 不包含这 20 个 Gallery 主题。
- `gallery/bundled-themes.json` 固定随包主题及许可证，`package.json` 逐目录列入；
  `.gitignore` 继续拦截其余本地 Gallery artwork，避免宽泛打包。
- 93 个完整包继续走严格 ZIP 导入；7 个 Gallery 已标记不兼容、缺少 `theme.css` 的
  包只在 vendoring 时生成受限兼容 CSS，并在 `_dsh-skin.json` 中单独记录。
- Host 同时扫描发布包内置目录与本地 Gallery 目录；用户安装主题在同 ID 时优先，
  当前持久化选择不被目录生成或库存查询改写。
- 带图主题保留作者原始颜色和自定义 CSS，使用 `panel=0.72`、`panelAlt=0.65` 的原始
  玻璃适配；不再自动修正文字/强调色、移动表面亮度、推断 `appearance:auto` 或在
  作者 CSS 后追加全局可读性覆盖。
- 原生代码、标签、菜单和不透明控件使用作者提供的实色 `panel`/`panelAlt` token，
  避免深色主题继承 Harness 浅色填充；正文、强调色和主玻璃表面保持作者效果。
- 侧栏 logo 行的展开/收起按钮单独使用作者主文字 token，避免细线图标继承低识别度的
  次要文字色；其他次要标签不被提亮。

## Plugin Design

- Plugin type: dual-face Cordis plugin (Host function + Web Client function)
- Owning package: `dsh-skin`
- Extension point: Host `webServer.register/tapIndex`; Client `settings.general.item`
- Required services: Host `webServer`; Client `slots`, `locale`
- Optional services: none
- Model-visible behavior: none
- Durable behavior: local active selection, revision, and imported theme library
- Lifecycle owner: Cordis Host/Client fibers through `ctx.effect()` and slot injection
- Test entry path: Node tests, built Client smoke, rc.6 real composition, browser interaction
- Distribution form: npm bundle with Host export, `./client`, CLI, themes, and patch

## Verification

- `npm test`: 通过，46/46。
- Node.js 18.20.8：46/46 通过；测试路径解析不依赖 Node 20 的
  `import.meta.dirname`。
- GitHub 主分支已发布到 `huyansheng3/dsh-skin`；使用
  `pnpm add github:huyansheng3/dsh-skin` 的隔离安装通过，Host 导出、Client bundle、
  Cordis patch 和公开背景资源均完整。
- GitHub Actions CI 在 Node.js 18/20/22 上全部通过测试与 pack 检查。
- 稳定版 `v0.2.0` 已发布；固定版本
  `pnpm add github:huyansheng3/dsh-skin#v0.2.0` 的隔离安装通过，且公开产物不包含
  Arina Hashimoto 本地参考素材。
- Gallery 热门前 100：100/100 官方包 SHA-256 正确；93/100 通过严格 ZIP 导入和
  Safe CSS；其余 7/100 缺少非空 `theme.css`，且 Gallery 元数据均为
  `applyCompatible=false`。完整结果在 `docs/GALLERY-AUDIT.md`。
- 本地离线库已从 100 裁剪为 76；目录与 `gallery/catalog.json` 完全一致，24 个源
  对比度不合格主题已从默认目录和用户主题残留中移除。
- 5 个纯色 legacy 主题 `gothic-void`、`matrix-green`、`ocean-breeze`、`sakura-pink`、
  `warm-sunset` 已从源码、npm 发布清单和测试数据目录移除。
- Gallery 浏览器审计继续要求背景资源、不可交互背景层、无横向溢出和原生控件可见；
  普通壁纸正文对比度只报告告警，但可见、有文字且背景透明度至少 0.85 的原生代码与
  控件表面低于 3:1 时直接判定结构失败。
- 有会话 E2E：在 `@deepseek-ai/dsh@0.1.0-rc.6` 的 3 个真实会话间切换，每条会话都
  逐个激活保留 Gallery 76 套主题；短会话与约 10k 字长会话均为 76/76 结构通过。
- 长会话逐主题复验：保留 Gallery 76/76 无背景安全、token、不透明表面对比度、控件
  或溢出结构失败；背景层始终 `pointer-events:none`，结束后恢复原 `the-legend-of-hei`
  主题。
- 原生设置 E2E：81 个选项（官方外观 + 80 个当前可用主题），24 个排除 ID 和 5 个
  纯色 ID 均不可见；设置 dialog 宽 800px 且完整落在视口内。
- CSS cache key 增加 renderer `r4`，插件升级后不会继续命中旧的 immutable 主题 CSS。
- Host route smoke: 仅注册 `/_skin/active.css`、`/_skin/bg/*`、`/_skin/api/*`；
  index 中只注入 stylesheet link。
- Client artifact smoke: rc.6 ModuleLoader 成功加载 `/plugins/dsh-skin/client.js`，
  并注册 `settings.general.item`。
- 真实组合：`@deepseek-ai/dsh@0.1.0-rc.6`，Web profile bundle 中包含 `dsh-skin`。
- 实际 Web 服务已在 `http://127.0.0.1:3080` 用当前 profile 重启；启动图包含
  `/plugins/dsh-skin/client.js`，不再包含旧的 `@deepseek-ai/dsh-client-ui-skin`。
- 浏览器：原生通用设置显示皮肤选择与 ZIP 导入；设置 dialog 宽度 `800px`，
  modal 覆盖层级正常。
- 浏览器：Gothic 背景资源、主题变量和不可交互背景层实际渲染；主题切换后 stylesheet
  与变量即时更新。
- 浏览器：合法 DreamSkin ZIP 通过原生控件导入成功且不自动激活；测试主题随后清理。
- 真实社区包 `rei-blue-pencil-1.0.0.zip` 已通过 Web API 导入；原生设置切换后
  背景、accent token 与 Safe CSS 实际生效，再恢复原 `deepseek` 主题。
- 安全：显式停用优先于 `defaultTheme`；跨源 mutation 被拒绝；背景不会创建
  `#root` stacking context 干扰 DSH portal；重复 ZIP 导入失败后不会遗留解压目录。
- 浏览器逐主题检查结束后，当前激活主题已恢复为检查前的 `deepseek`。
- 发布检查：语法检查、`git diff --check`、`npm pack --dry-run`、tarball 干净安装、
  Host 命名导出与无 import Client artifact smoke 均通过。
- `0.3.0` tarball 干净安装：安装目录恰好包含白名单 20 个 Gallery 主题，公开加载器
  20/20 可读；无环境变量的 Host 库存为 22 个内置主题，首次状态仍为官方外观。
- 发布白名单浏览器复验：20/20 无背景安全、token、原生控件或横向溢出结构失败；
  不透明文字表面对比度全部通过，普通壁纸区域仅保留作者效果告警，审计结束后恢复
  检查前主题。
- `stellar-watcher` 真实浏览器复验：侧栏展开/收起按钮从次要色 `#A8B1C6` 提升到
  作者主文字色 `#F5F0E8`；更新后的浏览器审计继续为保留 Gallery 76/76 通过。
- README 预览图已从 `@deepseek-ai/dsh@0.1.0-rc.6` 的真实 Web 会话截取；原生设置、
  明亮、森林和暗色主题均确认正常显示，截图以高质量 WebP 纳入仓库。
- GitHub 首次交付包 57.3 MB 在低速 codeload 链路触发 pnpm 超时；20 张背景已在不
  裁切、不调色的前提下高质量转为 WebP，npm dry-run 降至约 6.46 MB。优化后视觉总览
  无明显失真，浏览器逐主题结构审计仍为 20/20 通过。
- CodeGraph 未初始化；按仓库指令未擅自初始化。

## Remaining Risks

- ZIP 解压依赖系统 `unzip`，Windows 原生环境的可移植性尚未验证。
- Cyndi 与 Gothic 图片按主题清单中的 MIT 声明分发；第三方主题的声明真实性仍由
  各主题发布者负责。
- Gallery 中限制再分发、私用、专有、非商业及含义不明确的主题只保留目录元数据和
  vendoring 能力；npm 仅随包提供许可明确的 20 个精选主题。

## Out Of Scope

- Chrome extension、CDP injector、Electron 注入
- Codex Desktop 安装/启动/恢复
- 修改 DeepSeek Harness 官方包、签名、API Key 或 Base URL
