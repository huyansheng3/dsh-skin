# dsh-skin

[![CI](https://github.com/huyansheng3/dsh-skin/actions/workflows/ci.yml/badge.svg)](https://github.com/huyansheng3/dsh-skin/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-339933.svg)](https://nodejs.org/)

`dsh-skin` 是 DeepSeek Harness Web 的原生 Cordis 皮肤插件。主题选择和 ZIP
导入直接集成在 Harness 自带的“设置 > 通用设置”中，不修改 DSH 安装包，也不需要
浏览器扩展或 CDP 注入器。

已在 `@deepseek-ai/dsh@0.1.0-rc.6` 的 Web profile 中验证。

## 快速安装

前置条件：已安装 DeepSeek Harness，终端中可以运行 `dsh`，Node.js 版本不低于 18。

```bash
dsh plugin --profile web add github:huyansheng3/dsh-skin#v0.2.0
dsh web
```

打开 DSH Web 页面后，进入 **设置 > 通用设置 > 皮肤**：

1. 在下拉框中选择内置主题；
2. 或点击“导入 ZIP”安装自己的 DreamSkin 主题；
3. 选择“官方外观”即可停用皮肤。

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

## 功能

- 原生设置集成：不创建额外路由、浮动按钮或 iframe；
- 即时切换：设置成功后刷新主题 stylesheet，不替换 Harness DOM；
- 内置主题：5 套纯色主题和 2 套带背景图主题；
- ZIP 导入：兼容 DreamSkin 与 legacy DSH 主题格式；
- Safe CSS：拒绝脚本、`@import`、危险 URL 和未经授权的布局覆盖；
- 可读性保护：带图主题会校正内容表面与文字对比度；
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
      +-- settings.general.item 提供原生设置行
```

Host 始终注入一个带缓存版本的 stylesheet link。带图主题由 `body::before` 绘制
`pointer-events: none` 的背景层，原生 UI、弹窗和 portal 仍由 DSH 管理。插件不会
修改 API Key、Base URL 或官方安装包，也不会下载网络资源或启动外部常驻进程。

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

## 开发

```bash
npm test
node --check src/index.js src/client/index.js src/lib/theme-manager.mjs
npm pack --dry-run
```

Gallery 兼容性结果见 [审计报告](./docs/GALLERY-AUDIT.md)。当前热门前 100 个主题中，
93 个通过严格 ZIP 导入、Safe CSS 和真实页面检查；其余 7 个是 Gallery 已标记不兼容
的缺件包。

## License

[MIT](./LICENSE)。内置第三方主题的作者与许可证记录在各主题的 `manifest.json` 中。
