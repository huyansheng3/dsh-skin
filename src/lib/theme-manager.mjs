/**
 * Theme Manager — load, list, install, import, and manage DSH Skin themes.
 *
 * Themes live in a local library directory:
 *   ~/Library/Application Support/DSHSkin/themes/   (macOS)
 *   ~/.local/share/dsh-skin/themes/                  (Linux)
 *   %LOCALAPPDATA%\\DSHSkin\\themes\\                 (Windows)
 *
 * Supports two theme formats:
 *   1. Legacy DSH format  — manifest.json (schema:1) + theme.json (colors.light/dark)
 *   2. DreamSkin format   — manifest.json (packageVersion:1) + theme.json (flat colors)
 *
 * ZIP import accepts both the full Studio format and simplified local ZIPs,
 * mirroring the DreamSkin client behaviour described in their README.
 */

import {
  readFileSync, writeFileSync, existsSync, mkdirSync,
  readdirSync, rmSync, copyFileSync, statSync,
} from "node:fs";
import { join, resolve, basename, dirname, extname } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

// ── Path helpers ──────────────────────────────────────────────────────────────

export function getThemesDir() {
  const home = homedir();
  if (process.platform === "darwin") {
    return join(home, "Library", "Application Support", "DSHSkin", "themes");
  }
  if (process.platform === "win32") {
    return join(process.env.LOCALAPPDATA || join(home, "AppData", "Local"), "DSHSkin", "themes");
  }
  return join(home, ".local", "share", "dsh-skin", "themes");
}

export function getStatePath() {
  return join(getThemesDir(), "..", "state.json");
}

// ── ZIP size limits (matching DreamSkin's import contract) ───────────────────
const ZIP_MAX_COMPRESSED_BYTES = 32 * 1024 * 1024;   // 32 MiB
const ZIP_MAX_ENTRIES = 32;
const ZIP_MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024; // 64 MiB

// ── Theme loading ─────────────────────────────────────────────────────────────

/**
 * Detect theme format: "dreamskin" | "legacy"
 */
function detectFormat(manifest, themeJson) {
  // DreamSkin manifest uses packageVersion; legacy uses schema
  if ("packageVersion" in manifest) return "dreamskin";
  if (themeJson.colors && !themeJson.colors.light && !themeJson.colors.dark) return "dreamskin";
  return "legacy";
}

/**
 * Load and validate a theme from a directory.
 */
export function loadTheme(themeDir) {
  const manifestPath = join(themeDir, "manifest.json");
  const themeJsonPath = join(themeDir, "theme.json");

  if (!existsSync(manifestPath)) throw new Error(`Missing manifest.json in ${themeDir}`);
  if (!existsSync(themeJsonPath)) throw new Error(`Missing theme.json in ${themeDir}`);

  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const themeJson = JSON.parse(readFileSync(themeJsonPath, "utf-8"));

  const format = detectFormat(manifest, themeJson);

  // Validate manifest fields depending on format
  if (format === "legacy") {
    if (manifest.schema !== 1) throw new Error(`Unsupported manifest schema: ${manifest.schema}`);
    if (!manifest.id || !manifest.name || !manifest.version) {
      throw new Error("manifest.json missing required fields: id, name, version");
    }
  } else {
    // DreamSkin format
    if (!manifest.themeId) throw new Error("manifest.json missing themeId (DreamSkin format)");
    // Normalise so the rest of the code can use manifest.id / manifest.name / manifest.version
    manifest.id = manifest.themeId;
    manifest.name = themeJson.name || manifest.themeId;
    manifest.version = manifest.version || themeJson.version || "0.0.1";
  }

  // Background image
  let hasBackground = false;
  let backgroundPath;

  // DreamSkin: background declared in files[] with mediaType image/*
  if (format === "dreamskin") {
    const imgFile = (manifest.files || []).find(f => f.mediaType?.startsWith("image/"));
    const imgName = imgFile?.path || themeJson.image;
    if (imgName) {
      const p = join(themeDir, imgName);
      if (existsSync(p)) { hasBackground = true; backgroundPath = p; }
    }
  } else {
    // Legacy: background.file in theme.json
    if (themeJson.background?.file) {
      const p = join(themeDir, themeJson.background.file);
      if (existsSync(p)) { hasBackground = true; backgroundPath = p; }
    }
  }

  // Custom CSS
  const cssPath = join(themeDir, "theme.css");
  const hasCustomCss = existsSync(cssPath);
  const customCss = hasCustomCss ? readFileSync(cssPath, "utf-8") : null;

  return {
    manifest,
    themeJson,
    format,
    dir: resolve(themeDir),
    hasBackground,
    backgroundPath,
    hasCustomCss,
    customCss,
  };
}

// ── Listing ───────────────────────────────────────────────────────────────────

export function listThemes() {
  const themesDir = getThemesDir();
  if (!existsSync(themesDir)) return [];

  const themes = [];
  for (const entry of readdirSync(themesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      themes.push(loadTheme(join(themesDir, entry.name)));
    } catch (e) {
      console.warn(`Skipping theme ${entry.name}: ${e.message}`);
    }
  }
  return themes;
}

export function findTheme(themeId) {
  return listThemes().find(t => t.manifest.id === themeId) ?? null;
}

// ── Integrity ─────────────────────────────────────────────────────────────────

export function computeIntegrity(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function verifySha256(filePath, expected) {
  const actual = computeIntegrity(filePath);
  if (actual !== expected) {
    throw new Error(`SHA-256 mismatch for ${basename(filePath)}: expected ${expected}, got ${actual}`);
  }
}

// ── Install from directory ────────────────────────────────────────────────────

export function installTheme(srcDir, overwrite = false) {
  const themesDir = getThemesDir();
  mkdirSync(themesDir, { recursive: true });

  const theme = loadTheme(srcDir);
  const destDir = join(themesDir, theme.manifest.id);

  if (existsSync(destDir) && !overwrite) {
    throw new Error(`Theme "${theme.manifest.id}" already exists. Use --force to replace.`);
  }
  if (existsSync(destDir)) rmSync(destDir, { recursive: true, force: true });

  mkdirSync(destDir, { recursive: true });
  for (const file of readdirSync(srcDir)) {
    copyFileSync(join(srcDir, file), join(destDir, file));
  }
  return loadTheme(destDir);
}

// ── ZIP Import ────────────────────────────────────────────────────────────────

/**
 * Import a theme from a .zip file.
 *
 * Accepts:
 *   • Full Studio format: manifest.json + theme.json + theme.css + background.*
 *   • Simplified local ZIP: theme.json + theme.css + background.*
 *
 * @param {string} zipPath  Absolute path to the .zip file
 * @param {{ overwrite?: boolean, skipSafeCheck?: boolean }} opts
 * @returns {object} Installed theme object
 */
export async function importThemeZip(zipPath, opts = {}) {
  const { overwrite = false, skipSafeCheck = false } = opts;

  // Size check
  const stat = statSync(zipPath);
  if (stat.size > ZIP_MAX_COMPRESSED_BYTES) {
    throw new Error(`ZIP too large: ${stat.size} bytes (max ${ZIP_MAX_COMPRESSED_BYTES})`);
  }

  // Extract to temp directory
  const tmpDir = join(tmpdir(), `dsh-skin-import-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  try {
    execSync(`unzip -o -d "${tmpDir}" "${zipPath}"`, { stdio: "pipe" });
  } catch (e) {
    throw new Error(`Failed to extract ZIP: ${e.message}`);
  }

  // Find the theme root (may be at ZIP root or one directory deep)
  const themeRoot = _findThemeRoot(tmpDir);
  if (!themeRoot) {
    rmSync(tmpDir, { recursive: true, force: true });
    throw new Error("ZIP does not contain a valid theme (missing theme.json)");
  }

  // Count entries / uncompressed size check
  const allFiles = _listFilesRecursive(tmpDir);
  if (allFiles.length > ZIP_MAX_ENTRIES) {
    rmSync(tmpDir, { recursive: true, force: true });
    throw new Error(`ZIP contains too many files: ${allFiles.length} (max ${ZIP_MAX_ENTRIES})`);
  }
  const totalBytes = allFiles.reduce((acc, f) => acc + statSync(f).size, 0);
  if (totalBytes > ZIP_MAX_UNCOMPRESSED_BYTES) {
    rmSync(tmpDir, { recursive: true, force: true });
    throw new Error(`ZIP extracts to too many bytes: ${totalBytes} (max ${ZIP_MAX_UNCOMPRESSED_BYTES})`);
  }

  // Load and validate the theme
  let theme;
  try {
    theme = loadTheme(themeRoot);
  } catch (e) {
    rmSync(tmpDir, { recursive: true, force: true });
    throw new Error(`Invalid theme in ZIP: ${e.message}`);
  }

  // If full manifest, verify SHA-256 of declared files
  if (theme.format === "dreamskin" && theme.manifest.files?.length) {
    for (const fileEntry of theme.manifest.files) {
      const filePath = join(themeRoot, fileEntry.path);
      if (!existsSync(filePath)) continue;
      if (fileEntry.sha256) {
        try {
          verifySha256(filePath, fileEntry.sha256);
        } catch (e) {
          rmSync(tmpDir, { recursive: true, force: true });
          throw e;
        }
      }
    }
  }

  // Safe CSS check
  if (!skipSafeCheck && theme.customCss) {
    const { validateSafeCss } = await import("./safe-css.mjs");
    const { valid, errors } = validateSafeCss(theme.customCss);
    if (!valid) {
      rmSync(tmpDir, { recursive: true, force: true });
      throw new Error(`theme.css failed Safe CSS validation:\n  - ${errors.join("\n  - ")}`);
    }
  }

  // Install into themes library
  const installed = installTheme(themeRoot, overwrite);
  rmSync(tmpDir, { recursive: true, force: true });
  return installed;
}

/** Recursively list all files under a directory */
function _listFilesRecursive(dir) {
  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) result.push(..._listFilesRecursive(full));
    else result.push(full);
  }
  return result;
}

/** Find the directory that contains theme.json (root or one level deep) */
function _findThemeRoot(extractDir) {
  if (existsSync(join(extractDir, "theme.json"))) return extractDir;
  for (const entry of readdirSync(extractDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sub = join(extractDir, entry.name);
    if (existsSync(join(sub, "theme.json"))) return sub;
  }
  return null;
}

// ── Remove ────────────────────────────────────────────────────────────────────

export function removeTheme(themeId) {
  const dir = join(getThemesDir(), themeId);
  if (!existsSync(dir)) throw new Error(`Theme "${themeId}" not found.`);
  rmSync(dir, { recursive: true, force: true });
}

// ── State ─────────────────────────────────────────────────────────────────────

export function loadState() {
  const p = getStatePath();
  if (!existsSync(p)) return { activeThemeId: null, autoApply: false, lastApplied: null };
  return JSON.parse(readFileSync(p, "utf-8"));
}

export function saveState(state) {
  const p = getStatePath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(state, null, 2), "utf-8");
}

// ── Data URL helper ───────────────────────────────────────────────────────────

export function fileToDataUrl(filePath) {
  const data = readFileSync(filePath);
  const ext = extname(filePath).slice(1).toLowerCase();
  const mime =
    ext === "png"  ? "image/png"  :
    ext === "webp" ? "image/webp" :
    (ext === "jpg" || ext === "jpeg") ? "image/jpeg" :
    "application/octet-stream";
  return `data:${mime};base64,${data.toString("base64")}`;
}
