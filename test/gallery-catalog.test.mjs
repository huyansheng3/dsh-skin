import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const repoRoot = dirname(import.meta.dirname);
const catalogPath = join(repoRoot, "gallery", "catalog.json");

test("frozen Gallery catalog contains exactly 100 verified official packages", () => {
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.themes.length, 100);
  assert.deepEqual(catalog.themes.map(theme => theme.rank), Array.from({ length: 100 }, (_, index) => index + 1));
  assert.equal(new Set(catalog.themes.map(theme => theme.versionId)).size, 100);
  assert.equal(new Set(catalog.themes.map(theme => theme.themeId)).size, 100);

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
