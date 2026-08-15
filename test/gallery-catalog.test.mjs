import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { validateCatalog } from "../scripts/vendor-gallery-themes.mjs";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(testDir);
const catalogPath = join(repoRoot, "gallery", "catalog.json");
const exclusionsPath = join(repoRoot, "gallery", "exclusions.json");

test("curated Gallery catalog excludes the 24 source-quality failures", () => {
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  const exclusions = JSON.parse(readFileSync(exclusionsPath, "utf8"));
  assert.equal(catalog.schemaVersion, 2);
  assert.equal(catalog.auditedThemeCount, 100);
  assert.equal(exclusions.schemaVersion, 1);
  assert.equal(exclusions.themeIds.length, 24);
  assert.equal(new Set(exclusions.themeIds).size, 24);
  assert.deepEqual(catalog.excludedThemeIds, exclusions.themeIds);
  assert.equal(catalog.themes.length, 76);
  assert.equal(new Set(catalog.themes.map(theme => theme.versionId)).size, 76);
  assert.equal(new Set(catalog.themes.map(theme => theme.themeId)).size, 76);
  assert.ok(catalog.themes.every(theme => !exclusions.themeIds.includes(theme.themeId)));
  assert.ok(catalog.themes.every(theme => (
    theme.compatibility === "generated-theme-css" || theme.sourceReadability === "pass"
  )));

  for (const theme of catalog.themes) {
    assert.match(theme.versionId, /^ver_[a-z0-9]+$/);
    assert.ok(theme.themeId);
    assert.ok(theme.name);
    assert.ok(theme.version);
    assert.ok(theme.author);
    assert.equal(typeof theme.license, "string");
    assert.ok(Number.isSafeInteger(theme.package.bytes) && theme.package.bytes > 0);
    assert.match(theme.package.sha256, /^[a-f0-9]{64}$/);
    assert.equal(theme.package.file, `${String(theme.rank).padStart(3, "0")}-${theme.versionId}.zip`);
    assert.ok(["native", "generated-theme-css"].includes(theme.compatibility));
  }
});

test("catalog explicitly records the seven upstream packages missing theme.css", () => {
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  const repaired = catalog.themes.filter(theme => theme.compatibility === "generated-theme-css");
  assert.deepEqual(repaired.map(theme => theme.themeId), [
    "dreamskin-2560x1440",
    "mikuu-full-background",
    "12333",
    "bhieicjgdegab-73sx6aglmp",
    "shengji",
    "call-bsiisjqeqfnfkyb1lclwk1po",
    "wallpaper-1",
  ]);
});

test("vendoring rejects catalog package paths that can escape the cache", () => {
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  catalog.themes[0].package.file = "../outside.zip";
  assert.throws(() => validateCatalog(catalog), /package filename/i);
});
