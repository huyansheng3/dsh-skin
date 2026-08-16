import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTheme } from "../src/lib/theme-manager.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(testDir);
const readJson = path => JSON.parse(readFileSync(path, "utf8"));
const RELEASE_GALLERY_IDS = [
  "deepseek",
  "120458",
  "123456",
  "annapurna-peak-v0.1.1",
  "anye",
  "astral-tidev2",
  "character-01",
  "custom-1785220478580",
  "hx24007-2026-08-012-0001",
  "ikun-red",
  "lucy-moon",
  "milky-way",
  "mingchao",
  "moonlight-kiss",
  "usr-49e16299682ecef4aa46.prosperity-mode",
];
const RELEASE_CORE_IDS = [
  "arina-hashimoto",
  "cyndi-sugarhigh-2.0",
  "gothic-void-crusade",
  "rei-blue-pencil",
];

test("release Gallery built-ins match the requested selection and are pinned", () => {
  const selection = readJson(join(repoRoot, "gallery", "bundled-themes.json"));
  const catalog = readJson(join(repoRoot, "gallery", "catalog.json"));
  const catalogById = new Map(catalog.themes.map(theme => [theme.themeId, theme]));
  const notices = readFileSync(join(repoRoot, "THIRD_PARTY_NOTICES.md"), "utf8");

  assert.equal(selection.schemaVersion, 1);
  assert.deepEqual(selection.themes.map(theme => theme.themeId), RELEASE_GALLERY_IDS);
  assert.equal(new Set(selection.themes.map(theme => theme.themeId)).size, RELEASE_GALLERY_IDS.length);
  let bundledBackgroundBytes = 0;

  for (const selected of selection.themes) {
    assert.ok(selected.license, `${selected.themeId}: missing declared license`);
    const catalogTheme = catalogById.get(selected.themeId);
    assert.ok(catalogTheme, `${selected.themeId}: missing from frozen catalog`);
    assert.equal(catalogTheme.compatibility, "native", selected.themeId);
    assert.equal(catalogTheme.sourceReadability, "pass", selected.themeId);
    for (const key of ["rank", "themeId", "name", "version", "versionId", "author", "license"]) {
      assert.equal(selected[key], catalogTheme[key], `${selected.themeId}: ${key}`);
    }

    const theme = loadTheme(join(repoRoot, "gallery", "themes", selected.themeId));
    assert.equal(theme.manifest.id, selected.themeId);
    assert.equal(theme.manifest.version, selected.version);
    assert.equal(theme.hasBackground, true);
    assert.equal(theme.hasCustomCss, true);
    assert.equal(basename(theme.backgroundPath), "background.webp");
    const bundledImageEntry = theme.manifest.files.find(entry => entry.path === "background.webp");
    assert.ok(bundledImageEntry, `${selected.themeId}: missing WebP manifest entry`);
    const provenance = readJson(join(theme.dir, "_dsh-skin.json"));
    assert.equal(provenance.versionId, selected.versionId);
    assert.equal(provenance.author, selected.author);
    assert.equal(provenance.license, selected.license);
    assert.equal(provenance.distribution.background.output.path, "background.webp");
    assert.equal(provenance.distribution.background.output.bytes, bundledImageEntry.bytes);
    assert.equal(provenance.distribution.background.output.sha256, bundledImageEntry.sha256);
    assert.ok(provenance.distribution.background.output.bytes
      < provenance.distribution.background.source.bytes, `${selected.themeId}: image did not shrink`);
    assert.equal(provenance.distribution.background.transform.cropped, false);
    assert.equal(provenance.distribution.background.transform.colorAdjusted, false);
    bundledBackgroundBytes += provenance.distribution.background.output.bytes;
    assert.ok(notices.includes(selected.versionId), `${selected.themeId}: missing notice version`);
    assert.ok(notices.includes(selected.author), `${selected.themeId}: missing notice author`);
  }
  assert.ok(bundledBackgroundBytes < 8 * 1024 * 1024, "bundled backgrounds exceed install budget");
});

test("package manifest ships exactly the requested release themes", () => {
  const selection = readJson(join(repoRoot, "gallery", "bundled-themes.json"));
  const packageJson = readJson(join(repoRoot, "package.json"));
  const expected = selection.themes.map(theme => `gallery/themes/${theme.themeId}`).sort();
  const actual = packageJson.files.filter(path => path.startsWith("gallery/themes/")).sort();

  assert.deepEqual(actual, expected);
  const coreDirectories = packageJson.files.filter(path => path.startsWith("themes/")).sort();
  assert.deepEqual(coreDirectories, RELEASE_CORE_IDS.map(id => `themes/${id}`).sort());
  for (const id of RELEASE_CORE_IDS) {
    const theme = loadTheme(join(repoRoot, "themes", id));
    assert.equal(theme.manifest.id, id);
    assert.equal(theme.hasBackground, true);
  }
  assert.ok(packageJson.files.includes("gallery/bundled-themes.json"));
  assert.ok(packageJson.files.includes("THIRD_PARTY_NOTICES.md"));
});
