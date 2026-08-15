/**
 * Build the import-free DSH Client bundle consumed by rc.6's ModuleLoader.
 * The source plane is CommonJS-shaped browser code; this script only adds the
 * package factory envelope and never resolves Host dependencies.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(root, "src", "client", "index.js");
const outputPath = join(root, "lib", "client.js");
const source = readFileSync(sourcePath, "utf8");

const bundle = [
  "window.__ModuleLoader__.load({",
  '  id: "dsh-skin",',
  "  factory: (require) => {",
  "    const module = { exports: {} };",
  "    const exports = module.exports;",
  source,
  "    return module.exports;",
  "  },",
  "});",
  "",
].join("\n");

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, bundle, "utf8");
