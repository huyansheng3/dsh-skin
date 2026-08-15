#!/usr/bin/env node
/**
 * dsh-skin CLI — manage themes in the local DSH Skin library.
 *
 * This tool manages the theme library that the `dsh-skin` Cordis plugin reads.
 * To apply a theme, use `dsh-skin activate <theme-id>` — the plugin will then
 * inject the CSS the next time the DSH Web UI page is loaded.
 *
 * Usage:
 *   dsh-skin list                     List installed themes
 *   dsh-skin activate <theme-id>      Set active theme (writes state.json)
 *   dsh-skin deactivate               Clear active theme
 *   dsh-skin install <dir>            Install a theme from a directory
 *   dsh-skin import <file.zip>        Import a .zip theme package
 *   dsh-skin remove <theme-id>        Remove an installed theme
 *   dsh-skin info <theme-id>          Show theme details
 *   dsh-skin pack <dir>               Pack a theme directory into a .zip
 */

import { existsSync, readFileSync } from "node:fs";
import { join, basename, resolve, extname } from "node:path";
import {
  listThemes,
  findTheme,
  loadTheme,
  installTheme,
  importThemeZip,
  removeTheme,
  loadState,
  saveState,
  getThemesDir,
} from "../lib/theme-manager.mjs";
import { validateSafeCss } from "../lib/safe-css.mjs";

const positional = process.argv.slice(2);
const command = positional[0];
const rest = positional.slice(1);

const HELP = `
dsh-skin CLI — theme library manager for the dsh-skin Cordis plugin

Commands:
  list                    List all installed themes
  activate <theme-id>     Set the active theme (writes state.json)
  deactivate              Clear the active theme
  install <dir>           Install a theme from a directory
  import <file.zip>       Import a .zip theme package (DreamSkin or local format)
  remove <theme-id>       Remove an installed theme
  info <theme-id>         Show details for an installed theme
  pack <dir>              Pack a theme directory into a .zip file
  help                    Show this help message

Options for install / import:
  --force                 Overwrite an existing theme with the same id

Note:
  Theme changes take effect the next time the DSH Web UI page is loaded
  (or refreshed). No CDP port or --remote-debugging-port needed.

Theme library: ${getThemesDir()}
`;

async function main() {
  switch (command) {
    // ── list ─────────────────────────────────────────────────────────────────
    case "list": {
      const themes = listThemes();
      const state = loadState();
      if (themes.length === 0) {
        console.log("No themes installed.");
        console.log(`\nTheme library: ${getThemesDir()}`);
        console.log("Use 'dsh-skin install <dir>' or 'dsh-skin import <file.zip>' to add themes.");
      } else {
        console.log(`\nInstalled themes (${themes.length}):\n`);
        for (const t of themes) {
          const active = state.activeThemeId === t.manifest.id ? " ← active" : "";
          const bg  = t.hasBackground ? " 🖼" : "";
          const css = t.hasCustomCss  ? " 🎨" : "";
          const fmt = t.format === "dreamskin" ? " [DreamSkin]" : "";
          const author = t.manifest.author
            ? ` by ${typeof t.manifest.author === "object"
                ? t.manifest.author.displayName || t.manifest.author.id
                : t.manifest.author}`
            : "";
          console.log(`  ${t.manifest.id.padEnd(28)} ${t.manifest.name} v${t.manifest.version}${author}${fmt}${bg}${css}${active}`);
        }
        console.log("");
        if (state.activeThemeId) {
          console.log(`Active: ${state.activeThemeId}`);
          console.log("CSS is served at /_skin/active.css by the dsh-skin plugin.");
        } else {
          console.log("No active theme. Use 'dsh-skin activate <theme-id>' to set one.");
        }
        console.log("");
      }
      break;
    }

    // ── activate ──────────────────────────────────────────────────────────────
    case "activate": {
      const themeId = rest[0];
      if (!themeId) {
        console.error("Usage: dsh-skin activate <theme-id>");
        process.exit(1);
      }
      const theme = findTheme(themeId);
      if (!theme) {
        console.error(`Theme "${themeId}" not found. Run 'dsh-skin list' to see available themes.`);
        process.exit(1);
      }
      const state = loadState();
      state.activeThemeId = themeId;
      saveState(state);
      console.log(`✓ Activated theme "${theme.manifest.name}" (${themeId})`);
      console.log("  Reload the DSH Web UI to see the change.");
      break;
    }

    // ── deactivate ────────────────────────────────────────────────────────────
    case "deactivate": {
      const state = loadState();
      const was = state.activeThemeId;
      state.activeThemeId = null;
      saveState(state);
      if (was) {
        console.log(`✓ Deactivated theme "${was}"`);
        console.log("  Reload the DSH Web UI to restore the default appearance.");
      } else {
        console.log("No active theme was set.");
      }
      break;
    }

    // ── install ───────────────────────────────────────────────────────────────
    case "install": {
      const srcDir = rest[0];
      if (!srcDir || !existsSync(srcDir)) {
        console.error(`Usage: dsh-skin install <dir>\nDirectory not found: ${srcDir}`);
        process.exit(1);
      }
      try {
        loadTheme(srcDir); // validate first
      } catch (err) {
        console.error(`Invalid theme: ${err.message}`); process.exit(1);
      }
      const cssPath = join(srcDir, "theme.css");
      if (existsSync(cssPath)) {
        const { valid, errors } = validateSafeCss(readFileSync(cssPath, "utf-8"));
        if (!valid) {
          console.error("Theme CSS validation failed:");
          errors.forEach(e => console.error(`  - ${e}`)); process.exit(1);
        }
      }
      try {
        const theme = installTheme(srcDir, rest.includes("--force"));
        console.log(`✓ Installed theme "${theme.manifest.name}" (${theme.manifest.id})`);
        console.log(`  Run 'dsh-skin activate ${theme.manifest.id}' to use it.`);
      } catch (err) {
        console.error(`✗ ${err.message}`); process.exit(1);
      }
      break;
    }

    // ── import ────────────────────────────────────────────────────────────────
    case "import": {
      const zipPath = rest[0];
      if (!zipPath) {
        console.error("Usage: dsh-skin import <file.zip> [--force]");
        process.exit(1);
      }
      const absPath = resolve(zipPath);
      if (!existsSync(absPath)) {
        console.error(`File not found: ${absPath}`); process.exit(1);
      }
      if (extname(absPath).toLowerCase() !== ".zip") {
        console.error("Only .zip files are supported for import."); process.exit(1);
      }

      console.log(`Importing ${basename(absPath)}…`);
      try {
        const theme = await importThemeZip(absPath, { overwrite: rest.includes("--force") });
        const fmt = theme.format === "dreamskin" ? " (DreamSkin format)" : "";
        const bg  = theme.hasBackground ? " with background image" : "";
        const css = theme.hasCustomCss  ? " + custom CSS" : "";
        console.log(`✓ Imported theme "${theme.manifest.name}"${fmt}${bg}${css}`);
        console.log(`  ID: ${theme.manifest.id}  •  stored in: ${theme.dir}`);
        console.log(`  Run 'dsh-skin activate ${theme.manifest.id}' to use it.`);
      } catch (err) {
        console.error(`✗ Import failed: ${err.message}`); process.exit(1);
      }
      break;
    }

    // ── remove ────────────────────────────────────────────────────────────────
    case "remove": {
      const themeId = rest[0];
      if (!themeId) { console.error("Usage: dsh-skin remove <theme-id>"); process.exit(1); }
      const state = loadState();
      try {
        removeTheme(themeId);
        if (state.activeThemeId === themeId) {
          state.activeThemeId = null;
          saveState(state);
          console.log(`✓ Removed active theme "${themeId}" — active theme cleared.`);
          console.log("  Reload the DSH Web UI to restore the default appearance.");
        } else {
          console.log(`✓ Removed theme "${themeId}"`);
        }
      } catch (err) {
        console.error(`✗ ${err.message}`); process.exit(1);
      }
      break;
    }

    // ── info ──────────────────────────────────────────────────────────────────
    case "info": {
      const themeId = rest[0];
      if (!themeId) { console.error("Usage: dsh-skin info <theme-id>"); process.exit(1); }
      const theme = findTheme(themeId);
      if (!theme) { console.error(`Theme "${themeId}" not found.`); process.exit(1); }

      const author = theme.manifest.author
        ? (typeof theme.manifest.author === "object"
            ? theme.manifest.author.displayName || theme.manifest.author.id
            : theme.manifest.author)
        : "(none)";

      const state = loadState();
      console.log("\n=== Theme Info ===");
      console.log(`ID:         ${theme.manifest.id}`);
      console.log(`Name:       ${theme.manifest.name}`);
      console.log(`Version:    ${theme.manifest.version}`);
      console.log(`Author:     ${author}`);
      console.log(`Format:     ${theme.format === "dreamskin" ? "DreamSkin" : "Legacy DSH"}`);
      console.log(`Directory:  ${theme.dir}`);
      console.log(`Background: ${theme.hasBackground ? `Yes (${basename(theme.backgroundPath || "")})` : "No"}`);
      console.log(`Custom CSS: ${theme.hasCustomCss ? "Yes" : "No"}`);
      console.log(`Active:     ${state.activeThemeId === theme.manifest.id ? "Yes" : "No"}`);

      if (theme.format === "dreamskin") {
        const colors = theme.themeJson.colors || {};
        console.log(`Colors:     ${Object.keys(colors).join(", ")}`);
        if (theme.themeJson.appearance) console.log(`Appearance: ${theme.themeJson.appearance}`);
        if (theme.themeJson.art) {
          const a = theme.themeJson.art;
          console.log(`Art:        focusX=${a.focusX ?? 0.5} focusY=${a.focusY ?? 0.4} taskMode=${a.taskMode ?? "fill"}`);
        }
      } else {
        console.log(`Colors (light): ${Object.keys(theme.themeJson.colors?.light || {}).length} overrides`);
        console.log(`Colors (dark):  ${Object.keys(theme.themeJson.colors?.dark || {}).length} overrides`);
      }
      console.log("");
      break;
    }

    // ── pack ──────────────────────────────────────────────────────────────────
    case "pack": {
      const srcDir = rest[0];
      if (!srcDir || !existsSync(srcDir)) {
        console.error(`Usage: dsh-skin pack <dir>\nDirectory not found: ${srcDir}`); process.exit(1);
      }
      try { loadTheme(srcDir); } catch (err) {
        console.error(`Invalid theme: ${err.message}`); process.exit(1);
      }
      const theme = loadTheme(srcDir);
      const outputFile = `${theme.manifest.id}-${theme.manifest.version}.zip`;
      const { execSync } = await import("node:child_process");
      try {
        execSync(`cd "${srcDir}" && zip -r "${resolve(outputFile)}" . -x "*.DS_Store"`, { stdio: "inherit" });
        console.log(`✓ Packed to ${outputFile}`);
      } catch {
        console.error("✗ Failed to create zip. Make sure 'zip' is available."); process.exit(1);
      }
      break;
    }

    case "help":
    case "--help":
    case "-h":
    case undefined:
      console.log(HELP);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch(err => { console.error(`✗ ${err.message}`); process.exit(1); });
