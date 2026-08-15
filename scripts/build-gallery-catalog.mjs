#!/usr/bin/env node

/**
 * Build the frozen, redistributable Gallery metadata catalog from the detailed
 * audit report. The catalog pins official version IDs, package hashes, sizes,
 * authors, licenses, and compatibility status used by the vendoring workflow.
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
const catalogPath = join(repoRoot, "gallery", "catalog.json");

const report = JSON.parse(readFileSync(reportPath, "utf8"));
if (report.results?.length !== 100) {
  throw new Error(`Expected a 100-theme audit snapshot, got ${report.results?.length ?? 0}`);
}

const catalog = {
  schemaVersion: 1,
  snapshotAt: report.auditedAt,
  source: report.source,
  notice: "Theme packages remain under their authors' listed licenses and are not redistributed by dsh-skin.",
  themes: report.results.map(item => ({
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
    normalizedReadability: item.normalizedReadabilityPass ? "pass" : "unverified",
  })),
};

mkdirSync(dirname(catalogPath), { recursive: true });
writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
process.stdout.write(`Wrote ${catalog.themes.length} themes to ${catalogPath}\n`);
