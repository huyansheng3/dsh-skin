# Theme Package Specification

## Version: Schema 1

A DSH Skin theme package is a directory (or `.zip` archive) containing the following files:

### Required Files

| File | Required | Description |
|------|----------|-------------|
| `manifest.json` | ✅ | Theme identity, version, capability flags |
| `theme.json` | ✅ | Color variable overrides for light/dark modes |

### Optional Files

| File | Required | Description |
|------|----------|-------------|
| `theme.css` | ❌ | Additional Safe CSS overrides (validated on install/apply) |
| `background.{webp,jpg,png}` | ❌ | Background image (exactly one, 16:9 recommended) |
| `LICENSE.txt` | ❌ | License for theme assets |

## manifest.json

```json
{
  "schema": 1,
  "id": "my-theme",
  "name": "My Theme",
  "author": "Author Name",
  "version": "1.0.0",
  "minInjectorVersion": "0.1.0",
  "platform": "any",
  "capabilities": {
    "css-variables": true,
    "background-image": false,
    "safe-css": true
  },
  "integrity": {
    "theme.json": "sha256-hex...",
    "theme.css": "sha256-hex...",
    "background.jpg": "sha256-hex..."
  }
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schema` | `1` | ✅ | Manifest schema version |
| `id` | string (kebab-case, 3-63 chars) | ✅ | Unique theme identifier |
| `name` | string | ✅ | Human-readable display name |
| `author` | string | ❌ | Author credit |
| `version` | semver string | ✅ | Theme version |
| `minInjectorVersion` | semver string | ❌ | Minimum DSH Skin injector version |
| `platform` | `"any"` \| `"macos"` \| `"windows"` \| `"linux"` | ✅ | Target platform |
| `capabilities.css-variables` | boolean | ✅ | Theme overrides CSS variables |
| `capabilities.background-image` | boolean | ✅ | Theme includes a background image |
| `capabilities.safe-css` | boolean | ✅ | Theme includes custom Safe CSS |
| `integrity` | Record<filename, sha256-hex> | ❌ | SHA-256 hashes for payload files |

## theme.json

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
    "position": "center",
    "opacity": 0.3,
    "blur": 0
  }
}
```

### colors

- `light`: Variable overrides applied to `body` (light mode). Keys are CSS custom property names (`--dsw-*`).
- `dark`: Variable overrides applied to `body[data-ds-dark-theme]` (dark mode).

### background

- `file`: Background image filename inside the theme package.
- `size`: CSS `background-size` value (default: `"cover"`).
- `position`: CSS `background-position` value (default: `"center"`).
- `opacity`: Opacity multiplier 0-1 (default: `1`).
- `blur`: Blur in px applied to the background (default: `0`).

## theme.css (Safe CSS)

Custom CSS that passes the Safe CSS validator:

### Allowed

- CSS custom properties with `--dsw-static-*`, `--dsw-alias-*`, `--dsw-specific-*`, `--dsw-font-*`, `--ds-*` prefixes
- Standard properties: `background`, `background-color`, `opacity`, `filter`, `transition`, `color`, `font-family`, `border-radius`, `backdrop-filter`

### Blocked

- `javascript:` URLs
- `expression()` calls
- `data:` or `file:` URLs
- `@import` rules
- `<script>` tags
- Inline `position: fixed` (the background layer is managed by the injector)

## ZIP Package

For distribution, a theme can be packed as a `.zip`:

- All files must be at the root of the ZIP or in a single top-level directory
- Maximum 32 MiB compressed, 64 MiB decompressed
- Maximum 32 entries
- Only `.zip` format is accepted (no `.dshskin` or custom extensions)
