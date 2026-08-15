#!/usr/bin/env node
/**
 * Audit DreamSkin Gallery packages against dsh-skin's import and readability
 * contract. Popular metadata flows from the public API into a bounded download
 * queue, SHA-256 verification, an isolated theme library, Safe CSS validation,
 * and source/normalized contrast reports ordered by Gallery rank.
 *
 * Entry point: `npm run audit:gallery -- [options]`. Generated JSON and Markdown
 * are the durable outputs; an optional cache/data directory supports follow-up
 * browser testing. This script does not activate themes, start DSH, alter the
 * user's theme library, bypass import checks, or publish/download at runtime.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { importThemeZip } from "../src/lib/theme-manager.mjs";
import { auditDreamSkinReadability, validateSafeCss } from "../src/lib/safe-css.mjs";

const API_BASE = "https://api.dreamskin.cc/v1";
const API_PAGE_SIZE = 40;
const DEFAULT_LIMIT = 100;
const DOWNLOAD_CONCURRENCY = 6;
const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  return `Usage: node scripts/audit-gallery-themes.mjs [options]

Options:
  --limit <n>        Popular themes to audit (default: 100)
  --out-json <path>  JSON report (default: docs/gallery-top-100.json)
  --out-md <path>    Markdown report (default: docs/GALLERY-AUDIT.md)
  --cache-dir <path> Keep downloaded ZIP files for follow-up testing
  --data-dir <path>  Keep the isolated imported theme library
  --help             Show this message
`;
}

function parseArgs(argv) {
  const options = {
    limit: DEFAULT_LIMIT,
    outJson: join(ROOT_DIR, "docs", "gallery-top-100.json"),
    outMd: join(ROOT_DIR, "docs", "GALLERY-AUDIT.md"),
    cacheDir: null,
    dataDir: null,
  };
  const names = new Map([
    ["--limit", "limit"],
    ["--out-json", "outJson"],
    ["--out-md", "outMd"],
    ["--cache-dir", "cacheDir"],
    ["--data-dir", "dataDir"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") return { help: true };
    const key = names.get(arg);
    if (!key || argv[index + 1] === undefined) throw new Error(`Unknown or incomplete option: ${arg}`);
    const value = argv[index += 1];
    options[key] = key === "limit" ? Number(value) : resolve(value);
  }
  if (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 335) {
    throw new Error("--limit must be an integer between 1 and 335");
  }
  return options;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function listPopularThemes(limit) {
  const items = [];
  for (let offset = 0; items.length < limit; offset += API_PAGE_SIZE) {
    const pageLimit = Math.min(API_PAGE_SIZE, limit - items.length);
    const page = await fetchJson(`${API_BASE}/themes?limit=${pageLimit}&offset=${offset}&sort=popular`);
    items.push(...page.items);
    if (page.items.length < pageLimit) break;
  }
  return items.slice(0, limit);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function downloadTheme(theme, cacheDir) {
  const filename = `${String(theme.rank).padStart(3, "0")}-${theme.id}.zip`;
  const path = join(cacheDir, filename);
  if (existsSync(path)) {
    const data = readFileSync(path);
    if (sha256(data) === theme.packageSha256) return path;
  }
  const response = await fetch(`${API_BASE}/themes/${encodeURIComponent(theme.id)}/download`);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const data = Buffer.from(await response.arrayBuffer());
  const actual = sha256(data);
  if (actual !== theme.packageSha256) {
    throw new Error(`package SHA-256 mismatch: expected ${theme.packageSha256}, got ${actual}`);
  }
  writeFileSync(path, data);
  return path;
}

async function parallelMap(values, concurrency, mapper) {
  const results = new Array(values.length);
  let next = 0;
  async function worker() {
    while (next < values.length) {
      const index = next;
      next += 1;
      try {
        results[index] = { value: await mapper(values[index], index), error: null };
      } catch (error) {
        results[index] = { value: null, error: error instanceof Error ? error.message : String(error) };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

function pairFailures(audit) {
  return Object.entries(audit.source)
    .filter(([, result]) => !result.pass)
    .map(([name]) => `source-${name}-contrast`);
}

function normalizedPass(audit) {
  return Object.values(audit.normalized).every(result => result.pass);
}

async function inspectTheme(theme, download) {
  const result = {
    ...theme,
    packageFile: download.value ? basename(download.value) : null,
    packageHashPass: download.error === null,
    importPass: false,
    safeCssPass: false,
    sourceReadabilityPass: false,
    normalizedReadabilityPass: false,
    sourceReadability: null,
    normalizedReadability: null,
    issues: download.error ? [`download: ${download.error}`] : [],
  };
  if (download.error) return result;
  try {
    const imported = await importThemeZip(download.value, { overwrite: true });
    result.importPass = true;
    const safeCss = validateSafeCss(imported.customCss || "");
    result.safeCssPass = safeCss.valid;
    if (!safeCss.valid) result.issues.push(...safeCss.errors.map(error => `safe-css: ${error}`));

    const readability = auditDreamSkinReadability(imported.themeJson);
    result.sourceReadability = readability.source;
    result.normalizedReadability = readability.normalized;
    result.sourceReadabilityPass = Object.values(readability.source).every(pair => pair.pass);
    result.normalizedReadabilityPass = normalizedPass(readability);
    result.issues.push(...pairFailures(readability));
    if (theme.applyCompatible === false) result.issues.push("gallery-apply-incompatible");
  } catch (error) {
    result.issues.push(`import: ${error instanceof Error ? error.message : String(error)}`);
  }
  return result;
}

function count(results, predicate) {
  return results.filter(predicate).length;
}

function markdownReport(report) {
  const unresolved = report.results.filter(item => !item.importPass || !item.safeCssPass || !item.normalizedReadabilityPass);
  const sourceWarnings = report.results.filter(item => item.importPass && !item.sourceReadabilityPass);
  const upstreamIncompatible = report.results.filter(item => item.applyCompatible === false);
  const lines = [
    "# DreamSkin Gallery Top 100 Audit",
    "",
    `Audited ${report.summary.total} themes from [DreamSkin Gallery](https://dreamskin.cc/gallery) using \`sort=popular\` on ${report.auditedAt.slice(0, 10)}.`,
    "Packages were downloaded from the official API, SHA-256 verified, imported through dsh-skin, Safe CSS checked, and contrast-tested before and after plugin normalization.",
    "",
    "## Summary",
    "",
    `- Package hash verified: ${report.summary.hashPassed}/${report.summary.total}`,
    `- Imported successfully: ${report.summary.imported}/${report.summary.total}`,
    `- Safe CSS passed: ${report.summary.safeCssPassed}/${report.summary.total}`,
    `- Source readability passed: ${report.summary.sourceReadabilityPassed}/${report.summary.total}`,
    `- Readability passed after plugin normalization: ${report.summary.normalizedReadabilityPassed}/${report.summary.total}`,
    `- Gallery marks as one-click apply incompatible: ${report.summary.galleryApplyIncompatible}/${report.summary.total}`,
    "",
    "## Unresolved Failures",
    "",
  ];
  if (unresolved.length === 0) lines.push("None. All audited packages are readable after plugin normalization.");
  else {
    lines.push("| Rank | Theme | Author | Issues |", "| ---: | --- | --- | --- |");
    for (const item of unresolved) {
      lines.push(`| ${item.rank} | ${item.name} (\`${item.themeId}\`) | ${item.authorDisplayName} | ${item.issues.join("; ")} |`);
    }
  }
  lines.push("", "## Source Theme Quality Warnings", "");
  if (sourceWarnings.length === 0) lines.push("None.");
  else {
    lines.push("These packages contain low or unparseable source contrast. dsh-skin corrects them at runtime.", "", "| Rank | Theme | Downloads | Source issues |", "| ---: | --- | ---: | --- |");
    for (const item of sourceWarnings) {
      lines.push(`| ${item.rank} | ${item.name} (\`${item.themeId}\`) | ${item.downloadCount} | ${item.issues.filter(issue => issue.startsWith("source-")).join(", ")} |`);
    }
  }
  lines.push("", "## Gallery Compatibility Warnings", "");
  if (upstreamIncompatible.length === 0) lines.push("None.");
  else {
    lines.push("These are Gallery metadata warnings, not dsh-skin import failures.", "", "| Rank | Theme | Author |", "| ---: | --- | --- |");
    for (const item of upstreamIncompatible) {
      lines.push(`| ${item.rank} | ${item.name} (\`${item.themeId}\`) | ${item.authorDisplayName} |`);
    }
  }
  lines.push("", "## Full Results", "", "| Rank | Theme | Downloads | Import | Source | Normalized |", "| ---: | --- | ---: | :---: | :---: | :---: |");
  for (const item of report.results) {
    lines.push(`| ${item.rank} | ${item.name} (\`${item.themeId}\`) | ${item.downloadCount} | ${item.importPass ? "pass" : "fail"} | ${item.sourceReadabilityPass ? "pass" : "warn"} | ${item.normalizedReadabilityPass ? "pass" : "fail"} |`);
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const temporaryCache = options.cacheDir === null;
  const temporaryData = options.dataDir === null;
  const cacheDir = options.cacheDir || mkdtempSync(join(tmpdir(), "dsh-skin-gallery-cache-"));
  const dataDir = options.dataDir || mkdtempSync(join(tmpdir(), "dsh-skin-gallery-data-"));
  mkdirSync(cacheDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  process.env.DSH_SKIN_DATA_DIR = dataDir;

  try {
    const metadata = (await listPopularThemes(options.limit)).map((theme, index) => ({ ...theme, rank: index + 1 }));
    const downloads = await parallelMap(metadata, DOWNLOAD_CONCURRENCY, theme => downloadTheme(theme, cacheDir));
    const results = [];
    for (let index = 0; index < metadata.length; index += 1) {
      results.push(await inspectTheme(metadata[index], downloads[index]));
      process.stderr.write(`\rAudited ${index + 1}/${metadata.length}`);
    }
    process.stderr.write("\n");

    const report = {
      schemaVersion: 1,
      auditedAt: new Date().toISOString(),
      source: `${API_BASE}/themes?sort=popular`,
      summary: {
        total: results.length,
        hashPassed: count(results, item => item.packageHashPass),
        imported: count(results, item => item.importPass),
        safeCssPassed: count(results, item => item.safeCssPass),
        sourceReadabilityPassed: count(results, item => item.sourceReadabilityPass),
        normalizedReadabilityPassed: count(results, item => item.normalizedReadabilityPass),
        galleryApplyIncompatible: count(results, item => item.applyCompatible === false),
      },
      results,
    };
    mkdirSync(dirname(options.outJson), { recursive: true });
    mkdirSync(dirname(options.outMd), { recursive: true });
    writeFileSync(options.outJson, `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(options.outMd, markdownReport(report));
    process.stdout.write(`${JSON.stringify(report.summary)}\n`);
  } finally {
    if (temporaryCache) rmSync(cacheDir, { recursive: true, force: true });
    if (temporaryData) rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
