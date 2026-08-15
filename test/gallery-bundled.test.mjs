import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTheme } from "../src/lib/theme-manager.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(testDir);
const readJson = path => JSON.parse(readFileSync(path, "utf8"));

test("curated Gallery built-ins are redistributable, complete, and pinned", () => {
  const selection = readJson(join(repoRoot, "gallery", "bundled-themes.json"));
  const catalog = readJson(join(repoRoot, "gallery", "catalog.json"));
  const catalogById = new Map(catalog.themes.map(theme => [theme.themeId, theme]));
  const notices = readFileSync(join(repoRoot, "THIRD_PARTY_NOTICES.md"), "utf8");

  assert.equal(selection.schemaVersion, 1);
  assert.equal(selection.themes.length, 20);
  assert.equal(new Set(selection.themes.map(theme => theme.themeId)).size, 20);
  let bundledBackgroundBytes = 0;

  for (const selected of selection.themes) {
    assert.ok(["MIT", "CC BY 4.0"].includes(selected.license), selected.themeId);
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

test("package manifest ships exactly the curated Gallery directories", () => {
  const selection = readJson(join(repoRoot, "gallery", "bundled-themes.json"));
  const packageJson = readJson(join(repoRoot, "package.json"));
  const expected = selection.themes.map(theme => `gallery/themes/${theme.themeId}`).sort();
  const actual = packageJson.files.filter(path => path.startsWith("gallery/themes/")).sort();

  assert.deepEqual(actual, expected);
  assert.ok(packageJson.files.includes("gallery/bundled-themes.json"));
  assert.ok(packageJson.files.includes("THIRD_PARTY_NOTICES.md"));
});
