#!/usr/bin/env node
/**
 * DSH Skin CLI — manage themes, inject via CDP, and build theme packages.
 *
 * Usage:
 *   dsh-skin list                     List installed themes
 *   dsh-skin apply <theme-id>          Apply a theme via CDP
 *   dsh-skin restore                   Restore official appearance
 *   dsh-skin install <dir>              Install a theme from a directory
 *   dsh-skin remove <theme-id>         Remove an installed theme
 *   dsh-skin info <theme-id>           Show theme details
 *   dsh-skin pack <dir>                 Pack a theme directory into a .zip
 */

import { parseArgs } from "node:util";
import { existsSync, readFileSync, readdirSync, mkdirSync, copyFileSync, statSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import {
  listThemes,
  findTheme,
  loadTheme,
  installTheme,
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
DSH Skin CLI — theming tool for DeepSeek Harness web client

Commands:
  list                  List all installed themes
  apply <theme-id>       Apply a theme via CDP injection
  restore                Restore official DSH appearance
  install <dir>          Install a theme from a directory
  remove <theme-id>      Remove an installed theme
  info <theme-id>        Show details for an installed theme
  pack <dir>             Pack a theme directory into a .zip file
  help                   Show this help message

Options for apply:
  --port <port>    CDP debugging port (default: 9222)
  --auto-apply      Re-apply the last active theme

Environment:
  DSH Skin targets the DSH web client running on http://127.0.0.1:3080
  For CDP injection, start DSH with --remote-debugging-port=9222

Theme directory: ${getThemesDir()}
`;

async function main() {
  switch (command) {
    case "list": {
      const themes = listThemes();
      const state = loadState();
      if (themes.length === 0) {
        console.log("No themes installed.");
        console.log(`\nTheme directory: ${getThemesDir()}`);
        console.log("Use 'dsh-skin install <dir>' to install a theme.");
      } else {
        console.log(`\nInstalled themes (${themes.length}):\n`);
        for (const t of themes) {
          const active = state.activeThemeId === t.manifest.id ? " ← active" : "";
          const bg = t.hasBackground ? " 🖼" : "";
          const css = t.hasCustomCss ? " 🎨" : "";
          const author = t.manifest.author ? ` by ${t.manifest.author}` : "";
          console.log(`  ${t.manifest.id.padEnd(20)} ${t.manifest.name} v${t.manifest.version}${author}${bg}${css}${active}`);
        }
        console.log("");
      }
      break;
    }

    case "apply": {
      const themeId = rest[0];
      if (!themeId) {
        console.error("Usage: dsh-skin apply <theme-id> [--port <port>]");
        process.exit(1);
      }

      // Parse --port
      const portIdx = rest.indexOf("--port");
      const port = portIdx !== -1 && rest[portIdx + 1] ? rest[portIdx + 1] : "9222";

      // Delegate to CDP injector
      const { execFileSync } = await import("node:child_process");
      try {
        execFileSync(process.argv[0], [
          join(import.meta.dirname, "injector", "cdp-injector.mjs"),
          "--port", port,
          "--theme", themeId,
        ], { stdio: "inherit" });
      } catch {
        process.exit(1);
      }
      break;
    }

    case "restore": {
      const portIdx = rest.indexOf("--port");
      const port = portIdx !== -1 && rest[portIdx + 1] ? rest[portIdx + 1] : "9222";

      const { execFileSync } = await import("node:child_process");
      try {
        execFileSync(process.argv[0], [
          join(import.meta.dirname, "injector", "cdp-injector.mjs"),
          "--port", port,
          "--restore",
        ], { stdio: "inherit" });
      } catch {
        process.exit(1);
      }
      break;
    }

    case "install": {
      const srcDir = rest[0];
      if (!srcDir) {
        console.error("Usage: dsh-skin install <dir>");
        process.exit(1);
      }
      if (!existsSync(srcDir)) {
        console.error(`Directory not found: ${srcDir}`);
        process.exit(1);
      }

      // Validate theme before installing
      try {
        loadTheme(srcDir);
      } catch (err) {
        console.error(`Invalid theme: ${err.message}`);
        process.exit(1);
      }

      // Validate CSS if present
      const cssPath = join(srcDir, "theme.css");
      if (existsSync(cssPath)) {
        const { valid, errors } = validateSafeCss(readFileSync(cssPath, "utf-8"));
        if (!valid) {
          console.error("Theme CSS validation failed:");
          for (const err of errors) console.error(`  - ${err}`);
          process.exit(1);
        }
      }

      const overwrite = rest.includes("--force");
      try {
        const theme = installTheme(srcDir, overwrite);
        console.log(`✓ Installed theme "${theme.manifest.name}" (${theme.manifest.id})`);
      } catch (err) {
        console.error(`✗ ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case "remove": {
      const themeId = rest[0];
      if (!themeId) {
        console.error("Usage: dsh-skin remove <theme-id>");
        process.exit(1);
      }
      try {
        removeTheme(themeId);
        console.log(`✓ Removed theme "${themeId}"`);
      } catch (err) {
        console.error(`✗ ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case "info": {
      const themeId = rest[0];
      if (!themeId) {
        console.error("Usage: dsh-skin info <theme-id>");
        process.exit(1);
      }
      const theme = findTheme(themeId);
      if (!theme) {
        console.error(`Theme "${themeId}" not found.`);
        process.exit(1);
      }
      console.log("\n=== Theme Info ===");
      console.log(`ID:          ${theme.manifest.id}`);
      console.log(`Name:        ${theme.manifest.name}`);
      console.log(`Version:     ${theme.manifest.version}`);
      console.log(`Author:      ${theme.manifest.author || "(none)"}`);
      console.log(`Platform:    ${theme.manifest.platform}`);
      console.log(`Directory:   ${theme.dir}`);
      console.log(`Background:  ${theme.hasBackground ? `Yes (${basename(theme.backgroundPath || "")})` : "No"}`);
      console.log(`Custom CSS:  ${theme.hasCustomCss ? "Yes" : "No"}`);
      console.log(`Capabilities:`);
      for (const [key, val] of Object.entries(theme.manifest.capabilities || {})) {
        console.log(`  ${key}: ${val}`);
      }
      console.log(`\nColors (light): ${Object.keys(theme.themeJson.colors?.light || {}).length} overrides`);
      console.log(`Colors (dark):  ${Object.keys(theme.themeJson.colors?.dark || {}).length} overrides`);
      console.log("");
      break;
    }

    case "pack": {
      const srcDir = rest[0];
      if (!srcDir) {
        console.error("Usage: dsh-skin pack <dir>");
        process.exit(1);
      }
      if (!existsSync(srcDir)) {
        console.error(`Directory not found: ${srcDir}`);
        process.exit(1);
      }

      // Validate theme
      try {
        loadTheme(srcDir);
      } catch (err) {
        console.error(`Invalid theme: ${err.message}`);
        process.exit(1);
      }

      // Create a simple ZIP (using the built-in zlib for a minimal zip)
      const theme = loadTheme(srcDir);
      const outputFile = `${theme.manifest.id}-${theme.manifest.version}.zip`;

      // Use Python to create the zip (universal on macOS)
      const { execSync } = await import("node:child_process");
      try {
        execSync(`cd "${srcDir}" && zip -r "${resolve(outputFile)}" . -x "*.DS_Store"`, { stdio: "inherit" });
        console.log(`✓ Packed theme to ${outputFile}`);
      } catch {
        console.error("✗ Failed to create zip. Make sure 'zip' is available.");
        process.exit(1);
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

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
