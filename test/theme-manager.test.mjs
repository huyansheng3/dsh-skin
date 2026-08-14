import { test } from "node:test";
import assert from "node:assert";
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadTheme, listThemes, getThemesDir } from "../src/lib/theme-manager.mjs";

const FIXTURE_THEME_DIR = join(import.meta.dirname, "fixtures", "test-theme");

// Create a fixture theme for testing
function createFixtureTheme() {
  if (existsSync(FIXTURE_THEME_DIR)) {
    rmSync(FIXTURE_THEME_DIR, { recursive: true, force: true });
  }
  mkdirSync(FIXTURE_THEME_DIR, { recursive: true });

  writeFileSync(
    join(FIXTURE_THEME_DIR, "manifest.json"),
    JSON.stringify({
      schema: 1,
      id: "test-theme",
      name: "Test Theme",
      version: "1.0.0",
      platform: "any",
      capabilities: {
        "css-variables": true,
        "background-image": false,
        "safe-css": false,
      },
    })
  );

  writeFileSync(
    join(FIXTURE_THEME_DIR, "theme.json"),
    JSON.stringify({
      schema: 1,
      colors: {
        light: { "--dsw-alias-bg-base": "rgb(255, 0, 0)" },
        dark: { "--dsw-alias-bg-base": "rgb(0, 0, 255)" },
      },
    })
  );
}

test("loadTheme reads and validates a theme directory", () => {
  createFixtureTheme();
  const theme = loadTheme(FIXTURE_THEME_DIR);
  assert.equal(theme.manifest.id, "test-theme");
  assert.equal(theme.manifest.name, "Test Theme");
  assert.equal(theme.themeJson.colors.light["--dsw-alias-bg-base"], "rgb(255, 0, 0)");
  assert.equal(theme.hasBackground, false);
  assert.equal(theme.hasCustomCss, false);
});

test("loadTheme throws on missing manifest", () => {
  const emptyDir = join(import.meta.dirname, "fixtures", "empty");
  if (existsSync(emptyDir)) rmSync(emptyDir, { recursive: true, force: true });
  mkdirSync(emptyDir, { recursive: true });

  assert.throws(() => loadTheme(emptyDir), /Missing manifest\.json/);
});

test("loadTheme throws on unsupported schema", () => {
  createFixtureTheme();
  writeFileSync(
    join(FIXTURE_THEME_DIR, "manifest.json"),
    JSON.stringify({ schema: 2, id: "test", name: "Test", version: "1.0.0" })
  );
  assert.throws(() => loadTheme(FIXTURE_THEME_DIR), /Unsupported manifest schema/);
});

test("listThemes returns an array", () => {
  // This just checks it doesn't throw — the actual list depends on installed themes
  const themes = listThemes();
  assert.ok(Array.isArray(themes));
});

// Cleanup
test("cleanup fixture", () => {
  if (existsSync(FIXTURE_THEME_DIR)) {
    rmSync(FIXTURE_THEME_DIR, { recursive: true, force: true });
  }
  const emptyDir = join(import.meta.dirname, "fixtures", "empty");
  if (existsSync(emptyDir)) {
    rmSync(emptyDir, { recursive: true, force: true });
  }
});
