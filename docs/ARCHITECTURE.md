# Architecture

## Overview

Better Harness Skin (DSH Skin) is a theming tool for the DeepSeek Harness (DSH) web client. It overrides the `--dsw-*` CSS custom property system and optionally injects a background image layer, all at runtime — without modifying the official DSH installation.

## Design Principles

1. **No binary modification** — All changes are runtime CSS injection, never patching `.app` or `app.asar`.
2. **CSS variable layer** — DSH's entire theme is driven by `--dsw-*` CSS custom properties; overriding these re-themes the whole UI atomically.
3. **Safe CSS** — Injected CSS is validated against an allowlist of variable prefixes and presentation properties before delivery.
4. **Dual injection paths** — Chrome extension for browser usage, CDP injector for desktop wrapper mode.
5. **Local-first** — Themes live in a local library directory; no network calls during theme application (except Chrome extension's bundled resource access).

## Components

### 1. Theme Package (`themes/`)

Each theme is a self-contained directory:

```
theme-id/
├── manifest.json   — identity, version, capability flags
├── theme.json       — color variable overrides (light + dark)
├── theme.css        — optional Safe CSS (additional overrides)
├── background.jpg   — optional background image
└── LICENSE.txt      — optional license
```

The `theme.json` `colors.light` map overrides `body` variables; `colors.dark` overrides `body[data-ds-dark-theme]` variables. This mirrors DSH's own light/dark token sheets.

### 2. Theme Manager (`src/lib/theme-manager.mjs`)

Manages the local theme library:
- **Library path**: `~/Library/Application Support/DSHSkin/themes/` (macOS)
- Operations: list, find, install, remove, load state, save state
- Validates manifest schema and required fields on load

### 3. Safe CSS Validator (`src/lib/safe-css.mjs`)

Validates CSS before injection:
- **Allowed**: `--dsw-static-*`, `--dsw-alias-*`, `--dsw-specific-*`, `--dsw-font-*`, `--ds-*` custom properties
- **Allowed standard properties**: background, opacity, filter, transition, color, font-family, border-radius
- **Blocked**: `javascript:`, `expression()`, `data:` URLs, `@import`, `<script>`, inline `position: fixed`
- `buildInjectionCss()` generates the final CSS text from theme.json colors + optional background

### 4. CDP Injector (`src/injector/cdp-injector.mjs`)

Connects to Chromium DevTools Protocol on `127.0.0.1`:
1. Fetches page targets from `http://127.0.0.1:<port>/json`
2. Filters for DSH pages (URL contains `:3080` or title contains "DeepSeek"/"Harness")
3. Opens WebSocket to the target's `webSocketDebuggerUrl`
4. Evaluates JS that creates/updates a `<style>` element with the injected CSS
5. If the CSS references `#dsh-skin-bg-layer`, also creates the background div element

### 5. Chrome Extension (`src/extension/`)

Manifest V3 extension:
- **Content script** matches `http://127.0.0.1:3080/*` and `http://localhost:3080/*`
- On page load, reads `chrome.storage.local.activeTheme` and auto-applies
- Popup UI lists bundled themes, sends apply/restore messages to content script
- Themes are loaded from `web_accessible_resources`

### 6. CLI (`src/cli/dsh-skin.mjs`)

Wraps all operations:
- `list`, `apply`, `restore` — theme management via CDP
- `install`, `remove`, `info` — local library management
- `pack` — zip a theme directory for distribution

## Injection Flow

```
┌──────────────┐         ┌──────────────┐
│  Theme Dir    │         │  CLI / Popup  │
│ (manifest+    │────────▶│  (user action)│
│  theme.json)  │         └──────┬───────┘
└──────────────┘                │
                                ▼
                    ┌───────────────────────┐
                    │  Theme Manager         │
                    │  (load + validate)      │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │  Safe CSS Validator    │
                    │  (allowlist check)     │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │  buildInjectionCss()   │
                    │  (colors + bg → CSS)   │
                    └───────────┬───────────┘
                                │
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
        ┌──────────────┐              ┌──────────────┐
        │  CDP Injector │              │  Content.js   │
        │  (WebSocket)   │              │  (extension)  │
        └──────┬───────┘              └──────┬───────┘
               │                             │
               ▼                             ▼
        ┌──────────────────────────────────────────┐
        │  DSH Web Client (localhost:3080)         │
        │  <style id="dsh-skin-injected"> ...     │
        │  <div id="dsh-skin-bg-layer"> ...       │
        └──────────────────────────────────────────┘
```

## DSH CSS Variable System

DSH's theme is entirely CSS-variable-driven (see `packages/client/ui-theme/src/styles/design-platform.css`):

- **Static colors** (`--dsw-static-*`): Raw RGB values (blue, neutral, deepseek, green, red, amber palettes)
- **Alias tokens** (`--dsw-alias-*`): Semantic mappings (bg, border, label, brand, button, state, scrollbar, interactive)
- **Specific tokens** (`--dsw-specific-*`): Component-specific (sidebar, bubble, input, menu, selector)
- **Font tokens** (`--dsw-font-*`, `--ds-font-*`): Font families
- **Motion tokens** (`--ds-*`): Easing and duration

Light mode: variables defined on `body`
Dark mode: same variables redefined on `body[data-ds-dark-theme]`

By overriding these variables, the entire UI recolors instantly — no DOM structural changes needed.
