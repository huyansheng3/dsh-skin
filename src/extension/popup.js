/**
 * DSH Skin — Popup UI
 *
 * Features:
 *   • Themes tab  — list & apply built-in + user-imported themes
 *   • Import tab  — drag-and-drop / browse to import a .zip theme package
 *
 * ZIP import works entirely in the browser (FileReader + JSZip bundled inline).
 * The extracted theme is stored in chrome.storage.local so the content script
 * can apply it on reload without any server round-trip.
 */

/* ─── Constants ──────────────────────────────────────────────────────────── */

const BUILTIN_THEMES = [
  { id: "gothic-void",   name: "Gothic Void",   version: "1.0.0", hasBg: true  },
  { id: "ocean-breeze",  name: "Ocean Breeze",  version: "1.0.0", hasBg: false },
  { id: "warm-sunset",   name: "Warm Sunset",   version: "1.0.0", hasBg: true  },
  { id: "matrix-green",  name: "Matrix Green",  version: "1.0.0", hasBg: false },
  { id: "sakura-pink",   name: "Sakura Pink",   version: "1.0.0", hasBg: true  },
];

// Max ZIP size we accept in the extension (32 MiB)
const ZIP_MAX_BYTES = 32 * 1024 * 1024;

/* ─── DOM refs ───────────────────────────────────────────────────────────── */

const themeList   = document.getElementById("theme-list");
const statusEl    = document.getElementById("status");
const restoreBtn  = document.getElementById("restore-btn");

// Tabs
const tabs        = document.querySelectorAll(".tab");
const tabContents = document.querySelectorAll(".tab-content");

// Import tab
const fileDrop      = document.getElementById("file-drop");
const zipInput      = document.getElementById("zip-input");
const importPreview = document.getElementById("import-preview");
const importError   = document.getElementById("import-error");
const importBtn     = document.getElementById("import-btn");
const forceChk      = document.getElementById("force-overwrite");

/* ─── Tab switching ──────────────────────────────────────────────────────── */

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tabContents.forEach(c => c.classList.add("hidden"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.remove("hidden");
  });
});

/* ─── Theme list ─────────────────────────────────────────────────────────── */

async function getAllThemes() {
  // Built-in + any user-imported themes saved in storage
  const stored = await chrome.storage.local.get("importedThemes");
  const imported = stored.importedThemes || [];
  return [...BUILTIN_THEMES, ...imported.map(t => ({ ...t, imported: true }))];
}

async function renderThemes(activeThemeId) {
  const themes = await getAllThemes();
  themeList.innerHTML = "";

  for (const theme of themes) {
    const item = document.createElement("div");
    item.className = "theme-item" + (activeThemeId === theme.id ? " active" : "");
    item.dataset.themeId = theme.id;

    const left = document.createElement("div");
    left.className = "theme-item-left";

    const nameEl = document.createElement("span");
    nameEl.className = "theme-name";
    nameEl.textContent = theme.name;

    const metaEl = document.createElement("span");
    metaEl.className = "theme-meta";
    const tags = [];
    if (theme.version) tags.push(`v${theme.version}`);
    if (theme.hasBg)   tags.push("🖼 bg");
    if (theme.imported) tags.push("📦 imported");
    metaEl.textContent = tags.join(" · ");

    left.appendChild(nameEl);
    left.appendChild(metaEl);
    item.appendChild(left);

    if (theme.imported) {
      const delBtn = document.createElement("button");
      delBtn.className = "del-btn";
      delBtn.title = "Remove imported theme";
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await removeImportedTheme(theme.id);
        renderThemes(activeThemeId);
      });
      item.appendChild(delBtn);
    }

    item.addEventListener("click", () => applyTheme(theme.id));
    themeList.appendChild(item);
  }
}

/* ─── Apply / Restore ────────────────────────────────────────────────────── */

async function applyTheme(themeId) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url?.match(/3080/)) {
    await chrome.storage.local.set({ activeTheme: themeId });
    statusEl.textContent = `Saved (open DSH to apply)`;
    renderThemes(themeId);
    return;
  }

  chrome.tabs.sendMessage(tab.id, { action: "applyTheme", themeId }, async (response) => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = `Error: ${chrome.runtime.lastError.message}`;
      return;
    }
    if (response?.success) {
      await chrome.storage.local.set({ activeTheme: themeId });
      statusEl.textContent = `Applied: ${response.name}`;
      renderThemes(themeId);
    } else {
      statusEl.textContent = `Failed: ${response?.error || "unknown"}`;
    }
  });
}

restoreBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url?.match(/3080/)) {
    chrome.tabs.sendMessage(tab.id, { action: "restore" }, async () => {
      await chrome.storage.local.remove("activeTheme");
      statusEl.textContent = "Restored to default";
      renderThemes(null);
    });
  } else {
    await chrome.storage.local.remove("activeTheme");
    statusEl.textContent = "Restored to default";
    renderThemes(null);
  }
});

/* ─── ZIP Import ─────────────────────────────────────────────────────────── */

let pendingThemeData = null; // { id, name, version, themeJson, cssText, hasBg }

fileDrop.addEventListener("click", () => zipInput.click());

fileDrop.addEventListener("dragover", e => { e.preventDefault(); fileDrop.classList.add("drag-over"); });
fileDrop.addEventListener("dragleave", () => fileDrop.classList.remove("drag-over"));
fileDrop.addEventListener("drop", e => {
  e.preventDefault();
  fileDrop.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) handleZipFile(file);
});

zipInput.addEventListener("change", () => {
  if (zipInput.files[0]) handleZipFile(zipInput.files[0]);
});

async function handleZipFile(file) {
  importError.classList.add("hidden");
  importPreview.classList.add("hidden");
  importBtn.disabled = true;
  pendingThemeData = null;

  if (!file.name.endsWith(".zip")) {
    showImportError("Only .zip files are supported.");
    return;
  }
  if (file.size > ZIP_MAX_BYTES) {
    showImportError(`File too large: ${(file.size / 1024 / 1024).toFixed(1)} MiB (max 32 MiB).`);
    return;
  }

  try {
    const data = await parseZipTheme(file);
    pendingThemeData = data;

    document.getElementById("preview-name").textContent    = data.name    || "—";
    document.getElementById("preview-id").textContent      = data.id      || "—";
    document.getElementById("preview-version").textContent = data.version || "—";
    document.getElementById("preview-bg").textContent      = data.hasBg ? "Yes" : "No";
    document.getElementById("preview-format").textContent  = data.format;

    importPreview.classList.remove("hidden");
    importBtn.disabled = false;
  } catch (e) {
    showImportError(e.message);
  }
}

/**
 * Parse a .zip File (using a minimal built-in approach via fetch + streams).
 * We use the browser's native decompression (DecompressionStream) for DEFLATE.
 * For the ZIP index we do a simple end-of-central-directory scan.
 */
async function parseZipTheme(file) {
  // Read entire file as ArrayBuffer
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);

  // Find all stored files using a simple ZIP central directory scanner
  const entries = parseZipEntries(bytes);
  if (entries.length === 0) throw new Error("ZIP is empty or not a valid ZIP file.");
  if (entries.length > 32) throw new Error(`Too many files in ZIP (${entries.length}, max 32).`);

  // Build a map of filename → raw bytes
  const fileMap = new Map();
  for (const e of entries) {
    if (e.name.endsWith("/")) continue; // directory
    const raw = await decompressEntry(bytes, e);
    fileMap.set(e.name, raw);
    // Also index without leading directory (to handle one-level-deep ZIPs)
    const base = e.name.includes("/") ? e.name.slice(e.name.indexOf("/") + 1) : null;
    if (base && base.length > 0) fileMap.set("@/" + base, raw);
  }

  const get = name => fileMap.get(name) ?? fileMap.get("@/" + name);
  const getText = name => { const r = get(name); return r ? new TextDecoder().decode(r) : null; };

  // theme.json is required
  const themeJsonText = getText("theme.json");
  if (!themeJsonText) throw new Error("ZIP does not contain theme.json at root or one level deep.");

  const themeJson = JSON.parse(themeJsonText);

  // manifest.json (optional for simplified ZIPs)
  const manifestText = getText("manifest.json");
  const manifest = manifestText ? JSON.parse(manifestText) : null;

  // Detect format
  let format = "legacy";
  if (manifest?.packageVersion || (themeJson.colors && !themeJson.colors.light && !themeJson.colors.dark)) {
    format = "DreamSkin";
  }

  // Theme identity
  const id      = manifest?.themeId || manifest?.id || themeJson.id || file.name.replace(/\.zip$/i, "");
  const name    = themeJson.name || manifest?.name || id;
  const version = manifest?.version || themeJson.version || "0.0.1";

  // Background image
  let bgDataUrl = null;
  let hasBg = false;

  // DreamSkin: image declared in manifest files[] or themeJson.image
  const imgFileName = (() => {
    if (manifest?.files) {
      const imgEntry = manifest.files.find(f => f.mediaType?.startsWith("image/"));
      if (imgEntry) return imgEntry.path;
    }
    if (themeJson.image) return themeJson.image;
    // legacy format
    if (themeJson.background?.file) return themeJson.background.file;
    // fallback: look for any image file
    for (const [k] of fileMap) {
      if (!k.startsWith("@/") && /\.(jpg|jpeg|png|webp)$/i.test(k)) return k;
    }
    return null;
  })();

  if (imgFileName) {
    const imgBytes = get(imgFileName) ?? get(imgFileName.replace(/^.*\//, ""));
    if (imgBytes) {
      const ext = imgFileName.split(".").pop().toLowerCase();
      const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const b64 = uint8ArrayToBase64(imgBytes);
      bgDataUrl = `data:${mime};base64,${b64}`;
      hasBg = true;
    }
  }

  // Custom theme.css
  const customCss = getText("theme.css");

  // Build injection CSS (inline, no lib imports)
  const cssText = buildImportedThemeCss(themeJson, bgDataUrl, customCss, format);

  return { id, name, version, format, themeJson, cssText, hasBg };
}

/** Build injection CSS from parsed theme data (no node modules). */
function buildImportedThemeCss(themeJson, bgDataUrl, customCss, format) {
  const lines = [`/* === DSH Skin ${format} import === */`];

  if (format === "DreamSkin") {
    const c = themeJson.colors || {};
    const hasBackground = !!bgDataUrl;

    // Map DreamSkin flat colors → CSS vars
    const map = {
      background: ["--ds-theme-color-background", "--dsw-alias-bg-base"],
      panel:       ["--ds-theme-color-panel",     "--dsw-alias-bg-layer-1", "--dsw-specific-sidebar-fill"],
      panelAlt:    ["--ds-theme-color-panel-alt",  "--dsw-alias-bg-layer-2", "--dsw-specific-bubble", "--dsw-specific-input-major"],
      accent:      ["--ds-theme-color-accent",     "--dsw-alias-brand-primary"],
      accentAlt:   ["--ds-theme-color-accent-alt"],
      secondary:   ["--ds-theme-color-secondary"],
      highlight:   ["--ds-theme-color-highlight",  "--dsw-alias-bg-layer-3", "--dsw-specific-bubble-highlight"],
      text:        ["--ds-theme-color-text",        "--dsw-alias-label-primary"],
      muted:       ["--ds-theme-color-muted",       "--dsw-alias-label-secondary", "--dsw-alias-label-tertiary"],
      line:        ["--ds-theme-color-line",        "--dsw-alias-border-l1", "--dsw-alias-border-l2"],
    };

    lines.push(":root {");
    for (const [colorKey, vars] of Object.entries(map)) {
      if (!c[colorKey]) continue;
      let v = c[colorKey];
      if (hasBackground && colorKey === "panel")    v = hexToRgba(v, 0.72);
      if (hasBackground && colorKey === "panelAlt") v = hexToRgba(v, 0.65);
      for (const varName of vars) lines.push(`  ${varName}: ${v};`);
    }
    lines.push("}");

    if (bgDataUrl) {
      const art = themeJson.art || {};
      const fx = ((art.focusX ?? 0.5) * 100).toFixed(1);
      const fy = ((art.focusY ?? 0.4) * 100).toFixed(1);
      lines.push(`
#dsh-skin-bg-layer {
  position: fixed; inset: 0; z-index: -1;
  background: url("${bgDataUrl}") no-repeat ${fx}% ${fy}% / cover;
  pointer-events: none;
  transition: opacity 0.4s ease;
}
#root, body { background: transparent !important; }
[class*="sidebar"],[class*="Sidebar"],[class*="side-bar"],[class*="SideBar"],nav[class],aside[class] {
  background-color: var(--ds-theme-color-panel, var(--dsw-alias-bg-layer-1)) !important;
  backdrop-filter: blur(14px) saturate(1.4);
  -webkit-backdrop-filter: blur(14px) saturate(1.4);
}`);
    }
  } else {
    // Legacy format
    if (themeJson.colors?.light) {
      lines.push("body {");
      for (const [k, v] of Object.entries(themeJson.colors.light)) lines.push(`  ${k}: ${v};`);
      lines.push("}");
    }
    if (themeJson.colors?.dark) {
      lines.push("body[data-ds-dark-theme] {");
      for (const [k, v] of Object.entries(themeJson.colors.dark)) lines.push(`  ${k}: ${v};`);
      lines.push("}");
    }
    if (bgDataUrl && themeJson.background) {
      const bg = themeJson.background;
      lines.push(`
#dsh-skin-bg-layer {
  position: fixed; inset: 0; z-index: -1;
  background: url("${bgDataUrl}") no-repeat ${bg.position ?? "center"} / ${bg.size ?? "cover"};
  opacity: ${bg.opacity ?? 1};
  ${bg.blur > 0 ? `filter: blur(${bg.blur}px);` : ""}
  pointer-events: none;
}
#root, body { background: transparent !important; }`);
    }
  }

  if (customCss) {
    lines.push(`\n/* === custom theme.css === */\n${customCss}`);
  }

  return lines.join("\n");
}

function hexToRgba(color, alpha) {
  const hex = color.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const rgb = color.match(/rgba?\(([^)]+)\)/i);
  if (rgb) {
    const p = rgb[1].split(",").map(s => s.trim());
    return `rgba(${p[0]},${p[1]},${p[2]},${alpha})`;
  }
  return color;
}

// ── Minimal ZIP parser (no external deps) ────────────────────────────────────

function parseZipEntries(bytes) {
  // Find end-of-central-directory record (signature 0x06054b50)
  const EOCD_SIG = 0x06054b50;
  const CD_SIG   = 0x02014b50;
  const LF_SIG   = 0x04034b50;

  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (readU32LE(bytes, i) === EOCD_SIG) { eocdOffset = i; break; }
  }
  if (eocdOffset < 0) throw new Error("Not a valid ZIP file (no EOCD).");

  const cdCount  = readU16LE(bytes, eocdOffset + 10);
  const cdSize   = readU32LE(bytes, eocdOffset + 12);
  const cdOffset = readU32LE(bytes, eocdOffset + 16);

  const entries = [];
  let pos = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    if (readU32LE(bytes, pos) !== CD_SIG) break;
    const comprMethod = readU16LE(bytes, pos + 10);
    const compSize    = readU32LE(bytes, pos + 20);
    const uncompSize  = readU32LE(bytes, pos + 24);
    const fnLen       = readU16LE(bytes, pos + 28);
    const extraLen    = readU16LE(bytes, pos + 30);
    const commentLen  = readU16LE(bytes, pos + 32);
    const lfOffset    = readU32LE(bytes, pos + 42);
    const name        = new TextDecoder().decode(bytes.subarray(pos + 46, pos + 46 + fnLen));
    entries.push({ name, comprMethod, compSize, uncompSize, lfOffset });
    pos += 46 + fnLen + extraLen + commentLen;
  }
  return entries;
}

async function decompressEntry(bytes, entry) {
  // Read local file header to find actual data offset
  const lfOffset = entry.lfOffset;
  if (readU32LE(bytes, lfOffset) !== 0x04034b50) throw new Error("Bad local file header.");
  const fnLen    = readU16LE(bytes, lfOffset + 26);
  const extraLen = readU16LE(bytes, lfOffset + 28);
  const dataOff  = lfOffset + 30 + fnLen + extraLen;
  const compressed = bytes.subarray(dataOff, dataOff + entry.compSize);

  if (entry.comprMethod === 0) {
    // Stored (no compression)
    return compressed;
  } else if (entry.comprMethod === 8) {
    // Deflate — use DecompressionStream
    const ds = new DecompressionStream("raw");
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();
    writer.write(compressed);
    writer.close();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out;
  } else {
    throw new Error(`Unsupported ZIP compression method: ${entry.comprMethod}`);
  }
}

function readU16LE(b, o) { return b[o] | (b[o+1] << 8); }
function readU32LE(b, o) { return (b[o] | (b[o+1] << 8) | (b[o+2] << 16) | (b[o+3] << 24)) >>> 0; }

function uint8ArrayToBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

// ── Import confirm ────────────────────────────────────────────────────────────

importBtn.addEventListener("click", async () => {
  if (!pendingThemeData) return;
  importBtn.disabled = true;
  importBtn.textContent = "Importing…";

  try {
    const stored = await chrome.storage.local.get("importedThemes");
    let imported = stored.importedThemes || [];

    const { id, name, version, format, cssText, hasBg, themeJson } = pendingThemeData;
    const exists = imported.findIndex(t => t.id === id);

    if (exists >= 0 && !forceChk.checked) {
      showImportError(`Theme "${id}" is already imported. Check "Overwrite" to replace it.`);
      importBtn.disabled = false;
      importBtn.textContent = "Import Theme";
      return;
    }
    if (exists >= 0) imported.splice(exists, 1);

    imported.push({ id, name, version, hasBg, format });

    // Store CSS for the content script (keyed by theme id)
    const cssKey = `importedCss_${id}`;
    await chrome.storage.local.set({ importedThemes: imported, [cssKey]: cssText });

    statusEl.textContent = `Imported: ${name}`;
    showImportError(""); // clear
    importPreview.classList.add("hidden");
    importBtn.textContent = "Import Theme";
    pendingThemeData = null;
    zipInput.value = "";

    // Switch to themes tab
    tabs.forEach(t => t.classList.remove("active"));
    tabContents.forEach(c => c.classList.add("hidden"));
    document.querySelector('[data-tab="themes"]').classList.add("active");
    document.getElementById("tab-themes").classList.remove("hidden");

    const res = await chrome.storage.local.get("activeTheme");
    renderThemes(res.activeTheme || null);
  } catch (e) {
    showImportError(`Import failed: ${e.message}`);
    importBtn.disabled = false;
    importBtn.textContent = "Import Theme";
  }
});

async function removeImportedTheme(themeId) {
  const stored = await chrome.storage.local.get("importedThemes");
  const imported = (stored.importedThemes || []).filter(t => t.id !== themeId);
  await chrome.storage.local.remove([`importedCss_${themeId}`]);
  await chrome.storage.local.set({ importedThemes: imported });
  const state = await chrome.storage.local.get("activeTheme");
  if (state.activeTheme === themeId) await chrome.storage.local.remove("activeTheme");
}

function showImportError(msg) {
  if (!msg) { importError.classList.add("hidden"); return; }
  importError.textContent = msg;
  importError.classList.remove("hidden");
}

/* ─── Init ───────────────────────────────────────────────────────────────── */

chrome.storage.local.get("activeTheme", result => {
  const activeThemeId = result.activeTheme || null;
  renderThemes(activeThemeId);

  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs[0];
    if (tab && tab.url?.match(/3080/)) {
      chrome.tabs.sendMessage(tab.id, { action: "getStatus" }, response => {
        if (chrome.runtime.lastError) {
          statusEl.textContent = "DSH tab found (reconnecting…)"; return;
        }
        statusEl.textContent = response?.injected
          ? (activeThemeId ? `Active: ${activeThemeId}` : "Injected")
          : (activeThemeId ? "Ready to apply" : "No theme active");
      });
    } else {
      statusEl.textContent = "Open DSH (localhost:3080)";
    }
  });
});
