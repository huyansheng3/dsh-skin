/**
 * Safe CSS validator & CSS generator for DSH Skin.
 *
 * Supports two theme formats:
 *   1. Legacy DSH format — colors.light / colors.dark with --dsw-alias-* vars
 *   2. DreamSkin format  — flat colors object (background/panel/accent/…)
 *                          mapped to both --ds-theme-color-* and --dsw-* vars
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
  "border-radius",
  "border-width",
  "border-style",
  "border-color",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "box-shadow",
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

  const colors = themeJson.colors || {};
  const hasBackground = !!bgDataUrl;

  // ── 1. CSS variable tokens (:root) ─────────────────────────────────────────
  lines.push(":root {");
  for (const [colorKey, vars] of Object.entries(DREAMSKIN_COLOR_MAP)) {
    if (!colors[colorKey]) continue;
    let value = colors[colorKey];

    // When a background image is present, make panel / panelAlt semi-transparent
    // so the wallpaper shows through.
    if (hasBackground && (colorKey === "panel" || colorKey === "panelAlt")) {
      const glassAlpha = colorKey === "panel" ? 0.72 : 0.65;
      value = toRgba(value, glassAlpha);
    }

    for (const v of vars) {
      lines.push(`  ${v}: ${value};`);
    }
  }
  lines.push("}");

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
#dsh-skin-bg-layer {
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
#root,
body { background: transparent !important; }

/* Glass panels when background is active */
[class*="sidebar"],
[class*="Sidebar"],
[class*="side-bar"],
[class*="SideBar"],
nav[class], aside[class] {
  background-color: var(--ds-theme-color-panel, var(--dsw-alias-bg-layer-1)) !important;
  backdrop-filter: blur(14px) saturate(1.4);
  -webkit-backdrop-filter: blur(14px) saturate(1.4);
}
`);

    // ambient mode: in chat/thread context reduce bg opacity
    if (taskMode === "ambient") {
      lines.push(`
/* Ambient mode: dim background in task / thread pages */
body[data-page="thread"] #dsh-skin-bg-layer,
body[data-page="chat"]   #dsh-skin-bg-layer {
  opacity: ${Math.max(0.1, opacity * 0.45)};
}
`);
    }
  }

  // ── 3. Custom theme.css (stripped of --dsw-* / data-ds-part selectors) ──────
  if (customCss) {
    lines.push("\n/* === Custom theme.css === */");
    // Re-map [data-ds-part] selectors: keep the CSS vars, they now work via :root
    // Also keep any selector that doesn't depend on Codex-specific DOM structure
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
      lines.push(`  ${k}: ${v};`);
    }
    lines.push("}");
  }

  if (themeJson.colors?.dark) {
    lines.push("body[data-ds-dark-theme] {");
    for (const [k, v] of Object.entries(themeJson.colors.dark)) {
      lines.push(`  ${k}: ${v};`);
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
#dsh-skin-bg-layer {
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
#root { background: transparent !important; }
body  { background: transparent !important; }
`);
  }

  return lines.join("\n");
}
