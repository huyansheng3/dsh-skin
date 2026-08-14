#!/usr/bin/env node
/**
 * Build script — assembles the Chrome extension into dist/extension/.
 * Copies all source files and bundled themes into a loadable extension directory.
 */

import { mkdirSync, copyFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const srcExtDir = join(root, "src", "extension");
const distExtDir = join(root, "dist", "extension");

// Clean and create dist
if (existsSync(distExtDir)) {
  rmSync(distExtDir, { recursive: true, force: true });
}
mkdirSync(distExtDir, { recursive: true });

// Copy all extension files
function copyDir(src, dest) {
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
      console.log(`  ✓ ${entry.name}`);
    }
  }
}

console.log("Building DSH Skin Chrome Extension...\n");
copyDir(srcExtDir, distExtDir);

// Also copy themes from the root themes/ directory (they have the same content)
const themesDir = join(root, "themes");
const extThemesDir = join(distExtDir, "themes");
if (!existsSync(extThemesDir)) {
  mkdirSync(extThemesDir, { recursive: true });
}
if (existsSync(themesDir)) {
  copyDir(themesDir, extThemesDir);
}

console.log(`\n✓ Extension built to ${distExtDir}`);
console.log("Load it in Chrome: chrome://extensions → Developer mode → Load unpacked");
