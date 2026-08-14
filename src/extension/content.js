/**
 * DSH Skin — Content Script
 *
 * Runs in the DSH web client page (localhost:3080).
 * On load: apply the stored active theme.
 * On message: switch themes on demand from the popup.
 *
 * Supports:
 *   - Built-in themes (bundled in extension resources)
 *   - Imported themes (CSS pre-built at import time, stored in chrome.storage.local)
 */

const INJECT_STYLE_ID = "dsh-skin-injected";
const INJECT_BG_ID    = "dsh-skin-bg-layer";

// ── DOM helpers ───────────────────────────────────────────────────────────────

function removeInjection() {
  document.getElementById(INJECT_STYLE_ID)?.remove();
  document.getElementById(INJECT_BG_ID)?.remove();
}

function injectCss(cssText) {
  removeInjection();

  const style = document.createElement("style");
  style.id = INJECT_STYLE_ID;
  style.textContent = cssText;
  document.head.appendChild(style);

  // Add background layer div if the CSS references it
  if (cssText.includes(INJECT_BG_ID)) {
    const bgDiv = document.createElement("div");
    bgDiv.id = INJECT_BG_ID;
    document.body.insertBefore(bgDiv, document.body.firstChild);
  }
}

// ── Built-in theme application ────────────────────────────────────────────────

async function applyBuiltinTheme(themeId) {
  try {
    const [manifestResp, themeResp] = await Promise.all([
      fetch(chrome.runtime.getURL(`themes/${themeId}/manifest.json`)),
      fetch(chrome.runtime.getURL(`themes/${themeId}/theme.json`)),
    ]);

    if (!manifestResp.ok) throw new Error(`Theme manifest not found: ${themeId}`);
    if (!themeResp.ok)    throw new Error(`Theme JSON not found: ${themeId}`);

    const manifest  = await manifestResp.json();
    const themeJson = await themeResp.json();

    let cssText = "";

    // Detect format (DreamSkin vs legacy)
    const isDreamSkin = !themeJson.colors?.light && !themeJson.colors?.dark;

    if (isDreamSkin) {
      // Map DreamSkin flat colors to CSS variables
      const c = themeJson.colors || {};
      const bgUrl = themeJson.background?.file
        ? chrome.runtime.getURL(`themes/${themeId}/${themeJson.background.file}`)
        : null;

      const map = {
        background: ["--ds-theme-color-background","--dsw-alias-bg-base"],
        panel:       ["--ds-theme-color-panel","--dsw-alias-bg-layer-1","--dsw-specific-sidebar-fill"],
        panelAlt:    ["--ds-theme-color-panel-alt","--dsw-alias-bg-layer-2","--dsw-specific-bubble","--dsw-specific-input-major"],
        accent:      ["--ds-theme-color-accent","--dsw-alias-brand-primary"],
        accentAlt:   ["--ds-theme-color-accent-alt"],
        secondary:   ["--ds-theme-color-secondary"],
        highlight:   ["--ds-theme-color-highlight","--dsw-alias-bg-layer-3","--dsw-specific-bubble-highlight"],
        text:        ["--ds-theme-color-text","--dsw-alias-label-primary"],
        muted:       ["--ds-theme-color-muted","--dsw-alias-label-secondary","--dsw-alias-label-tertiary"],
        line:        ["--ds-theme-color-line","--dsw-alias-border-l1","--dsw-alias-border-l2"],
      };

      cssText += ":root {\n";
      for (const [key, vars] of Object.entries(map)) {
        if (!c[key]) continue;
        let val = c[key];
        if (bgUrl && key === "panel")    val = hexToRgba(val, 0.72);
        if (bgUrl && key === "panelAlt") val = hexToRgba(val, 0.65);
        for (const v of vars) cssText += `  ${v}: ${val};\n`;
      }
      cssText += "}\n";

      if (bgUrl) {
        const art = themeJson.art || {};
        const fx  = ((art.focusX ?? 0.5) * 100).toFixed(1);
        const fy  = ((art.focusY ?? 0.4) * 100).toFixed(1);
        cssText += `
#dsh-skin-bg-layer {
  position: fixed; inset: 0; z-index: -1;
  background: url("${bgUrl}") no-repeat ${fx}% ${fy}% / cover;
  pointer-events: none;
  transition: opacity 0.4s ease;
}
#root, body { background: transparent !important; }
[class*="sidebar"],[class*="Sidebar"],[class*="side-bar"],[class*="SideBar"],nav[class],aside[class] {
  background-color: var(--ds-theme-color-panel, var(--dsw-alias-bg-layer-1)) !important;
  backdrop-filter: blur(14px) saturate(1.4);
  -webkit-backdrop-filter: blur(14px) saturate(1.4);
}\n`;
      }
    } else {
      // Legacy format
      if (themeJson.colors?.light) {
        cssText += "body {\n";
        for (const [k, v] of Object.entries(themeJson.colors.light)) cssText += `  ${k}: ${v};\n`;
        cssText += "}\n";
      }
      if (themeJson.colors?.dark) {
        cssText += "body[data-ds-dark-theme] {\n";
        for (const [k, v] of Object.entries(themeJson.colors.dark)) cssText += `  ${k}: ${v};\n`;
        cssText += "}\n";
      }

      if (themeJson.background?.file) {
        const bgUrl  = chrome.runtime.getURL(`themes/${themeId}/${themeJson.background.file}`);
        const bg     = themeJson.background;
        const opacity = bg.opacity ?? 1;
        const blur    = bg.blur ?? 0;
        cssText += `
#dsh-skin-bg-layer {
  position: fixed; inset: 0; z-index: -1;
  background: url("${bgUrl}") no-repeat ${bg.position ?? "center"} / ${bg.size ?? "cover"};
  opacity: ${opacity};
  ${blur > 0 ? `filter: blur(${blur}px);` : ""}
  pointer-events: none;
}
#root, body { background: transparent !important; }\n`;
      }
    }

    // Append custom theme.css if present
    try {
      const cssResp = await fetch(chrome.runtime.getURL(`themes/${themeId}/theme.css`));
      if (cssResp.ok) {
        const custom = await cssResp.text();
        cssText += `\n/* === ${themeId} theme.css === */\n${custom}`;
      }
    } catch {}

    injectCss(cssText);
    return { success: true, name: manifest.name || themeId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Imported theme application ────────────────────────────────────────────────

async function applyImportedTheme(themeId) {
  return new Promise(resolve => {
    chrome.storage.local.get(`importedCss_${themeId}`, result => {
      const cssText = result[`importedCss_${themeId}`];
      if (!cssText) {
        resolve({ success: false, error: "Imported theme CSS not found in storage." });
        return;
      }
      try {
        injectCss(cssText);
        resolve({ success: true, name: themeId });
      } catch (e) {
        resolve({ success: false, error: e.message });
      }
    });
  });
}

// ── Theme router ──────────────────────────────────────────────────────────────

const BUILTIN_IDS = ["gothic-void", "ocean-breeze", "warm-sunset", "matrix-green", "sakura-pink"];

async function applyTheme(themeId) {
  if (BUILTIN_IDS.includes(themeId)) {
    return applyBuiltinTheme(themeId);
  }
  // Try imported first; fallback to builtin (handles any future additions)
  const importedResult = await applyImportedTheme(themeId);
  if (importedResult.success) return importedResult;
  return applyBuiltinTheme(themeId);
}

// ── Colour helper (same as popup.js, needed inline in content script) ─────────

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

// ── Bootstrap ─────────────────────────────────────────────────────────────────

chrome.storage.local.get("activeTheme", result => {
  if (result.activeTheme) applyTheme(result.activeTheme);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "applyTheme") {
    applyTheme(message.themeId).then(sendResponse);
    return true;
  }
  if (message.action === "restore") {
    removeInjection();
    chrome.storage.local.remove("activeTheme");
    sendResponse({ success: true });
    return true;
  }
  if (message.action === "getStatus") {
    sendResponse({ injected: !!document.getElementById(INJECT_STYLE_ID) });
    return true;
  }
});
