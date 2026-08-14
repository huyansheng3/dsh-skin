import { test } from "node:test";
import assert from "node:assert";
import { validateSafeCss, buildInjectionCss, buildDreamSkinCss } from "../src/lib/safe-css.mjs";

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
  assert.ok(css.includes("#dsh-skin-bg-layer"));
  assert.ok(css.includes("url(\"data:image/jpeg;base64,abc123\")"));
  assert.ok(css.includes("opacity: 0.3"));
});

test("buildInjectionCss omits background layer when no image", () => {
  const themeJson = {
    schema: 1,
    colors: { light: {}, dark: {} },
  };
  const css = buildInjectionCss(themeJson, null);
  assert.ok(!css.includes("#dsh-skin-bg-layer"));
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
  assert.ok(css.includes(":root {"), "Should have :root block");
  assert.ok(css.includes("--ds-theme-color-background"), "Should map background");
  assert.ok(css.includes("--dsw-alias-bg-base"),        "Should map dsw alias");
  assert.ok(css.includes("--ds-theme-color-accent"),    "Should map accent");
  assert.ok(!css.includes("#dsh-skin-bg-layer"),        "No bg layer without image");
});

test("buildDreamSkinCss injects background layer with glass panels when image is provided", () => {
  const themeJson = {
    colors: { panel: "#ebf2ff", background: "#f6f6f7" },
    art: { focusX: 0.31, focusY: 0.42 },
  };
  const css = buildDreamSkinCss(themeJson, "data:image/jpeg;base64,TEST", null);
  assert.ok(css.includes("#dsh-skin-bg-layer"),            "Should have bg layer");
  assert.ok(css.includes("backdrop-filter"),               "Should have glass panels");
  assert.ok(css.includes("background: transparent"),       "Should make root transparent");
  // focus point translated to %
  assert.ok(css.includes("31.0%"),                         "focusX → 31.0%");
  assert.ok(css.includes("42.0%"),                         "focusY → 42.0%");
});

test("buildDreamSkinCss makes panel semi-transparent when background is present", () => {
  const themeJson = { colors: { panel: "#ebf2ff", panelAlt: "#e5f2ff" } };
  const css = buildDreamSkinCss(themeJson, "data:image/jpeg;base64,X", null);
  assert.ok(css.includes("rgba("), "Panel colors should become rgba");
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
