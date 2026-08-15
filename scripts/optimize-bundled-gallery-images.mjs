#!/usr/bin/env node

/**
 * Re-encode the curated Gallery backgrounds for a practical GitHub install.
 * Data flow: bundled-themes.json -> declared source image -> cwebp -> updated
 * theme image reference + manifest hashes + provenance transform record. The
 * output remains bounded to the curated directories and is idempotent once a
 * theme declares the generated background.webp.
 *
 * Main entry: `npm run optimize:gallery`. This script does not choose themes,
 * alter artwork composition/colors, modify CSS, download files, or run during
 * plugin installation. cwebp is a release-time dependency only.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const selectionPath = join(repoRoot, "gallery", "bundled-themes.json");
const MAX_WIDTH = 2560;
const QUALITY = 84;

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  const temporary = `${file}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporary, file);
}

function digest(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function fileRecord(file) {
  return { bytes: statSync(file).size, sha256: digest(file) };
}

function optimizeTheme(themeId) {
  const themeDir = join(repoRoot, "gallery", "themes", themeId);
  const manifestPath = join(themeDir, "manifest.json");
  const themeJsonPath = join(themeDir, "theme.json");
  const provenancePath = join(themeDir, "_dsh-skin.json");
  const manifest = readJson(manifestPath);
  const themeJson = readJson(themeJsonPath);
  const provenance = readJson(provenancePath);
  const imageEntry = manifest.files.find(entry => entry.mediaType?.startsWith("image/"));
  if (!imageEntry) throw new Error(`${themeId}: no declared image`);

  if (imageEntry.path === "background.webp") {
    if (!provenance.distribution?.background) {
      throw new Error(`${themeId}: optimized image is missing provenance`);
    }
    return false;
  }

  const sourcePath = join(themeDir, imageEntry.path);
  if (!existsSync(sourcePath)) throw new Error(`${themeId}: missing ${imageEntry.path}`);
  const sourceRecord = {
    path: imageEntry.path,
    mediaType: imageEntry.mediaType,
    bytes: imageEntry.bytes,
    sha256: imageEntry.sha256,
  };
  const outputPath = join(themeDir, "background.webp");
  const temporaryOutput = `${outputPath}.tmp-${process.pid}.webp`;
  const preset = extname(sourcePath).toLowerCase() === ".png" ? "picture" : "photo";

  execFileSync("cwebp", [
    "-quiet",
    "-preset", preset,
    "-q", String(QUALITY),
    "-m", "6",
    "-mt",
    "-resize", String(MAX_WIDTH), "0",
    "-resize_mode", "down_only",
    sourcePath,
    "-o", temporaryOutput,
  ]);
  renameSync(temporaryOutput, outputPath);

  themeJson.image = "background.webp";
  writeJson(themeJsonPath, themeJson);
  const outputRecord = fileRecord(outputPath);
  const themeJsonRecord = fileRecord(themeJsonPath);
  Object.assign(imageEntry, {
    path: "background.webp",
    mediaType: "image/webp",
    ...outputRecord,
  });
  const themeJsonEntry = manifest.files.find(entry => entry.path === "theme.json");
  if (!themeJsonEntry) throw new Error(`${themeId}: no declared theme.json`);
  Object.assign(themeJsonEntry, themeJsonRecord);
  writeJson(manifestPath, manifest);

  provenance.distribution = {
    background: {
      source: sourceRecord,
      output: { path: "background.webp", mediaType: "image/webp", ...outputRecord },
      transform: {
        format: "webp",
        quality: QUALITY,
        maxWidth: MAX_WIDTH,
        resizeMode: "down-only",
        cropped: false,
        colorAdjusted: false,
      },
    },
  };
  writeJson(provenancePath, provenance);
  unlinkSync(sourcePath);
  return true;
}

const selection = readJson(selectionPath);
let optimized = 0;
for (const theme of selection.themes) {
  if (optimizeTheme(theme.themeId)) optimized += 1;
}
process.stdout.write(`Optimized ${optimized}/${selection.themes.length} bundled Gallery backgrounds\n`);
