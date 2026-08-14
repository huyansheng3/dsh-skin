#!/usr/bin/env node
/**
 * Build script — makes the CDP injector executable and copies it to dist/.
 */

import { chmodSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const srcInjector = join(root, "src", "injector", "cdp-injector.mjs");
const distDir = join(root, "dist", "injector");
const distInjector = join(distDir, "cdp-injector.mjs");

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

copyFileSync(srcInjector, distInjector);
chmodSync(distInjector, 0o755);

console.log(`✓ Injector built to ${distInjector}`);
