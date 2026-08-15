/**
 * @module dsh-skin
 *
 * Host half of the DSH Skin dual-face Cordis plugin. It lazily attaches to
 * `webServer`, resolves one active theme from config + durable local state,
 * serves bounded same-origin management endpoints and theme assets, and taps
 * index.html with one stable stylesheet link. Each registration is owned by
 * the injected Web fiber through `ctx.effect()` and disposes with that fiber.
 *
 * Main entry: Loader calls `apply(ctx, config)`; the browser-side `./client`
 * bundle consumes the API from DSH's existing General settings slot.
 *
 * This file does not render settings UI, add navigation, validate theme CSS,
 * own ZIP extraction policy, download assets, or activate in non-Web modes.
 * Those boundaries belong to the Client contribution, safe-css, and
 * theme-manager respectively.
 */

import { readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { extname, join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import {
  findTheme,
  importThemeZip,
  listThemes,
  loadState,
  loadTheme,
  saveState,
} from "./lib/theme-manager.mjs";
import { buildDreamSkinCss, buildInjectionCss } from "./lib/safe-css.mjs";

export const name = "dsh-skin";

const CSS_PATH = "/_skin/active.css";
const BACKGROUND_PATH = "/_skin/bg";
const API_PATH = "/_skin/api";
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORE_BUILTIN_DIR = join(PACKAGE_ROOT, "themes");
const DEFAULT_GALLERY_BUILTIN_DIR = join(PACKAGE_ROOT, "gallery", "themes");
const MAX_UPLOAD_BYTES = 32 * 1024 * 1024;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ── Theme resolution and cache identity ──────────────────────────────────────

function findBuiltinTheme(id) {
  if (typeof id !== "string" || !/^[a-z0-9][a-z0-9._-]{2,62}$/i.test(id)) return null;
  for (const root of builtinThemeRoots()) {
    try {
      return loadTheme(join(root, id));
    } catch {
      // Try the next bundled root. Invalid folders never block other themes.
    }
  }
  return null;
}

function builtinThemeRoots() {
  const galleryOverride = process.env.DSH_SKIN_GALLERY_DIR?.trim();
  return [
    CORE_BUILTIN_DIR,
    galleryOverride ? resolve(galleryOverride) : DEFAULT_GALLERY_BUILTIN_DIR,
  ];
}

function findAvailableTheme(id) {
  return findTheme(id) || findBuiltinTheme(id);
}

function hasPersistedSelection(state) {
  return Object.prototype.hasOwnProperty.call(state, "activeThemeId");
}

/** Resolve config pin -> persisted selection (including null) -> first-run default. */
function resolveTheme(config) {
  if (config?.enabled === false) return null;
  const pinned = config?.activeTheme?.trim();
  if (pinned) return findAvailableTheme(pinned);

  const state = loadState();
  if (hasPersistedSelection(state)) {
    return typeof state.activeThemeId === "string"
      ? findAvailableTheme(state.activeThemeId)
      : null;
  }

  const fallback = config?.defaultTheme?.trim();
  return fallback ? findAvailableTheme(fallback) : null;
}

function themeCacheKey(config, theme = resolveTheme(config)) {
  const revision = Number.isSafeInteger(loadState().revision) ? loadState().revision : 0;
  return theme
    ? `${theme.manifest.id}@${theme.manifest.version}:${revision}`
    : `official:${revision}`;
}

function stylesheetHref(config) {
  return `${CSS_PATH}?v=${encodeURIComponent(themeCacheKey(config))}`;
}

function backgroundPathname(theme) {
  const extension = extname(theme.backgroundPath).toLowerCase();
  return `${BACKGROUND_PATH}/${encodeURIComponent(theme.manifest.id)}${extension}`;
}

function buildCss(theme, cacheKey) {
  const backgroundUrl = theme.hasBackground
    ? `${backgroundPathname(theme)}?v=${encodeURIComponent(cacheKey)}`
    : null;
  if (theme.format === "dreamskin") {
    return buildDreamSkinCss(theme.themeJson, backgroundUrl, theme.customCss ?? null);
  }

  const legacyBackground = theme.hasBackground
    ? (() => {
        const data = readFileSync(theme.backgroundPath);
        const mime = extToMime(extname(theme.backgroundPath).slice(1).toLowerCase());
        return `data:${mime};base64,${data.toString("base64")}`;
      })()
    : null;
  let css = buildInjectionCss(theme.themeJson, legacyBackground);
  if (theme.customCss) css += `\n/* Custom theme.css */\n${theme.customCss}\n`;
  return css;
}

function extToMime(ext) {
  return ({
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
  })[ext] ?? "application/octet-stream";
}

// ── HTTP boundary helpers ────────────────────────────────────────────────────

async function readBodyBuffer(req, maxBytes = MAX_UPLOAD_BYTES) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new HttpError(413, `Request body too large (max ${maxBytes} bytes)`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJsonBody(req) {
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Expected application/json");
  }
  try {
    return JSON.parse((await readBodyBuffer(req)).toString("utf8"));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid JSON request body");
  }
}

function jsonResponse(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (origin === undefined) return;
  const host = req.headers.host;
  if (!host) throw new HttpError(403, "Request origin cannot be verified");
  try {
    const parsed = new URL(origin);
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.host !== host) {
      throw new HttpError(403, "Cross-origin theme mutation is not allowed");
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(403, "Invalid request origin");
  }
}

function parseMultipartFile(body, boundary) {
  const separator = Buffer.from(`--${boundary}`);
  for (const part of splitBuffer(body, separator)) {
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd === -1) continue;
    const headers = part.subarray(0, headerEnd).toString("utf8");
    if (!headers.includes("filename=")) continue;
    const match = headers.match(/filename="([^"]+)"/);
    let data = part.subarray(headerEnd + 4);
    if (data.subarray(-2).toString() === "\r\n") data = data.subarray(0, -2);
    return { filename: match?.[1] ?? "upload.zip", data };
  }
  return null;
}

function splitBuffer(buffer, separator) {
  const parts = [];
  let start = 0;
  let index;
  while ((index = buffer.indexOf(separator, start)) !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + separator.length;
  }
  parts.push(buffer.subarray(start));
  return parts;
}

// ── API projection and operations ────────────────────────────────────────────

function themeAuthor(theme) {
  const author = theme.manifest.author;
  if (typeof author === "string") return author;
  return author?.displayName
    || author?.id
    || theme.manifest.publisher?.displayName
    || theme.manifest.publisher?.id
    || null;
}

function describeTheme(theme, builtin, activeThemeId) {
  return {
    id: theme.manifest.id,
    name: theme.manifest.name,
    version: theme.manifest.version,
    format: theme.format,
    hasBackground: theme.hasBackground,
    hasCustomCss: theme.hasCustomCss,
    author: themeAuthor(theme),
    builtin,
    active: theme.manifest.id === activeThemeId,
  };
}

function listBuiltinThemes(excludeIds = []) {
  const themes = [];
  const excluded = new Set(excludeIds);
  const seen = new Set();
  for (const root of builtinThemeRoots()) {
    try {
      for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        try {
          const theme = loadTheme(join(root, entry.name));
          const id = theme.manifest.id;
          if (excluded.has(id) || seen.has(id)) continue;
          seen.add(id);
          themes.push(theme);
        } catch {
          // Invalid bundled folders are omitted; package tests validate shipped themes.
        }
      }
    } catch {
      // A missing optional Gallery root is valid until the catalog is materialized.
    }
  }
  return themes;
}

function inventory(config) {
  const activeThemeId = resolveTheme(config)?.manifest.id ?? null;
  const userThemes = listThemes();
  const builtins = listBuiltinThemes(userThemes.map(theme => theme.manifest.id));
  return {
    themes: [
      ...userThemes.map(theme => describeTheme(theme, false, activeThemeId)),
      ...builtins.map(theme => describeTheme(theme, true, activeThemeId)),
    ],
    activeThemeId,
    selectionLocked: config?.enabled === false || Boolean(config?.activeTheme?.trim()),
    stylesheetHref: stylesheetHref(config),
  };
}

function commitSelection(themeId) {
  const state = loadState();
  state.activeThemeId = themeId;
  state.revision = Number.isSafeInteger(state.revision) ? state.revision + 1 : 1;
  state.lastApplied = new Date().toISOString();
  saveState(state);
}

async function activate(req, res, config, logger) {
  if (config?.enabled === false) throw new HttpError(409, "DSH Skin is disabled by configuration");
  if (config?.activeTheme?.trim()) throw new HttpError(409, "Theme selection is pinned by activeTheme configuration");
  const body = await readJsonBody(req);
  if (!Object.prototype.hasOwnProperty.call(body, "themeId")
      || (body.themeId !== null && typeof body.themeId !== "string")) {
    throw new HttpError(400, "themeId must be a string or null");
  }
  if (typeof body.themeId === "string" && !findAvailableTheme(body.themeId)) {
    throw new HttpError(404, `Theme "${body.themeId}" not found`);
  }
  commitSelection(body.themeId);
  const result = inventory(config);
  logger.info(`[dsh-skin] active theme -> ${result.activeThemeId ?? "(official)"}`);
  jsonResponse(res, 200, {
    ok: true,
    activeThemeId: result.activeThemeId,
    stylesheetHref: result.stylesheetHref,
  });
}

async function importZip(req, res, config, logger) {
  if (config?.enabled === false) throw new HttpError(409, "DSH Skin is disabled by configuration");
  const contentType = req.headers["content-type"] ?? "";
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/i);
  if (!match) throw new HttpError(400, "Expected multipart/form-data with boundary");
  const file = parseMultipartFile(await readBodyBuffer(req), match[1] || match[2]);
  if (!file) throw new HttpError(400, "No file field found in request");
  if (!file.filename.toLowerCase().endsWith(".zip")) {
    throw new HttpError(400, "Only .zip theme files are supported");
  }

  const tempPath = join(tmpdir(), `dsh-skin-upload-${randomUUID()}.zip`);
  try {
    writeFileSync(tempPath, file.data);
    const theme = await importThemeZip(tempPath, { overwrite: false });
    logger.info(`[dsh-skin] imported theme "${theme.manifest.name}" (${theme.manifest.id})`);
    jsonResponse(res, 200, {
      ok: true,
      id: theme.manifest.id,
      name: theme.manifest.name,
      version: theme.manifest.version,
      format: theme.format,
      hasBackground: theme.hasBackground,
      hasCustomCss: theme.hasCustomCss,
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, error instanceof Error ? error.message : String(error));
  } finally {
    try {
      unlinkSync(tempPath);
    } catch {
      // Nothing was written, or the import boundary already cleaned it.
    }
  }
}

function createApiHandler(config, logger) {
  return async (req, res) => {
    const pathname = new URL(req.url ?? "/", "http://dsh.local").pathname;
    try {
      if (req.method === "GET" && pathname === `${API_PATH}/themes`) {
        jsonResponse(res, 200, inventory(config));
        return;
      }
      if (req.method === "POST") {
        assertSameOrigin(req);
        if (pathname === `${API_PATH}/activate`) {
          await activate(req, res, config, logger);
          return;
        }
        if (pathname === `${API_PATH}/import`) {
          await importZip(req, res, config, logger);
          return;
        }
      }
      if (req.method !== "GET" && req.method !== "POST") {
        throw new HttpError(405, "Method not allowed");
      }
      throw new HttpError(404, "Not found");
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status >= 500) logger.warn(`[dsh-skin] API error: ${error instanceof Error ? error.message : String(error)}`);
      jsonResponse(res, status, { error: error instanceof Error ? error.message : String(error) });
    }
  };
}

// ── Cordis Host entry ────────────────────────────────────────────────────────

/**
 * Attach the Host half only when `webServer` exists. Headless, ACP, and
 * Electron compositions remain no-op because the lazy injection never fires.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ enabled?: boolean, activeTheme?: string, defaultTheme?: string }} [config]
 */
export function apply(ctx, config = {}) {
  ctx.inject(["webServer"], (webCtx) => {
    const logger = webCtx.logger ?? { info: console.log, warn: console.warn };

    webCtx.effect(() => webCtx.webServer.register({
      kind: "exact",
      path: CSS_PATH,
      handler: (_req, res) => {
        const theme = resolveTheme(config);
        try {
          const css = theme
            ? buildCss(theme, themeCacheKey(config, theme))
            : "/* dsh-skin: official appearance */\n";
          res.writeHead(200, {
            "Content-Type": "text/css; charset=utf-8",
            "Cache-Control": "public, max-age=31536000, immutable",
          });
          res.end(css);
        } catch (error) {
          logger.warn(`[dsh-skin] CSS build error: ${error instanceof Error ? error.message : String(error)}`);
          res.writeHead(500);
          res.end();
        }
      },
    }));

    webCtx.effect(() => webCtx.webServer.register({
      kind: "prefix",
      path: BACKGROUND_PATH,
      handler: (req, res) => {
        const theme = resolveTheme(config);
        const pathname = new URL(req.url ?? "/", "http://dsh.local").pathname;
        if (!theme?.hasBackground || pathname !== backgroundPathname(theme)) {
          res.writeHead(404);
          res.end();
          return;
        }
        try {
          const data = readFileSync(theme.backgroundPath);
          res.writeHead(200, {
            "Content-Type": extToMime(extname(theme.backgroundPath).slice(1).toLowerCase()),
            "Cache-Control": "public, max-age=31536000, immutable",
          });
          res.end(data);
        } catch (error) {
          logger.warn(`[dsh-skin] background serve error: ${error instanceof Error ? error.message : String(error)}`);
          res.writeHead(500);
          res.end();
        }
      },
    }));

    webCtx.effect(() => webCtx.webServer.register({
      kind: "prefix",
      path: API_PATH,
      handler: createApiHandler(config, logger),
    }));

    webCtx.effect(() => webCtx.webServer.tapIndex((html) => {
      if (html.includes('data-dsh-skin="1"')) return html;
      const link = `  <link rel="stylesheet" data-dsh-skin="1" href="${stylesheetHref(config)}">`;
      return html.includes("</head>")
        ? html.replace("</head>", `${link}\n</head>`)
        : `${html}\n${link}`;
    }));

    const active = resolveTheme(config);
    logger.info(`[dsh-skin] Web plugin ready; active: ${active?.manifest.id ?? "(official)"}`);
  });
}
