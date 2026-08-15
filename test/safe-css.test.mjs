import { test } from "node:test";
import assert from "node:assert";
import {
  auditDreamSkinReadability,
  buildDreamSkinCss,
  buildInjectionCss,
  validateSafeCss,
} from "../src/lib/safe-css.mjs";

test("validateSafeCss accepts --dsw-* variable overrides", () => {
  const css = `
    --dsw-alias-bg-base: rgb(28, 25, 35);
    --dsw-alias-label-primary: rgb(230, 225, 240);
  `;
  const result = validateSafeCss(css);
  assert.ok(result.valid, `Expected valid, got errors: ${result.errors.join(", ")}`);
});

test("validateSafeCss accepts --ds-* variable overrides", () => {
  const css = `--ds-font-family-code: 'JetBrains Mono', monospace;`;
  const result = validateSafeCss(css);
  assert.ok(result.valid);
});

test("validateSafeCss rejects disallowed variable prefixes", () => {
  const css = `--evil-var: rgb(0, 0, 0);`;
  const result = validateSafeCss(css);
  assert.ok(!result.valid);
  assert.ok(result.errors.some((e) => e.includes("Disallowed CSS custom property")));
});

test("validateSafeCss blocks javascript: URLs", () => {
  const css = `background: javascript:alert(1);`;
  const result = validateSafeCss(css);
  assert.ok(!result.valid);
  assert.ok(result.errors.some((e) => e.includes("Blocked pattern")));
});

test("validateSafeCss blocks expression()", () => {
  const css = `width: expression(document.body.clientWidth);`;
  const result = validateSafeCss(css);
  assert.ok(!result.valid);
});

test("validateSafeCss blocks data: URLs", () => {
  const css = `background: url(data:image/png;base64,abc);`;
  const result = validateSafeCss(css);
  assert.ok(!result.valid);
});

test("validateSafeCss blocks @import", () => {
  const css = `@import url("evil.css");`;
  const result = validateSafeCss(css);
  assert.ok(!result.valid);
});

test("validateSafeCss blocks disallowed standard properties", () => {
  const css = `display: none;`;
  const result = validateSafeCss(css);
  assert.ok(!result.valid);
  assert.ok(result.errors.some((e) => e.includes("Disallowed CSS property: display")));
});

test("validateSafeCss allows background, opacity, filter, transition", () => {
  const css = `
    background-color: rgb(0, 0, 0);
    opacity: 0.5;
    filter: blur(4px);
    transition: background 0.3s ease;
  `;
  const result = validateSafeCss(css);
  assert.ok(result.valid, `Expected valid, got: ${result.errors.join(", ")}`);
});

test("buildInjectionCss generates light mode overrides", () => {
  const themeJson = {
    schema: 1,
    colors: {
      light: { "--dsw-alias-bg-base": "rgb(255, 0, 0)" },
      dark: { "--dsw-alias-bg-base": "rgb(0, 0, 255)" },
    },
  };
  const css = buildInjectionCss(themeJson, null);
  assert.ok(css.includes("body {"));
  assert.ok(css.includes("--dsw-alias-bg-base: rgb(255, 0, 0)"));
  assert.ok(css.includes("--dsw-alias-bg-base: rgb(255, 0, 0) !important"));
  assert.ok(css.includes("body[data-ds-dark-theme]"));
  assert.ok(css.includes("--dsw-alias-bg-base: rgb(0, 0, 255)"));
});

test("buildInjectionCss includes background layer when image is provided", () => {
  const themeJson = {
    schema: 1,
    colors: { light: {}, dark: {} },
    background: {
      file: "bg.jpg",
      opacity: 0.3,
    },
  };
  const css = buildInjectionCss(themeJson, "data:image/jpeg;base64,abc123");
  assert.ok(css.includes("body::before"));
  assert.ok(css.includes('content: ""'));
  assert.ok(css.includes("z-index: -1"));
  assert.doesNotMatch(css, /#root\s*\{[^}]*z-index/, "Root must not trap DSH portals below application panels");
  assert.ok(css.includes("url(\"data:image/jpeg;base64,abc123\")"));
  assert.ok(css.includes("opacity: 0.3"));
  assert.ok(css.includes("pointer-events: none"));
});

test("buildInjectionCss omits background layer when no image", () => {
  const themeJson = {
    schema: 1,
    colors: { light: {}, dark: {} },
  };
  const css = buildInjectionCss(themeJson, null);
  assert.ok(!css.includes("body::before"));
});

// ── DreamSkin format tests ────────────────────────────────────────────────────

test("buildDreamSkinCss maps flat colors to CSS variables", () => {
  const themeJson = {
    colors: {
      background: "#f6f6f7",
      panel: "#ebf2ff",
      panelAlt: "#e5f2ff",
      accent: "#418dbb",
      text: "#1b1c1d",
      line: "#d3d3d4",
    },
  };
  const css = buildDreamSkinCss(themeJson, null, null);
  assert.ok(css.includes(":root,\nbody {"), "Should override both the document and DSH's body-scoped theme");
  assert.ok(css.includes("--ds-theme-color-background"), "Should map background");
  assert.ok(css.includes("--dsw-alias-bg-base"),        "Should map dsw alias");
  assert.ok(css.includes("--ds-theme-color-accent"),    "Should map accent");
  assert.ok(!css.includes("--dsw-specific-sidebar-nav-item-active"), "Should not flatten selected navigation styling");
  assert.ok(css.includes("--dsw-alias-bg-module-platform: #e5f2ff !important"), "Opaque native surfaces should follow the theme palette");
  assert.ok(!css.includes("body::before"),               "No bg layer without image");
  assert.ok(!css.includes("settings dialog width"),      "Should leave host dialog geometry to DSH");
});

test("buildDreamSkinCss maps opaque native reading surfaces without recoloring text", () => {
  const css = buildDreamSkinCss({
    appearance: "dark",
    colors: {
      background: "#121412",
      panel: "#1c1e1d",
      panelAlt: "#282c29",
      text: "#eff0ef",
    },
  }, "data:image/jpeg;base64,X", null);

  for (const token of [
    "--dsw-alias-markdown-inline-code",
    "--dsw-alias-markdown-citation",
    "--dsw-alias-markdown-code-block-banner",
    "--dsw-alias-markdown-code-segment-selected",
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
  ]) {
    assert.ok(css.includes(`${token}: #282c29 !important`), token);
  }
  for (const token of [
    "--dsw-alias-markdown-code-block",
    "--dsw-alias-markdown-code-segment-unselected",
    "--dsw-alias-button-floating-fill",
    "--dsw-alias-bg-overlay",
  ]) {
    assert.ok(css.includes(`${token}: #1c1e1d !important`), token);
  }
  assert.ok(css.includes("--dsw-alias-bg-layer-1: rgba(28, 30, 29, 0.72) !important"));
  assert.ok(css.includes("--dsw-alias-bg-layer-2: rgba(40, 44, 41, 0.65) !important"));
  assert.ok(css.includes("--dsw-alias-label-primary: #eff0ef !important"));
});

test("buildDreamSkinCss injects background layer with glass panels when image is provided", () => {
  const themeJson = {
    colors: { panel: "#ebf2ff", background: "#f6f6f7" },
    art: { focusX: 0.31, focusY: 0.42 },
  };
  const css = buildDreamSkinCss(themeJson, "data:image/jpeg;base64,TEST", null);
  assert.ok(css.includes("body::before"),                   "Should have a real pseudo-element bg layer");
  assert.ok(css.includes("z-index: -1"),                    "Background should stay inside the isolated body stack");
  assert.doesNotMatch(css, /#root\s*\{[^}]*z-index/,        "Native portal stacking must remain owned by DSH");
  assert.ok(css.includes("backdrop-filter"),               "Should have glass panels");
  assert.ok(css.includes("background: transparent"),       "Should make root transparent");
  assert.match(css, /--dsw-alias-bg-base: rgba\(246, 246, 247, 0\) !important/, "DSH canvas should reveal the wallpaper");
  assert.match(css, /--ds-theme-color-background: #f6f6f7 !important/, "Semantic fallback color should remain solid");
  assert.doesNotMatch(css, /nav\[class\], aside\[class\]\s*\{[^}]*backdrop-filter/, "Navigation ancestors must not become fixed containing blocks");
  // focus point translated to %
  assert.ok(css.includes("31.0%"),                         "focusX → 31.0%");
  assert.ok(css.includes("42.0%"),                         "focusY → 42.0%");
});

test("buildDreamSkinCss makes panel semi-transparent when background is present", () => {
  const themeJson = { colors: { panel: "#ebf2ff", panelAlt: "#e5f2ff" } };
  const css = buildDreamSkinCss(themeJson, "data:image/jpeg;base64,X", null);
  assert.ok(css.includes("rgba(235, 242, 255, 0.72)"), "Primary panels should retain the original glass effect");
  assert.ok(css.includes("rgba(229, 242, 255, 0.65)"), "Secondary panels should retain the original glass effect");
});

test("buildDreamSkinCss preserves the semantic base while revealing background artwork", () => {
  const themeJson = {
    appearance: "light",
    colors: {
      background: "#f6f1e7",
      panel: "#fbf8f1",
      panelAlt: "#e8eff4",
      text: "#2e3b46",
      muted: "#69757e",
    },
  };
  const css = buildDreamSkinCss(themeJson, "data:image/jpeg;base64,X", null);
  assert.ok(css.includes("--ds-theme-color-background: #f6f1e7 !important"));
  assert.ok(css.includes("--dsw-alias-bg-base: rgba(246, 241, 231, 0) !important"));
  assert.ok(!css.includes("rgba(246, 241, 231, 0.86)"));
  assert.ok(css.includes("color-scheme: light"));
});

test("buildDreamSkinCss leaves native color scheme unchanged for auto appearance", () => {
  const darkCss = buildDreamSkinCss({
    appearance: "auto",
    colors: {
      background: "#131313",
      panel: "#1e1e1d",
      panelAlt: "#2b2b2a",
      text: "#f0f0ef",
      muted: "#939393",
    },
  }, "data:image/jpeg;base64,X", null);
  assert.ok(!darkCss.includes("color-scheme:"));

  const lightCss = buildDreamSkinCss({
    appearance: "auto",
    colors: {
      background: "#f6f1e7",
      panel: "#fbf8f1",
      panelAlt: "#e8eff4",
      text: "#2e3b46",
      muted: "#69757e",
    },
  }, "data:image/jpeg;base64,X", null);
  assert.ok(!lightCss.includes("color-scheme:"));
});

test("buildDreamSkinCss preserves low-contrast author colors for theme fidelity", () => {
  const themeJson = {
    colors: {
      background: "#ffffff",
      panel: "#ffffff",
      panelAlt: "#f8f8f8",
      accent: "#f0f0f0",
      text: "#eeeeee",
      muted: "#eeeeee",
    },
  };
  const css = buildDreamSkinCss(themeJson, null, null);
  assert.match(css, /--dsw-alias-label-primary: #eeeeee/);
  assert.match(css, /--dsw-alias-label-secondary: #eeeeee/);
  assert.match(css, /--dsw-alias-brand-primary: #f0f0f0/);

  const audit = auditDreamSkinReadability(themeJson);
  assert.equal(audit.source.primary.pass, false);
});

test("custom CSS remains last and is not followed by readability guardrails", () => {
  const themeJson = {
    colors: {
      background: "#fff",
      panel: "#fff",
      panelAlt: "#f8f8f8",
      text: "#111",
      muted: "#555",
    },
  };
  const customCss = ":root { --dsw-alias-bg-base: rgba(255, 255, 255, 0.05); }";
  const css = buildDreamSkinCss(themeJson, "data:image/jpeg;base64,X", customCss);
  assert.ok(css.trimEnd().endsWith(customCss));
  assert.ok(!css.includes("Readability guardrails"));
});

test("buildDreamSkinCss appends custom CSS", () => {
  const themeJson = { colors: { background: "#000" } };
  const customCss = "[data-ds-part='sidebar'] { border-radius: 8px; }";
  const css = buildDreamSkinCss(themeJson, null, customCss);
  assert.ok(css.includes("Custom theme.css"), "Should include custom CSS marker");
  assert.ok(css.includes("border-radius: 8px"), "Should include custom CSS content");
});

test("validateSafeCss accepts --ds-theme-color-* variables", () => {
  const css = `--ds-theme-color-background: #fff; --ds-theme-color-accent: #418dbb;`;
  const { valid, errors } = validateSafeCss(css);
  assert.ok(valid, `Expected valid, got: ${errors.join(", ")}`);
});

test("validateSafeCss accepts border properties", () => {
  const css = `border-radius: 8px; border-color: rgba(0,0,0,0.1); box-shadow: 0 2px 8px rgba(0,0,0,0.2);`;
  const { valid, errors } = validateSafeCss(css);
  assert.ok(valid, `Expected valid, got: ${errors.join(", ")}`);
});

test("validateSafeCss accepts DreamSkin border and transition longhands", () => {
  const css = `[data-ds-part="sidebar"] {
    border-top-color: var(--ds-theme-color-line);
    border-top-width: 1px;
    border-top-style: solid;
    border-right-color: transparent;
    border-right-width: 0;
    border-right-style: solid;
    border-bottom-color: var(--ds-theme-color-line);
    border-bottom-width: 1px;
    border-bottom-style: solid;
    border-left-color: transparent;
    border-left-width: 0;
    border-left-style: solid;
    transition-property: background-color, border-color, box-shadow;
    transition-duration: 180ms;
  }`;
  const { valid, errors } = validateSafeCss(css);
  assert.ok(valid, `Expected DreamSkin longhands to be valid, got: ${errors.join(", ")}`);
});

test("validateSafeCss accepts bounded official DreamSkin typography and spacing", () => {
  const css = `[data-ds-part="message"] {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.5;
    letter-spacing: 1px;
    gap: 12px;
    row-gap: 8px;
    column-gap: 16px;
    border-top-left-radius: 12px;
    border-top-right-radius: 12px;
    border-bottom-right-radius: 18px;
    border-bottom-left-radius: 18px;
  }`;
  const { valid, errors } = validateSafeCss(css);
  assert.ok(valid, `Expected official bounded properties to be valid, got: ${errors.join(", ")}`);
});

test("validateSafeCss rejects out-of-contract typography and spacing values", () => {
  const css = `[data-ds-part="message"] {
    font-size: 100px;
    font-weight: 900;
    line-height: 0.5;
    letter-spacing: -2px;
    gap: 80px;
    border-top-left-radius: 100px;
  }`;
  const { valid, errors } = validateSafeCss(css);
  assert.equal(valid, false);
  assert.equal(errors.filter(error => error.includes("Out-of-range CSS value")).length, 6);
});
