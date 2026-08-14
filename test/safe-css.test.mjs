import { test } from "node:test";
import assert from "node:assert";
import { validateSafeCss, buildInjectionCss } from "../src/lib/safe-css.mjs";

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
