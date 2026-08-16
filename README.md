# dsh-skin

[![CI](https://github.com/huyansheng3/dsh-skin/actions/workflows/ci.yml/badge.svg)](https://github.com/huyansheng3/dsh-skin/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-339933.svg)](https://nodejs.org/)

`dsh-skin` 是 DeepSeek Harness Web 的原生 Cordis 皮肤插件。主题选择、图片预览和 ZIP
导入直接集成在 Harness 自带的“设置 > 皮肤库”中，不修改 DSH 安装包，也不需要
浏览器扩展或 CDP 注入器。

已在 `@deepseek-ai/dsh@0.1.0-rc.6` 的 Web profile 中验证。

## 效果预览

以下截图来自真实的 DSH Web 会话，皮肤库使用每套主题自己的背景图作为可直接应用的预览。

| 原生皮肤设置 | 金陵晴川 |
| --- | --- |
| ![原生皮肤库中的图片预览和 ZIP 导入](./docs/images/dsh-skin-gallery.webp) | ![金陵晴川明亮主题](./docs/images/dsh-skin-jinling.webp) |
| 安静氛围森林 | Gothic Void Crusade |
| ![安静氛围森林主题](./docs/images/dsh-skin-forest.webp) | ![Gothic Void Crusade 暗色主题](./docs/images/dsh-skin-gothic.webp) |

## 快速安装

前置条件：已安装 DeepSeek Harness，终端中可以运行 `dsh`，Node.js 版本不低于 18。

```bash
dsh plugin --profile web add github:huyansheng3/dsh-skin
dsh web
```

当前 `main` 安装包内置 15 套指定 Gallery 主题和 4 套项目主题；它们会自动出现在
皮肤下拉框中，但首次安装仍保持“官方外观”，不会自动激活社区主题。

打开 DSH Web 页面后，进入 **设置 > 皮肤库**：

1. 点击任一预览图即可立即应用对应主题；
2. 点击“导入 ZIP”安装自己的 DreamSkin 主题；
3. 点击“官方外观”即可停用皮肤。

导入主题不会自动激活。若 `dsh web` 已经在运行，安装或升级插件后请重启服务。

### 升级与卸载

升级到当前 `main` 分支：

```bash
dsh plugin --profile web add github:huyansheng3/dsh-skin
```

卸载：

```bash
dsh plugin --profile web remove dsh-skin
```

### 从本地源码安装

适合开发或离线环境：

```bash
git clone https://github.com/huyansheng3/dsh-skin.git
cd dsh-skin
npm run build
dsh plugin --profile web add "$PWD"
dsh web
```

源码仓库已经包含随包的 19 套指定主题。需要把本地开发库扩展到审计保留的 76 套时，
再执行 `npm run vendor:gallery`：

```bash
npm run vendor:gallery
DSH_SKIN_GALLERY_DIR="$PWD/gallery/themes" dsh web
```

`vendor:gallery` 从 DreamSkin Gallery 热门前 100 的冻结审计中排除 24 个源可读性
不合格主题，再按 [精选目录](./gallery/catalog.json) 下载并校验剩余 76 个具体版本，
在项目的 `gallery/themes/` 中生成本地内置主题库。运行时不会联网，也不会自动切换
当前主题。已有 ZIP 缓存可用于完全离线物化：

```bash
npm run vendor:gallery -- --cache-dir /path/to/cache --offline
```

Gallery 包由社区作者发布，并不统一使用 MIT 许可。发布包只收录项目维护者指定的
15 个 Gallery 主题，目录记录每个版本的作者、发行者声明的许可、
体积和 SHA-256；随包背景以不裁切、不调色的高质量 WebP 分发，将 GitHub 安装包控制
在约 6.5 MB。主题归属、许可和重编码说明见 [第三方声明](./THIRD_PARTY_NOTICES.md)。

## 功能

- 原生设置集成：独立“皮肤库”Tab，不创建额外路由、浮动按钮或 iframe；
- 图片预览：所有带背景的主题均以同源受限图片路由呈现缩略图，点击即可应用；
- 即时切换：设置成功后刷新主题 stylesheet，不替换 Harness DOM；
- 内置主题：发布包自带 4 套项目主题和 15 套指定 Gallery 主题；源码可物化 76 套；
- ZIP 导入：兼容 DreamSkin 与 legacy DSH 主题格式；
- Safe CSS：拒绝脚本、`@import`、危险 URL 和未经授权的布局覆盖；
- 作者保真：保留主题原始配色、玻璃透明度和自定义 CSS，不在运行时强制修色；
- 定点可读性：仅让原生代码块、行内代码和不透明控件使用作者的实色面板 token，
  并让侧栏展开/收起图标使用作者主文字色；不覆盖正文颜色、不加全局遮罩；
- Headless 安全：没有 `webServer` 时插件保持 no-op。

## 常见问题

### 设置中没有“皮肤”选项

确认插件安装在 `web` profile，而不是默认或其他 profile：

```bash
dsh plugin --profile web list --depth 0
```

列表中应包含 `dsh-skin`。随后停止并重新运行 `dsh web`。

### 页面仍显示旧主题

先刷新浏览器。仍未更新时，重启 `dsh web`；插件会用
`theme@version:revision` 缓存键刷新样式资源。

### ZIP 导入失败

DreamSkin ZIP 必须包含 `manifest.json`、`theme.json`、非空 `theme.css` 和清单中
声明的一张背景图。插件还会检查文件哈希、路径穿越、条目数量、压缩大小和解压大小。
完整格式见 [主题规范](./docs/THEME-SPEC.md)。

### 固定主题后不能在页面切换

部署配置中的 `activeTheme` 会锁定页面选择器。删除该配置，或改用
`defaultTheme` 只设置首次默认主题。

## 工作方式

```text
DSH Web Loader
  +-- dsh-skin Host
  |   +-- tapIndex() 注入 /_skin/active.css
  |   +-- /_skin/bg/* 提供当前背景图
  |   +-- /_skin/api/* 提供主题查询、切换和 ZIP 导入
  +-- dsh-skin Client
      +-- settings.section 提供原生“皮肤库”Tab
```

Host 始终注入一个带缓存版本的 stylesheet link。带图主题由 `body::before` 绘制
`pointer-events: none` 的背景层，原生 UI、弹窗和 portal 仍由 DSH 管理。插件不会
修改 API Key、Base URL 或官方安装包，也不会在运行时下载网络资源或启动外部常驻
进程。只有开发者显式执行 `vendor:gallery` 时才会访问 Gallery 官方 API。

架构和生命周期详见 [架构说明](./docs/ARCHITECTURE.md)。

## 配置

仓库自带的 [cordis.patch.yml](./cordis.patch.yml) 只注册插件，不默认激活主题。
部署方需要固定主题时，可以在额外 patch 中配置：

```yaml
- id: dsh-skin
  name: dsh-skin
  config:
    activeTheme: gothic-void-crusade
```

DSH 的 id-targeted patch 会替换整行而不是深合并，因此覆盖时要同时保留
`name: dsh-skin`。

| 字段 | 行为 |
| --- | --- |
| `enabled: false` | 禁用主题 CSS 和页面修改能力 |
| `activeTheme` | 固定主题并锁定页面选择 |
| `defaultTheme` | 仅在从未保存过选择时使用；显式“官方外观”优先 |

## CLI

CLI 与 Web 设置读取同一个本地主题库：

```bash
dsh-skin install ./my-theme
dsh-skin import ./my-theme.zip
dsh-skin list
dsh-skin activate my-theme
dsh-skin deactivate
dsh-skin info my-theme
dsh-skin remove my-theme
dsh-skin pack ./my-theme
```

CLI 修改选择后需要刷新页面；页面设置内的切换会立即刷新 stylesheet。内置主题不
复制到用户主题库，因此 CLI 的 `list`、`info` 和 `activate` 只管理已安装主题。

## 主题格式

推荐使用 DreamSkin 格式：

```json
{
  "packageVersion": 1,
  "themeId": "my-theme",
  "name": "My Theme",
  "version": "1.0.0",
  "files": [
    { "path": "theme.json", "mediaType": "application/json" },
    { "path": "theme.css", "mediaType": "text/css" },
    { "path": "background.jpg", "mediaType": "image/jpeg" }
  ]
}
```

```json
{
  "appearance": "dark",
  "colors": {
    "background": "#1e1e2e",
    "panel": "#313244",
    "panelAlt": "#45475a",
    "accent": "#cba6f7",
    "accentAlt": "#b4befe",
    "text": "#cdd6f4",
    "muted": "#a6adc8",
    "line": "#45475a",
    "highlight": "#585b70"
  },
  "art": { "focusX": 0.5, "focusY": 0.4, "taskMode": "fill" },
  "backgroundOpacity": 1,
  "backgroundBlur": 0
}
```

目录安装允许不带背景图或自定义 CSS。从 ZIP 导入 DreamSkin 时，必须同时包含清单
声明的背景图和非空 `theme.css`。Legacy DSH `schema: 1` 格式继续用于已有本地主题。
完整字段与安全约束见 [主题规范](./docs/THEME-SPEC.md)。

## 主题库位置

| 平台 | 路径 |
| --- | --- |
| macOS | `~/Library/Application Support/DSHSkin/themes/` |
| Linux | `~/.local/share/dsh-skin/themes/` |
| Windows | `%LOCALAPPDATA%\\DSHSkin\\themes\\` |

测试可设置 `DSH_SKIN_DATA_DIR` 使用隔离的数据目录。
随安装包提供的 15 套 Gallery 主题位于 `gallery/themes/`，DSH 进程会自动发现。
`DSH_SKIN_GALLERY_DIR=/absolute/path/to/gallery/themes` 仅用于覆盖安装包内的默认目录，
例如加载开发机物化的 76 套主题。用户主题始终优先于同 ID 的 Gallery 主题，物化和
扫描过程都不会改写 `state.json`。

## 开发

```bash
npm test
node --check src/index.js src/client/index.js src/lib/theme-manager.mjs
npm pack --dry-run
```

发布维护者需要重新生成随包背景时，安装 `cwebp` 后运行
`npm run optimize:gallery`；该命令不会在用户安装插件时执行。

Gallery 兼容性结果见 [审计报告](./docs/GALLERY-AUDIT.md)。热门前 100 中有 93 个原包
通过严格 ZIP 导入，另 7 个缺少 `theme.css`，本地物化时使用有界兼容 CSS。24 个可
导入主题因原始文字或强调色对比度不足，已由 [排除清单](./gallery/exclusions.json)
从默认目录和本地主题库删除。剩余 76 个已在真实长会话中逐个完成背景安全、原生控件
和溢出 E2E 检查；不透明文字表面低于 `3:1` 会直接失败，普通壁纸区域仍只报告作者
效果告警。3 条不同的现有会话均逐个复验 76 套主题，结果都是 76/76 结构通过。

## License

[MIT](./LICENSE)。发布包自带第三方主题的作者与许可证记录在各自 `manifest.json`
和 [第三方声明](./THIRD_PARTY_NOTICES.md) 中；项目许可证不会替代主题各自的许可证。
