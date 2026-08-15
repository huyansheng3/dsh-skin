#!/usr/bin/env node

/**
 * Build the frozen Gallery metadata catalog from the detailed
 * audit report. A committed quality exclusion list removes known low-contrast
 * source themes before the catalog pins official version IDs, package hashes,
 * sizes, authors, licenses, and compatibility status for vendoring.
 *
 * Input is the committed audit snapshot; output is metadata only. This script
 * does not download packages, copy artwork, decide redistribution rights, or
 * alter the runtime theme selection.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = join(repoRoot, "docs", "gallery-top-100.json");
const exclusionsPath = join(repoRoot, "gallery", "exclusions.json");
const catalogPath = join(repoRoot, "gallery", "catalog.json");

const report = JSON.parse(readFileSync(reportPath, "utf8"));
if (report.results?.length !== 100) {
  throw new Error(`Expected a 100-theme audit snapshot, got ${report.results?.length ?? 0}`);
}
const exclusions = JSON.parse(readFileSync(exclusionsPath, "utf8"));
if (exclusions?.schemaVersion !== 1 || !Array.isArray(exclusions.themeIds)) {
  throw new Error("Gallery exclusions must use schemaVersion 1 and contain themeIds");
}
const excludedIds = new Set(exclusions.themeIds);
if (excludedIds.size !== exclusions.themeIds.length) {
  throw new Error("Gallery exclusions must contain unique theme IDs");
}
const excludedResults = report.results.filter(item => excludedIds.has(item.themeId));
if (excludedResults.length !== excludedIds.size
    || excludedResults.some(item => !item.importPass || item.sourceReadabilityPass)) {
  throw new Error("Gallery exclusions must exactly match importable source-readability warnings");
}
const includedResults = report.results.filter(item => !excludedIds.has(item.themeId));

const catalog = {
  schemaVersion: 2,
  snapshotAt: report.auditedAt,
  source: report.source,
  auditedThemeCount: report.results.length,
  excludedThemeIds: exclusions.themeIds,
  notice: "Low-contrast source themes are excluded. Retained packages remain under their authors' listed licenses; only the separately reviewed bundled-themes.json selection is redistributed.",
  themes: includedResults.map(item => ({
    rank: item.rank,
    versionId: item.id,
    themeId: item.themeId,
    name: item.name,
    version: item.version,
    author: item.authorDisplayName || item.authorUserId,
    authorUserId: item.authorUserId,
    license: item.license || "Unspecified",
    package: {
      file: item.packageFile,
      bytes: item.packageBytes,
      sha256: item.packageSha256,
    },
    compatibility: item.importPass ? "native" : "generated-theme-css",
    galleryApplyCompatible: item.applyCompatible,
    sourceReadability: item.sourceReadabilityPass ? "pass" : "warning",
  })),
};

mkdirSync(dirname(catalogPath), { recursive: true });
writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
process.stdout.write(`Wrote ${catalog.themes.length} themes to ${catalogPath}\n`);
