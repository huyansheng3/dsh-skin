# Better Harness Skin

🎨 **给 DeepSeek Harness 桌面端 / Web 端换一张会呼吸的脸。**

外部主题 / 换肤工具 · CSS 变量覆盖 · 背景图层注入 · 不改官方安装包

参考 [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) 的设计理念，为 DeepSeek Harness (DSH) Web 客户端提供换肤能力。

## 它能做什么

- **CSS 变量覆盖**：通过覆盖 `--dsw-*` CSS 自定义属性，改变整个 UI 配色
- **背景图层**：在 UI 下方注入固定背景图，铺满整窗，不遮挡交互控件
- **双模式注入**：
  - **Chrome 扩展**：匹配 `localhost:3080`，打开 DSH Web 时自动注入
  - **CDP 注入器**：通过 Chrome DevTools Protocol 注入，适用于桌面壳模式
- **主题管理**：CLI 工具管理本地主题库（安装、列表、应用、恢复、打包）
- **安全 CSS**：所有注入的 CSS 通过 Safe CSS 校验，只允许覆盖注册的 CSS 变量
- **预设主题**：内置 5 套主题（Gothic Void、Ocean Breeze、Warm Sunset、Matrix Green、Sakura Pink）

## 快速开始

### 方式一：Chrome 扩展（推荐，浏览器中使用）

```bash
# 1. 构建扩展
node scripts/build-extension.mjs

# 2. 加载到 Chrome
# chrome://extensions → 开启开发者模式 → 加载已解压的扩展程序
# 选择 dist/extension/ 目录

# 3. 打开 DSH Web (http://127.0.0.1:3080)
# 4. 点击工具栏的 DSH Skin 图标，选择主题
```

### 方式二：CDP 注入器（桌面壳模式）

```bash
# 1. 以调试端口启动 DSH Web
dsh --profile web --remote-debugging-port=9222

# 2. 安装主题
node src/cli/dsh-skin.mjs install themes/gothic-void

# 3. 应用主题
node src/cli/dsh-skin.mjs apply gothic-void --port 9222

# 4. 恢复官方外观
node src/cli/dsh-skin.mjs restore --port 9222
```

### CLI 命令一览

```bash
dsh-skin list                   # 列出已安装主题
dsh-skin apply <id>              # 通过 CDP 应用主题
dsh-skin restore                 # 恢复官方外观
dsh-skin install <dir>           # 从目录安装主题
dsh-skin remove <id>             # 移除已安装主题
dsh-skin info <id>               # 查看主题详情
dsh-skin pack <dir>              # 将主题目录打包为 .zip
```

## 主题包格式

每个主题是一个目录，包含以下文件：

```
my-theme/
├── manifest.json     # 主题元数据（必需）
├── theme.json        # 颜色变量覆盖（必需）
├── theme.css         # 自定义 Safe CSS（可选）
├── background.jpg    # 背景图片（可选）
└── LICENSE.txt       # 许可证（可选）
```

### manifest.json

```json
{
  "schema": 1,
  "id": "my-theme",
  "name": "My Theme",
  "version": "1.0.0",
  "platform": "any",
  "capabilities": {
    "css-variables": true,
    "background-image": false,
    "safe-css": false
  }
}
```

### theme.json

```json
{
  "schema": 1,
  "colors": {
    "light": {
      "--dsw-alias-bg-base": "rgb(240, 249, 255)",
      "--dsw-alias-brand-primary": "rgb(14, 165, 233)"
    },
    "dark": {
      "--dsw-alias-bg-base": "rgb(8, 20, 35)",
      "--dsw-alias-brand-primary": "rgb(56, 189, 248)"
    }
  },
  "background": {
    "file": "background.jpg",
    "size": "cover",
    "opacity": 0.3,
    "blur": 0
  }
}
```

`colors.light` 中的变量覆盖 `body` 的值，`colors.dark` 中的变量覆盖 `body[data-ds-dark-theme]` 的值。

## 可用 CSS 变量

DSH Web 客户端使用 `--dsw-*` CSS 变量系统，主要分组：

| 前缀 | 说明 | 示例 |
|------|------|------|
| `--dsw-static-*` | 静态色板 | `--dsw-static-blue-500` |
| `--dsw-alias-bg-*` | 背景色别名 | `--dsw-alias-bg-base` |
| `--dsw-alias-border-*` | 边框色别名 | `--dsw-alias-border-l1` |
| `--dsw-alias-label-*` | 文字色别名 | `--dsw-alias-label-primary` |
| `--dsw-alias-brand-*` | 品牌色别名 | `--dsw-alias-brand-primary` |
| `--dsw-alias-button-*` | 按钮色别名 | `--dsw-alias-button-info-fill` |
| `--dsw-alias-state-*` | 状态色别名 | `--dsw-alias-state-error-primary` |
| `--dsw-specific-*` | 组件特定色 | `--dsw-specific-sidebar-fill` |

完整变量列表见 [DSH ui-theme/design-platform.css](../deepseek-harness/packages/client/ui-theme/src/styles/design-platform.css)。

## 安全边界

- **CDP 只连接 `127.0.0.1`**，不连接远程地址
- **Safe CSS 校验**：只允许覆盖 `--dsw-*` 和 `--ds-*` CSS 变量，以及少量展示性属性
- **不修改官方安装包**：所有注入都是运行时 CSS 注入
- **不自动改写 API Key / Base URL**

## 预设主题

| 主题 | 风格 | 背景图 | 描述 |
|------|------|--------|------|
| Gothic Void | 暗色 · 紫调 | ✅ | 哥特虚空风格，紫色辉光 |
| Ocean Breeze | 蓝调 · 清新 | ❌ | 海洋微风，蓝色系 |
| Warm Sunset | 暖色 · 落日 | ✅ | 温暖落日，橙色系 |
| Matrix Green | 绿调 · 终端 | ❌ | 矩阵风格，绿色系 |
| Sakura Pink | 粉调 · 樱花 | ✅ | 樱花粉色，柔和系 |

## 项目结构

```
better-harness-skin/
├── src/
│   ├── cli/dsh-skin.mjs         # CLI 管理工具
│   ├── injector/cdp-injector.mjs # CDP 注入器
│   ├── extension/                # Chrome 扩展
│   │   ├── manifest.json
│   │   ├── content.js            # 内容脚本
│   │   ├── popup.html/css/js     # 弹窗 UI
│   │   └── themes/               # 内置主题
│   └── lib/
│       ├── theme-manager.mjs     # 主题管理
│       ├── safe-css.mjs          # CSS 校验
│       └── theme-types.d.ts      # 类型定义
├── themes/                        # 主题包源码
│   ├── gothic-void/
│   ├── ocean-breeze/
│   ├── warm-sunset/
│   ├── matrix-green/
│   └── sakura-pink/
├── scripts/
│   ├── build-extension.mjs
│   └── build-injector.mjs
└── docs/
    ├── ARCHITECTURE.md
    └── THEME-SPEC.md
```

## 许可证

MIT
