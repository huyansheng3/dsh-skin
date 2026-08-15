# Architecture

## Purpose

`dsh-skin` is a native Cordis plugin for the DeepSeek Harness Web client. It
adds a runtime theme layer without changing the Harness installation. The
current architecture is Web-server integration only; the former Chrome
extension and CDP injector are intentionally removed.

## Plugin Design

- Plugin type: dual-face Cordis plugin (Host function plugin + Web client function plugin)
- Owning package: `dsh-skin`
- Extension point: Host `webServer.register()` / `webServer.tapIndex()` and Client `settings.general.item`
- Required services: Host `webServer`; Client `slots` and `locale`
- Optional services: none
- Model-visible behavior: none
- Durable behavior: selected theme and imported theme library are stored under the local DSH Skin data directory
- Lifecycle owner: the Host and Client Loader fibers own every route, index tap, locale dictionary, and slot contribution through Cordis effects
- Test entry path: Node unit/route tests, built-client module smoke test, then `dsh web --patch` browser composition
- Distribution form: npm package with `.` Host export, `./client` browser bundle, CLI bin, and an example patch

## Runtime Flow

```text
DeepSeek Harness webServer
        |
        | ctx.inject(["webServer"])
        v
  dsh-skin.apply()
        |
        +--> tapIndex(): add the always-present /_skin/active.css link
        +--> register(): serve CSS and /_skin/bg.<ext>
        +--> register(): expose same-origin /_skin/api/*
        |
        +--> dsh.client bundle: contribute one row to settings.general.item
        v
  browser loads native Harness UI + theme layer + native settings row
```

The plugin is deliberately lazy: if `webServer` is unavailable, its callback
never runs and the plugin has no effect in headless, ACP, or Electron modes.

## Components

### `src/index.js`

The runtime coordinator. It resolves the active theme, builds CSS, registers
HTTP routes and injects the stylesheet link. It does not render a settings page
or own theme persistence/CSS policy; those belong to the Client contribution
and library modules respectively.

### `src/client/index.js`

The browser-side Client plugin contributes the theme selector and ZIP import
control to DSH's existing General settings section. It talks only to the
same-origin Host API and refreshes the owned stylesheet link after a committed
selection. It does not add navigation, a route, a floating launcher, or replace
native settings chrome.

### `src/lib/theme-manager.mjs`

The local theme library boundary. It loads and normalizes legacy DSH and
DreamSkin packages, persists active-theme state, installs/removes themes, and
imports bounded ZIP files. It does not serve HTTP or generate CSS.

### `src/lib/safe-css.mjs`

The CSS policy and renderer boundary. It validates custom CSS and converts
theme JSON into CSS. It does not read arbitrary files, manage state, or make
network requests.

### `src/cli/dsh-skin.mjs`

The local command-line adapter for library operations. It does not inject via
CDP and does not directly control a browser process.

## Theme Resolution

For a request, `src/index.js` resolves in this order:

1. `config.activeTheme` when configured in `cordis.patch.yml`.
2. Persisted `state.json` written by the CLI or HTTP API, including an explicit
   `null` selection for the official appearance.
3. `config.defaultTheme` only when no selection has ever been persisted.
4. No theme, which returns an empty stylesheet and preserves the official
   appearance.

User-installed themes take precedence over bundled themes with the same ID.
The shipped bundle does not configure a default theme.

## Boundaries

- Runtime changes are CSS and non-interactive background resources only.
- The generated background lives below normal body content without assigning a
  stacking context to `#root`; DSH keeps ownership of modal/portal layering.
- Native Harness DOM and controls remain the source of interaction.
- Custom CSS is validated before import and must stay inside the Safe CSS
  allowlist.
- Theme import is local-first and does not download assets.
- Theme management appears only inside DSH's existing settings surface; the
  Client contribution calls the same API and persistence path as the CLI.
- There is no `/_skin/settings` page and no plugin-owned settings launcher.

## Verification Strategy

Run `npm test` after changes. Tests should cover the changed boundary: CSS
policy/rendering, theme format/import, or plugin route behavior. A real
DeepSeek Harness smoke test is required before claiming runtime compatibility,
because the Cordis `webServer` contract is version-dependent.
