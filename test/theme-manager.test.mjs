import { after, before, test } from "node:test";
import assert from "node:assert";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { importThemeZip, loadTheme, listThemes, getThemesDir } from "../src/lib/theme-manager.mjs";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURE_THEME_DIR = join(TEST_DIR, "fixtures", "test-theme");
const TEST_DATA_DIR = mkdtempSync(join(tmpdir(), "dsh-skin-theme-manager-test-"));

before(() => {
  process.env.DSH_SKIN_DATA_DIR = TEST_DATA_DIR;
});

after(() => {
  delete process.env.DSH_SKIN_DATA_DIR;
  rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

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
  const emptyDir = join(TEST_DIR, "fixtures", "empty");
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

test("bundled illustrated DreamSkin themes load with background assets", () => {
  const repoRoot = dirname(TEST_DIR);
  for (const id of ["cyndi-sugarhigh-2.0", "gothic-void-crusade"]) {
    const theme = loadTheme(join(repoRoot, "themes", id));
    assert.equal(theme.format, "dreamskin");
    assert.equal(theme.manifest.id, id);
    assert.equal(theme.hasBackground, true);
    assert.equal(theme.hasCustomCss, true);
  }
});

test("duplicate ZIP import cleans its extracted temporary directory", async () => {
  const repoRoot = dirname(TEST_DIR);
  const sourceDir = join(TEST_DATA_DIR, "zip-source");
  const zipPath = join(TEST_DATA_DIR, "zip-cleanup-test.zip");
  cpSync(join(repoRoot, "themes", "gothic-void-crusade"), sourceDir, { recursive: true });

  const manifestPath = join(sourceDir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.themeId = "zip-cleanup-test";
  manifest.name = "ZIP Cleanup Test";
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  execFileSync("zip", ["-qr", zipPath, "."], { cwd: sourceDir });

  const tempImports = () => readdirSync(tmpdir())
    .filter(entry => entry.startsWith("dsh-skin-import-"))
    .sort();
  const beforeImport = tempImports();

  await importThemeZip(zipPath);
  await assert.rejects(importThemeZip(zipPath), /already exists/);
  assert.deepEqual(tempImports(), beforeImport);
});

test("vendoring may synthesize bounded CSS without weakening normal ZIP imports", async () => {
  const repoRoot = dirname(TEST_DIR);
  const sourceDir = join(TEST_DATA_DIR, "missing-css-source");
  const zipPath = join(TEST_DATA_DIR, "missing-css.zip");
  cpSync(join(repoRoot, "themes", "gothic-void-crusade"), sourceDir, { recursive: true });
  rmSync(join(sourceDir, "theme.css"));

  const manifestPath = join(sourceDir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.themeId = "missing-css-compatibility-test";
  manifest.name = "Missing CSS Compatibility Test";
  manifest.files = manifest.files.filter(file => file.path !== "theme.css");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  execFileSync("zip", ["-qr", zipPath, "."], { cwd: sourceDir });

  await assert.rejects(
    importThemeZip(zipPath),
    /DreamSkin ZIP must include a background image and non-empty theme\.css/,
  );

  const compatibilityCss = '[data-ds-part="root"] { color: var(--ds-theme-color-text); }\n';
  const imported = await importThemeZip(zipPath, { compatibilityCss });
  assert.equal(imported.manifest.id, "missing-css-compatibility-test");
  assert.equal(imported.customCss, compatibilityCss);
  assert.equal(imported.hasCustomCss, true);
});

// Cleanup
test("cleanup fixture", () => {
  if (existsSync(FIXTURE_THEME_DIR)) {
    rmSync(FIXTURE_THEME_DIR, { recursive: true, force: true });
  }
  const emptyDir = join(TEST_DIR, "fixtures", "empty");
  if (existsSync(emptyDir)) {
    rmSync(emptyDir, { recursive: true, force: true });
  }
});
