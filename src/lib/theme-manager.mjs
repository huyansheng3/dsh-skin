/**
 * Theme Manager — load, list, install, and manage DSH Skin themes.
 *
 * Themes live in a local library directory:
 *   ~/Library/Application Support/DSHSkin/themes/   (macOS)
 *   ~/.local/share/dsh-skin/themes/                  (Linux)
 *   %LOCALAPPDATA%\\DSHSkin\\themes\\                 (Windows)
 *
 * Each theme is a directory containing manifest.json, theme.json,
 * optional theme.css, and optional background image.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { homedir, platform } from "node:os";
import { createHash } from "node:crypto";

/**
 * Get the platform-appropriate theme library directory.
 */
export function getThemesDir() {
  const home = homedir();
  if (process.platform === "darwin") {
    return join(home, "Library", "Application Support", "DSHSkin", "themes");
  }
  if (process.platform === "win32") {
    return join(process.env.LOCALAPPDATA || join(home, "AppData", "Local"), "DSHSkin", "themes");
  }
  // Linux / others
  return join(home, ".local", "share", "dsh-skin", "themes");
}

/**
 * Get the state file path (tracks active theme).
 */
export function getStatePath() {
  const dir = getThemesDir();
  return join(dir, "..", "state.json");
}

/**
 * Load and validate a theme from a directory.
 */
export function loadTheme(themeDir) {
  const manifestPath = join(themeDir, "manifest.json");
  const themeJsonPath = join(themeDir, "theme.json");

  if (!existsSync(manifestPath)) {
    throw new Error(`Missing manifest.json in ${themeDir}`);
  }
  if (!existsSync(themeJsonPath)) {
    throw new Error(`Missing theme.json in ${themeDir}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const themeJson = JSON.parse(readFileSync(themeJsonPath, "utf-8"));

  // Validate manifest
  if (manifest.schema !== 1) {
    throw new Error(`Unsupported manifest schema: ${manifest.schema}`);
  }
  if (!manifest.id || !manifest.name || !manifest.version) {
    throw new Error("manifest.json missing required fields: id, name, version");
  }

  // Check for background image
  let hasBackground = false;
  let backgroundPath = undefined;
  if (themeJson.background?.file) {
    const bgPath = join(themeDir, themeJson.background.file);
    if (existsSync(bgPath)) {
      hasBackground = true;
      backgroundPath = bgPath;
    }
  }

  // Load optional theme.css
  const cssPath = join(themeDir, "theme.css");
  const hasCustomCss = existsSync(cssPath);
  const customCss = hasCustomCss ? readFileSync(cssPath, "utf-8") : null;

  return {
    manifest,
    themeJson,
    dir: resolve(themeDir),
    hasBackground,
    backgroundPath,
    hasCustomCss,
    customCss,
  };
}

/**
 * List all installed themes.
 */
export function listThemes() {
  const themesDir = getThemesDir();
  if (!existsSync(themesDir)) {
    return [];
  }

  const entries = readdirSync(themesDir, { withFileTypes: true });
  const themes = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const theme = loadTheme(join(themesDir, entry.name));
      themes.push(theme);
    } catch (e) {
      // Skip invalid themes but warn
      console.warn(`Skipping theme ${entry.name}: ${e.message}`);
    }
  }

  return themes;
}

/**
 * Find a theme by id.
 */
export function findTheme(themeId) {
  const themes = listThemes();
  return themes.find((t) => t.manifest.id === themeId) || null;
}

/**
 * Compute SHA-256 of a file.
 */
export function computeIntegrity(filePath) {
  const data = readFileSync(filePath);
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Install a theme from a directory (copy into the themes library).
 * For simplicity, this expects the source directory to be valid.
 */
export function installTheme(srcDir, overwrite = false) {
  const themesDir = getThemesDir();
  mkdirSync(themesDir, { recursive: true });

  const theme = loadTheme(srcDir);
  const destDir = join(themesDir, theme.manifest.id);

  if (existsSync(destDir) && !overwrite) {
    throw new Error(`Theme "${theme.manifest.id}" already exists. Use overwrite=true to replace.`);
  }

  if (existsSync(destDir)) {
    rmSync(destDir, { recursive: true, force: true });
  }

  // Copy directory (simple implementation)
  mkdirSync(destDir, { recursive: true });
  const files = readdirSync(srcDir);
  for (const file of files) {
    const src = join(srcDir, file);
    const dest = join(destDir, file);
    const data = readFileSync(src);
    writeFileSync(dest, data);
  }

  return loadTheme(destDir);
}

/**
 * Remove a theme by id.
 */
export function removeTheme(themeId) {
  const themesDir = getThemesDir();
  const themeDir = join(themesDir, themeId);
  if (!existsSync(themeDir)) {
    throw new Error(`Theme "${themeId}" not found.`);
  }
  rmSync(themeDir, { recursive: true, force: true });
}

/**
 * Load the skin state (active theme).
 */
export function loadState() {
  const statePath = getStatePath();
  if (!existsSync(statePath)) {
    return { activeThemeId: null, autoApply: false, lastApplied: null };
  }
  return JSON.parse(readFileSync(statePath, "utf-8"));
}

/**
 * Save the skin state.
 */
export function saveState(state) {
  const statePath = getStatePath();
  mkdirSync(join(statePath, ".."), { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * Read a file as a data URL (for embedding background images in CSS).
 */
export function fileToDataUrl(filePath) {
  const data = readFileSync(filePath);
  const ext = filePath.split(".").pop().toLowerCase();
  const mime =
    ext === "png" ? "image/png" :
    ext === "webp" ? "image/webp" :
    ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
    "application/octet-stream";
  return `data:${mime};base64,${data.toString("base64")}`;
}
