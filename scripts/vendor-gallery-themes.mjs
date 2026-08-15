#!/usr/bin/env node

/**
 * Materialize the frozen DreamSkin Gallery catalog as a local built-in library.
 * Data flow: catalog -> cached/official ZIP -> size + SHA-256 verification ->
 * strict theme import -> per-theme provenance metadata -> atomic directory swap.
 * Seven catalog-pinned upstream packages missing theme.css receive one bounded,
 * Safe-CSS-validated compatibility rule and are labeled accordingly.
 *
 * Main entry: `npm run vendor:gallery -- [options]`. The runtime never calls
 * this file. It does not activate themes, change user state, bypass archive
 * limits, infer licenses, or publish third-party artwork in the npm package.
 */

import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { importThemeZip, loadTheme } from "../src/lib/theme-manager.mjs";

const API_BASE = "https://api.dreamskin.cc/v1";
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMPATIBILITY_CSS = '[data-ds-part="root"] {\n  color: var(--ds-theme-color-text);\n}\n';

function usage() {
  return `Usage: node scripts/vendor-gallery-themes.mjs [options]\n\nOptions:\n  --catalog <path>     Frozen catalog (default: gallery/catalog.json)\n  --cache-dir <path>   Verified ZIP cache (default: .cache/dreamskin-gallery)\n  --output-dir <path>  Materialized themes (default: gallery/themes)\n  --offline            Fail instead of downloading a missing package\n  --help               Show this help\n`;
}

function parseArgs(argv) {
  const options = {
    catalog: join(repoRoot, "gallery", "catalog.json"),
    cacheDir: join(repoRoot, ".cache", "dreamskin-gallery"),
    outputDir: join(repoRoot, "gallery", "themes"),
    offline: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") options.help = true;
    else if (arg === "--offline") options.offline = true;
    else if (["--catalog", "--cache-dir", "--output-dir"].includes(arg)) {
      const value = argv[index += 1];
      if (!value) throw new Error(`Missing value for ${arg}`);
      const key = ({ "--catalog": "catalog", "--cache-dir": "cacheDir", "--output-dir": "outputDir" })[arg];
      options[key] = resolve(value);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function validateCatalog(catalog) {
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.themes) || catalog.themes.length !== 100) {
    throw new Error("Gallery catalog must use schemaVersion 1 and contain exactly 100 themes");
  }
  const ranks = new Set();
  const versionIds = new Set();
  const themeIds = new Set();
  for (const theme of catalog.themes) {
    if (!Number.isSafeInteger(theme.rank) || theme.rank < 1 || theme.rank > 100) throw new Error("Invalid catalog rank");
    if (!/^ver_[a-z0-9]+$/.test(theme.versionId)) throw new Error(`Invalid version ID: ${theme.versionId}`);
    if (!/^[a-z0-9][a-z0-9._-]{2,62}$/i.test(theme.themeId)) throw new Error(`Invalid theme ID: ${theme.themeId}`);
    if (!/^[a-f0-9]{64}$/.test(theme.package?.sha256 || "")) throw new Error(`Invalid package hash: ${theme.themeId}`);
    if (!Number.isSafeInteger(theme.package?.bytes) || theme.package.bytes < 1) throw new Error(`Invalid package size: ${theme.themeId}`);
    const expectedFile = `${String(theme.rank).padStart(3, "0")}-${theme.versionId}.zip`;
    if (theme.package.file !== expectedFile) throw new Error(`Invalid package filename: ${theme.package.file}`);
    ranks.add(theme.rank);
    versionIds.add(theme.versionId);
    themeIds.add(theme.themeId);
  }
  if (ranks.size !== 100 || versionIds.size !== 100 || themeIds.size !== 100) {
    throw new Error("Catalog ranks, version IDs, and theme IDs must be unique");
  }
}

function assertSafeOutputDir(outputDir) {
  const target = resolve(outputDir);
  const unsafeTargets = new Set([resolve("/"), resolve(homedir()), resolve(repoRoot)]);
  if (unsafeTargets.has(target) || dirname(target) === target) {
    throw new Error(`Refusing unsafe Gallery output directory: ${target}`);
  }
}

function verifyPackage(path, theme) {
  const data = readFileSync(path);
  if (data.length !== theme.package.bytes) {
    throw new Error(`${theme.themeId}: expected ${theme.package.bytes} bytes, got ${data.length}`);
  }
  const actual = sha256(data);
  if (actual !== theme.package.sha256) {
    throw new Error(`${theme.themeId}: expected SHA-256 ${theme.package.sha256}, got ${actual}`);
  }
}

async function obtainPackage(theme, options) {
  const path = join(options.cacheDir, theme.package.file);
  if (existsSync(path)) {
    verifyPackage(path, theme);
    return path;
  }
  if (options.offline) throw new Error(`Missing cached package: ${path}`);

  const response = await fetch(`${API_BASE}/themes/${encodeURIComponent(theme.versionId)}/download`);
  if (!response.ok) throw new Error(`${theme.themeId}: download failed with HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length !== theme.package.bytes || sha256(data) !== theme.package.sha256) {
    throw new Error(`${theme.themeId}: downloaded package does not match the frozen catalog`);
  }
  mkdirSync(options.cacheDir, { recursive: true });
  const tempPath = `${path}.${randomUUID()}.tmp`;
  writeFileSync(tempPath, data);
  renameSync(tempPath, path);
  return path;
}

function replaceDirectory(stagedDir, outputDir) {
  const backupDir = `${outputDir}.backup-${randomUUID()}`;
  let backedUp = false;
  try {
    if (existsSync(outputDir)) {
      renameSync(outputDir, backupDir);
      backedUp = true;
    }
    renameSync(stagedDir, outputDir);
    if (backedUp) rmSync(backupDir, { recursive: true, force: true });
  } catch (error) {
    if (!existsSync(outputDir) && backedUp && existsSync(backupDir)) renameSync(backupDir, outputDir);
    throw error;
  }
}

async function materialize(catalog, options) {
  validateCatalog(catalog);
  assertSafeOutputDir(options.outputDir);
  mkdirSync(dirname(options.outputDir), { recursive: true });
  const stagingRoot = mkdtempSync(join(dirname(options.outputDir), ".gallery-vendor-"));
  const dataRoot = join(stagingRoot, "data");
  const previousDataDir = process.env.DSH_SKIN_DATA_DIR;
  process.env.DSH_SKIN_DATA_DIR = dataRoot;

  try {
    for (const [index, entry] of catalog.themes.entries()) {
      const zipPath = await obtainPackage(entry, options);
      const compatibilityCss = entry.compatibility === "generated-theme-css"
        ? COMPATIBILITY_CSS
        : undefined;
      const theme = await importThemeZip(zipPath, { overwrite: true, compatibilityCss });
      if (theme.manifest.id !== entry.themeId || theme.manifest.version !== entry.version) {
        throw new Error(`${entry.themeId}: installed manifest does not match the catalog`);
      }
      if (!theme.hasBackground || !theme.hasCustomCss) {
        throw new Error(`${entry.themeId}: materialized theme is incomplete`);
      }
      writeFileSync(join(theme.dir, "_dsh-skin.json"), `${JSON.stringify({
        schemaVersion: 1,
        source: "dreamskin-gallery",
        rank: entry.rank,
        versionId: entry.versionId,
        author: entry.author,
        license: entry.license,
        officialPackage: entry.package,
        compatibility: entry.compatibility,
      }, null, 2)}\n`, "utf8");
      process.stderr.write(`\rMaterialized ${index + 1}/${catalog.themes.length}`);
    }
    process.stderr.write("\n");

    const stagedThemes = join(dataRoot, "themes");
    const installed = catalog.themes.map(entry => loadTheme(join(stagedThemes, entry.themeId)));
    if (installed.length !== 100) throw new Error(`Expected 100 materialized themes, got ${installed.length}`);
    replaceDirectory(stagedThemes, options.outputDir);
  } finally {
    if (previousDataDir === undefined) delete process.env.DSH_SKIN_DATA_DIR;
    else process.env.DSH_SKIN_DATA_DIR = previousDataDir;
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  const catalog = JSON.parse(readFileSync(options.catalog, "utf8"));
  await materialize(catalog, options);
  const bytes = catalog.themes.reduce((total, theme) => total + theme.package.bytes, 0);
  process.stdout.write(`Gallery built-ins ready: ${catalog.themes.length} themes, ${bytes} verified package bytes\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}

export { COMPATIBILITY_CSS, assertSafeOutputDir, materialize, parseArgs, validateCatalog };
