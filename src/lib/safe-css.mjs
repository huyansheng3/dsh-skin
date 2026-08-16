/**
 * Safe CSS validator, DreamSkin compatibility adapter, and CSS generator.
 *
 * Raw theme tokens pass through Safe CSS validation and are mapped onto DSH's
 * runtime variables without color correction. Illustrated themes keep the
 * author background token while the DSH canvas becomes transparent beneath the
 * original glass surfaces. Opaque native reading/control surfaces use the
 * author's solid panel colors so dark skins cannot inherit DSH's light fills,
 * and the compact sidebar toggle uses a bordered panel surface plus the
 * author's primary text token so its thin icon remains recognizable. Author
 * CSS is appended last.
 *
 * Main callers are theme-manager during import and the Host stylesheet route.
 * This file does not discover themes, read assets, mutate the DOM, or own ZIP
 * and HTTP policy.
 */

// ── Allowed custom property prefixes ────────────────────────────────────────
const ALLOWED_VAR_PREFIXES = [
  "--dsw-static-",
  "--dsw-alias-",
  "--dsw-specific-",
  "--dsw-font-",
  "--ds-theme-color-",
  "--ds-theme-surface-",
  "--ds-",
];

// ── Default surface vars (DSH may not define these; we provide fallbacks) ────
// These are used by [data-ds-part] selectors in DreamSkin theme.css
const SURFACE_DEFAULTS = {
  "--ds-theme-surface-radius": "12px",
  "--ds-theme-surface-blur":   "16px",
};

const PANEL_SURFACE_ALPHA = 0.72;
const PANEL_ALT_SURFACE_ALPHA = 0.65;
const TEXT_CONTRAST_RATIO = 4.5;
const ACCENT_CONTRAST_RATIO = 3;

// ── Allowed plain CSS properties ─────────────────────────────────────────────
const ALLOWED_PROPERTIES = new Set([
  "background",
  "background-image",
  "background-color",
  "background-size",
  "background-position",
  "background-repeat",
  "background-attachment",
  "opacity",
  "filter",
  "backdrop-filter",
  "-webkit-backdrop-filter",
  "transition",
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "gap",
  "row-gap",
  "column-gap",
  "border-radius",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
  "border-width",
  "border-style",
  "border-color",
  "border",
  "border-top",
  "border-top-color",
  "border-top-width",
  "border-top-style",
  "border-right",
  "border-right-color",
  "border-right-width",
  "border-right-style",
  "border-bottom",
  "border-bottom-color",
  "border-bottom-width",
  "border-bottom-style",
  "border-left",
  "border-left-color",
  "border-left-width",
  "border-left-style",
  "box-shadow",
  "transition-property",
  "transition-duration",
]);

// ── Blocked patterns ──────────────────────────────────────────────────────────
const BLOCKED_PATTERNS = [
  /javascript:/i,
  /expression\s*\(/i,
  /url\s*\(\s*['"]?\s*data:/i,
  /url\s*\(\s*['"]?\s*file:/i,
  /@import/i,
  /position\s*:\s*fixed/i,
  /<script/i,
];

const BOUNDED_PROPERTIES = new Set([
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "gap",
  "row-gap",
  "column-gap",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
]);

function boundedNumber(value, minimum, maximum, unit = "") {
  const escapedUnit = unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = value.match(new RegExp(`^([0-9]+(?:\\.[0-9]+)?)${escapedUnit}$`, "i"));
  if (!match) return false;
  const number = Number(match[1]);
  return number >= minimum && number <= maximum;
}

function zeroOrBoundedPx(value, maximum) {
  return value === "0" || boundedNumber(value, 0, maximum, "px");
}

function boundedPropertyValue(property, value) {
  const normalized = value.trim();
  if (property === "font-size") return boundedNumber(normalized, 12, 20, "px");
  if (property === "font-weight") return /^(?:400|500|600|700|normal|bold)$/i.test(normalized);
  if (property === "line-height") return boundedNumber(normalized, 1.1, 1.8);
  if (property === "letter-spacing") return normalized === "0" || boundedNumber(normalized, 0, 2, "px");
  if (property === "gap" || property === "row-gap" || property === "column-gap") {
    return zeroOrBoundedPx(normalized, 24);
  }
  if (property.endsWith("-radius")) {
    if (/^var\(\s*--ds-theme-surface-radius\s*\)$/.test(normalized)) return true;
    const values = normalized.split(/\s+/);
    return values.length >= 1 && values.length <= 4
      && values.every(item => zeroOrBoundedPx(item, 28));
  }
  return false;
}

/**
 * Validate that CSS is safe to inject.
 * @param {string} css Raw CSS text
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSafeCss(css) {
  const errors = [];

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(css)) {
      errors.push(`Blocked pattern detected: ${pattern.source}`);
    }
  }

  const declarationRegex = /([\w-]+)\s*:\s*([^;{}]+)\s*(?:;|$)/g;
  let match;
  while ((match = declarationRegex.exec(css)) !== null) {
    const property = match[1].trim();
    if (property.startsWith("--")) {
      const isAllowed = ALLOWED_VAR_PREFIXES.some((p) => property.startsWith(p));
      if (!isAllowed) {
        errors.push(`Disallowed CSS custom property: ${property}`);
      }
      continue;
    }
    if (!ALLOWED_PROPERTIES.has(property.toLowerCase())) {
      errors.push(`Disallowed CSS property: ${property}`);
      continue;
    }
    const normalizedProperty = property.toLowerCase();
    if (BOUNDED_PROPERTIES.has(normalizedProperty)
        && !boundedPropertyValue(normalizedProperty, match[2])) {
      errors.push(`Out-of-range CSS value for ${property}: ${match[2].trim()}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── DreamSkin color→variable mapping ─────────────────────────────────────────
//
// Each DreamSkin color key maps to a list of CSS custom properties that
// should receive the same value.
//
const DREAMSKIN_COLOR_MAP = {
  background: [
    "--ds-theme-color-background",
    "--dsw-alias-bg-base",
  ],
  panel: [
    "--ds-theme-color-panel",
    "--dsw-alias-bg-layer-1",
    "--dsw-specific-sidebar-fill",
  ],
  panelAlt: [
    "--ds-theme-color-panel-alt",
    "--dsw-alias-bg-layer-2",
    "--dsw-specific-bubble",
    "--dsw-specific-input-major",
  ],
  accent: [
    "--ds-theme-color-accent",
    "--dsw-alias-brand-primary",
  ],
  accentAlt: [
    "--ds-theme-color-accent-alt",
    "--dsw-alias-brand-secondary",
  ],
  secondary: [
    "--ds-theme-color-secondary",
  ],
  highlight: [
    "--ds-theme-color-highlight",
    "--dsw-alias-bg-layer-3",
    "--dsw-specific-bubble-highlight",
  ],
  text: [
    "--ds-theme-color-text",
    "--dsw-alias-label-primary",
  ],
  muted: [
    "--ds-theme-color-muted",
    "--dsw-alias-label-secondary",
    "--dsw-alias-label-tertiary",
  ],
  line: [
    "--ds-theme-color-line",
    "--dsw-alias-border-l1",
    "--dsw-alias-border-l2",
  ],
};

// These DSH aliases are opaque chips, code surfaces, menus, or standalone
// controls. They must use solid author colors even when the main panels become
// glass, otherwise a dark DreamSkin inherits DSH's light-mode fills and renders
// the author text color as white-on-white.
const DREAMSKIN_OPAQUE_SURFACE_MAP = {
  panel: [
    "--dsw-alias-markdown-code-block",
    "--dsw-alias-markdown-code-segment-unselected",
    "--dsw-alias-button-floating-fill",
    "--dsw-alias-bg-overlay",
  ],
  panelAlt: [
    "--dsw-alias-markdown-citation",
    "--dsw-alias-markdown-code-block-banner",
    "--dsw-alias-markdown-code-segment-selected",
    "--dsw-alias-markdown-inline-code",
    "--dsw-alias-markdown-placeholder",
    "--dsw-alias-markdown-tag",
    "--dsw-alias-button-elevated-fill",
    "--dsw-alias-button-floating-hover",
    "--dsw-alias-button-ghost-active-fill",
    "--dsw-alias-button-ghost-active-hover",
    "--dsw-alias-button-primary-dimmed",
    "--dsw-alias-interactive-bg-hover-solid",
    "--dsw-alias-bg-module-platform",
    "--dsw-alias-bg-multi-select",
    "--dsw-specific-selector",
    "--dsw-specific-tip",
  ],
};

/**
 * Convert a hex/rgb color to rgba with given alpha.
 * Accepts: "#rrggbb", "rgb(r,g,b)", "rgba(r,g,b,a)"
 */
function toRgba(color, alpha) {
  // hex
  const hex = color.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    const r = parseInt(h.slice(0,2),16);
    const g = parseInt(h.slice(2,4),16);
    const b = parseInt(h.slice(4,6),16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  // rgb / rgba
  const rgb = color.match(/rgba?\(([^)]+)\)/i);
  if (rgb) {
    const parts = rgb[1].split(",").map(s => s.trim());
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
  }
  return color;
}

function parseCssColor(value) {
  if (typeof value !== "string") return null;
  const color = value.trim();
  const hex = color.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3 || digits.length === 4) {
      digits = [...digits].map(char => char + char).join("");
    }
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: digits.length === 8 ? parseInt(digits.slice(6, 8), 16) / 255 : 1,
    };
  }

  const rgb = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (!rgb) return null;
  return {
    r: Math.min(255, Number(rgb[1])),
    g: Math.min(255, Number(rgb[2])),
    b: Math.min(255, Number(rgb[3])),
    a: rgb[4] === undefined ? 1 : Math.min(1, Number(rgb[4])),
  };
}

function opaque(color) {
  return color ? { r: color.r, g: color.g, b: color.b, a: 1 } : null;
}

function linearChannel(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color) {
  return 0.2126 * linearChannel(color.r)
    + 0.7152 * linearChannel(color.g)
    + 0.0722 * linearChannel(color.b);
}

function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function sourceReadabilitySurface(colors) {
  return opaque(parseCssColor(colors.panel)) || opaque(parseCssColor(colors.background));
}

function auditPair(value, surface, minimum) {
  const foreground = opaque(parseCssColor(value));
  const ratio = foreground && surface ? contrastRatio(foreground, surface) : null;
  return {
    value: value ?? null,
    ratio: ratio === null ? null : Number(ratio.toFixed(2)),
    minimum,
    pass: ratio !== null && ratio >= minimum,
  };
}

/** Return source contrast results for audit tooling without changing theme colors. */
export function auditDreamSkinReadability(themeJson) {
  const sourceColors = themeJson?.colors || {};
  const sourceSurface = sourceReadabilitySurface(sourceColors);
  return {
    source: {
      primary: auditPair(sourceColors.text, sourceSurface, TEXT_CONTRAST_RATIO),
      muted: auditPair(sourceColors.muted, sourceSurface, TEXT_CONTRAST_RATIO),
      accent: auditPair(sourceColors.accent, sourceSurface, ACCENT_CONTRAST_RATIO),
    },
  };
}

/**
 * Build CSS injection from a DreamSkin-format theme.json.
 *
 * @param {object} themeJson    Parsed theme.json (DreamSkin format)
 * @param {string|null} bgDataUrl  Background image as data: URL (or null)
 * @param {string|null} customCss  Optional extra theme.css text
 * @returns {string}
 */
export function buildDreamSkinCss(themeJson, bgDataUrl = null, customCss = null) {
  const lines = [
    "/* === DSH Skin — DreamSkin theme injection === */",
  ];

  const hasBackground = !!bgDataUrl;
  const colors = themeJson.colors || {};

  // ── 1. CSS variable tokens (:root) ─────────────────────────────────────────
  // DSH's official appearance is body-scoped and its Client plugin loads after
  // this linked stylesheet. Mirror tokens onto body and mark them important so
  // the selected skin remains the authoritative user choice.
  lines.push(":root,\nbody {");

  if (themeJson.appearance === "light" || themeJson.appearance === "dark") {
    lines.push(`  color-scheme: ${themeJson.appearance};`);
  }

  // Surface vars: provide defaults so [data-ds-part] selectors work even if
  // DSH doesn't define --ds-theme-surface-* natively.
  for (const [k, v] of Object.entries(SURFACE_DEFAULTS)) {
    lines.push(`  ${k}: ${v} !important;`);
  }

  for (const [colorKey, vars] of Object.entries(DREAMSKIN_COLOR_MAP)) {
    if (!colors[colorKey]) continue;
    let value = colors[colorKey];

    // When a background image is present, make panel / panelAlt semi-transparent
    // so the wallpaper shows through.
    if (hasBackground && (colorKey === "panel" || colorKey === "panelAlt")) {
      const glassAlpha = colorKey === "panel" ? PANEL_SURFACE_ALPHA : PANEL_ALT_SURFACE_ALPHA;
      value = toRgba(value, glassAlpha);
    }

    for (const v of vars) {
      const tokenValue = hasBackground && colorKey === "background" && v === "--dsw-alias-bg-base"
        ? toRgba(value, 0)
        : value;
      lines.push(`  ${v}: ${tokenValue} !important;`);
    }
  }

  for (const [colorKey, vars] of Object.entries(DREAMSKIN_OPAQUE_SURFACE_MAP)) {
    if (!colors[colorKey]) continue;
    for (const variable of vars) {
      lines.push(`  ${variable}: ${colors[colorKey]} !important;`);
    }
  }
  lines.push("}");

  // Keep this localization-independent and limited to the logo-row toggle.
  // CSS-module hashes may change, but the semantic class suffixes are stable in
  // the supported DSH Web client and avoid recoloring other secondary labels.
  lines.push(`
/* === DSH Skin — Native navigation affordance === */
[class*="_logoRow"] > button[class*="_iconButton"][class*="_toggle"] {
  color: var(--dsw-alias-label-primary) !important;
  background-color: var(--ds-theme-color-panel-alt, var(--dsw-alias-bg-layer-2)) !important;
  border: 1px solid var(--dsw-alias-border-l1) !important;
  border-radius: 6px !important;
}
`);

  // ── 2. Background layer ────────────────────────────────────────────────────
  if (bgDataUrl) {
    const art = themeJson.art || {};
    const focusX = art.focusX ?? 0.5;
    const focusY = art.focusY ?? 0.4;
    const posX = `${(focusX * 100).toFixed(1)}%`;
    const posY = `${(focusY * 100).toFixed(1)}%`;
    const blur  = themeJson.backgroundBlur ?? 0;
    const opacity = themeJson.backgroundOpacity ?? 1;
    // taskMode: "ambient" = lower opacity in chat/thread page
    const taskMode = art.taskMode ?? "fill";

    lines.push(`
/* === DSH Skin — Background Layer === */
body {
  isolation: isolate;
}
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  background-image: url("${bgDataUrl}");
  background-size: cover;
  background-position: ${posX} ${posY};
  background-repeat: no-repeat;
  opacity: ${opacity};
  ${blur > 0 ? `filter: blur(${blur}px);` : ""}
  pointer-events: none;
  transition: opacity 0.4s ease;
}

/* Transparent root so background shows through */
#root {
  background: transparent !important;
}
body { background: transparent !important; }

/* Glass panels when background is active */
[class*="sidebar"],
[class*="Sidebar"],
[class*="side-bar"],
[class*="SideBar"],
nav[class], aside[class] {
  background-color: var(--ds-theme-color-panel, var(--dsw-alias-bg-layer-1)) !important;
}

/* Blur leaf overlays, never navigation ancestors that contain fixed dialogs. */
[role="dialog"],
[data-ds-part="dialog"],
[data-ds-part="composer"] {
  backdrop-filter: blur(14px) saturate(1.4);
  -webkit-backdrop-filter: blur(14px) saturate(1.4);
}
`);

    // ambient mode: in chat/thread context reduce bg opacity
    if (taskMode === "ambient") {
      lines.push(`
/* Ambient mode: dim background in task / thread pages */
body[data-page="thread"]::before,
body[data-page="chat"]::before {
  opacity: ${Math.max(0.1, opacity * 0.45)};
}
`);
    }
  }

  // ── 3. Custom theme.css ────────────────────────────────────────────────────
  if (customCss) {
    lines.push("\n/* === Custom theme.css === */");
    lines.push(customCss);
  }

  return lines.join("\n");
}

/**
 * Build CSS injection from a legacy DSH theme.json (colors.light / colors.dark).
 *
 * @param {object} themeJson
 * @param {string|null} bgDataUrl
 * @returns {string}
 */
export function buildInjectionCss(themeJson, bgDataUrl = null) {
  // DreamSkin-format detection: flat colors object
  if (themeJson.colors && !themeJson.colors.light && !themeJson.colors.dark) {
    return buildDreamSkinCss(themeJson, bgDataUrl, null);
  }

  const lines = ["/* === DSH Skin — legacy theme injection === */"];

  if (themeJson.colors?.light) {
    lines.push("body {");
    for (const [k, v] of Object.entries(themeJson.colors.light)) {
      lines.push(`  ${k}: ${v} !important;`);
    }
    lines.push("}");
  }

  if (themeJson.colors?.dark) {
    lines.push("body[data-ds-dark-theme] {");
    for (const [k, v] of Object.entries(themeJson.colors.dark)) {
      lines.push(`  ${k}: ${v} !important;`);
    }
    lines.push("}");
  }

  if (bgDataUrl && themeJson.background) {
    const bg = themeJson.background;
    const opacity = bg.opacity ?? 1;
    const blur = bg.blur ?? 0;
    const size = bg.size ?? "cover";
    const position = bg.position ?? "center";

    lines.push(`
/* === DSH Skin Background Layer === */
body {
  isolation: isolate;
}
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  background-image: url("${bgDataUrl}");
  background-size: ${size};
  background-position: ${position};
  background-repeat: no-repeat;
  opacity: ${opacity};
  ${blur > 0 ? `filter: blur(${blur}px);` : ""}
  pointer-events: none;
}
#root {
  background: transparent !important;
}
body  { background: transparent !important; }
`);
  }

  return lines.join("\n");
}
