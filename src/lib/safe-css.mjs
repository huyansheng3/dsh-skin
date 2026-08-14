/**
 * Safe CSS validator — ensures injected CSS only overrides registered
 * CSS custom properties and background styling, never executes scripts
 * or modifies structural layout.
 *
 * The allowed CSS property set is bounded to the --dsw-* token system
 * and a small set of presentation properties for the background layer.
 */

import { readFileSync } from "node:fs";

// All allowed CSS custom property prefixes (from DSH ui-theme/design-platform.css)
const ALLOWED_VAR_PREFIXES = [
  "--dsw-static-",
  "--dsw-alias-",
  "--dsw-specific-",
  "--dsw-font-",
  "--ds-",
];

// Allowed CSS properties (beyond custom properties) for theme.css
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
  "transition",
  "color",
  "font-family",
  "border-radius",
]);

// Blocked patterns — any match rejects the CSS
const BLOCKED_PATTERNS = [
  /javascript:/i,
  /expression\s*\(/i,
  /url\s*\(\s*['"]?\s*data:/i,
  /url\s*\(\s*['"]?\s*file:/i,
  /@import/i,
  /position\s*:\s*fixed/i, // only background layer can be fixed, via our own injection
  /<script/i,
];

/**
 * Validate that CSS is safe to inject.
 * @param css Raw CSS text
 * @returns { valid: boolean, errors: string[] }
 */
export function validateSafeCss(css) {
  const errors = [];

  // Check blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(css)) {
      errors.push(`Blocked pattern detected: ${pattern.source}`);
    }
  }

  // Parse declarations (simplified — handles `--var: value;` and `prop: value;`)
  const declarationRegex = /([\w-]+)\s*:\s*([^;{}]+)\s*(?:;|$)/g;
  let match;
  while ((match = declarationRegex.exec(css)) !== null) {
    const property = match[1].trim();

    // CSS custom property (--*)
    if (property.startsWith("--")) {
      const isAllowed = ALLOWED_VAR_PREFIXES.some((prefix) =>
        property.startsWith(prefix)
      );
      if (!isAllowed) {
        errors.push(
          `Disallowed CSS custom property: ${property}. Only --dsw-* and --ds-* prefixes are allowed.`
        );
      }
      continue;
    }

    // Standard CSS property
    if (!ALLOWED_PROPERTIES.has(property.toLowerCase())) {
      errors.push(
        `Disallowed CSS property: ${property}. Only variable overrides and presentation properties are allowed.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Build the CSS text to inject from a theme.json's colors + optional background.
 */
export function buildInjectionCss(themeJson, backgroundDataUrl = null) {
  const lines = [];

  // Light mode overrides
  if (themeJson.colors?.light) {
    lines.push("body {");
    for (const [key, value] of Object.entries(themeJson.colors.light)) {
      lines.push(`  ${key}: ${value};`);
    }
    lines.push("}");
  }

  // Dark mode overrides
  if (themeJson.colors?.dark) {
    lines.push("body[data-ds-dark-theme] {");
    for (const [key, value] of Object.entries(themeJson.colors.dark)) {
      lines.push(`  ${key}: ${value};`);
    }
    lines.push("}");
  }

  // Background image layer
  if (backgroundDataUrl && themeJson.background) {
    const bg = themeJson.background;
    const opacity = bg.opacity ?? 1;
    const blur = bg.blur ?? 0;
    const size = bg.size ?? "cover";
    const position = bg.position ?? "center";

    // Inject a fixed background layer behind #root
    lines.push(`
/* === DSH Skin Background Layer === */
#dsh-skin-bg-layer {
  position: fixed;
  inset: 0;
  z-index: -1;
  background-image: url("${backgroundDataUrl}");
  background-size: ${size};
  background-position: ${position};
  background-repeat: no-repeat;
  opacity: ${opacity};
  ${blur > 0 ? `filter: blur(${blur}px);` : ""}
  pointer-events: none;
}
/* Ensure #root background is transparent so the bg layer shows through */
#root {
  background: transparent !important;
}
/* Make layered panels semi-transparent for background visibility */
body { background: transparent !important; }
`);
  }

  return lines.join("\n");
}
