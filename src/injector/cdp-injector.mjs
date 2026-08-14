#!/usr/bin/env node
/**
 * CDP Injector — connects to a Chromium-based browser via Chrome DevTools
 * Protocol (CDP) on 127.0.0.1 and injects DSH Skin CSS into the DeepSeek
 * Harness web client.
 *
 * Usage:
 *   node cdp-injector.mjs --port 9222 --theme gothic-void
 *   node cdp-injector.mjs --port 9222 --restore
 *   node cdp-injector.mjs --port 9222 --list
 *
 * Safety:
 *   - Only connects to 127.0.0.1, never remote addresses
 *   - No authentication on CDP (same security boundary as Codex-Dream-Skin)
 *   - Injected CSS is validated by Safe CSS before delivery
 */

import { parseArgs } from "node:util";
import { createConnection } from "node:net";
import { fileToDataUrl, findTheme, loadState, saveState, listThemes } from "../lib/theme-manager.mjs";
import { buildInjectionCss, validateSafeCss } from "../lib/safe-css.mjs";

const INJECTOR_VERSION = "0.1.0";
const INJECT_STYLE_ID = "dsh-skin-injected";

const args = parseArgs({
  options: {
    port: { type: "string", default: "9222", short: "p" },
    host: { type: "string", default: "127.0.0.1" },
    theme: { type: "string" },
    restore: { type: "boolean", default: false },
    list: { type: "boolean", default: false },
    "auto-apply": { type: "boolean", default: false },
    help: { type: "boolean", default: false, short: "h" },
  },
  allowPositionals: false,
});

if (args.values.help) {
  console.log(`
DSH Skin CDP Injector v${INJECTOR_VERSION}

Usage:
  dsh-skin inject --port <port> --theme <theme-id>   Inject a theme via CDP
  dsh-skin inject --port <port> --restore             Remove injected theme
  dsh-skin inject --list                               List installed themes
  dsh-skin inject --auto-apply --port <port>          Auto-apply last active theme

Options:
  --port, -p    CDP debugging port (default: 9222)
  --host        CDP host (always 127.0.0.1)
  --theme       Theme id to apply
  --restore     Remove injected CSS and restore official appearance
  --list        List all installed themes
  --auto-apply   Re-apply the last active theme from state
  --help, -h    Show this help

Examples:
  dsh-skin inject -p 9222 --theme gothic-void
  dsh-skin inject -p 9222 --restore
`);
  process.exit(0);
}

// --list mode doesn't need CDP
if (args.values.list) {
  const themes = listThemes();
  const state = loadState();
  if (themes.length === 0) {
    console.log("No themes installed.");
    console.log(`Theme directory: ${getThemesDir()}`);
  } else {
    console.log("Installed themes:");
    for (const t of themes) {
      const active = state.activeThemeId === t.manifest.id ? " [active]" : "";
      const bg = t.hasBackground ? " +bg" : "";
      const css = t.hasCustomCss ? " +css" : "";
      console.log(`  ${t.manifest.id} — ${t.manifest.name} v${t.manifest.version}${active}${bg}${css}`);
    }
  }
  process.exit(0);
}

// Connect to CDP
const port = parseInt(args.values.port, 10);
const host = args.values.host;

if (host !== "127.0.0.1" && host !== "localhost") {
  console.error("Security: CDP injection is restricted to 127.0.0.1");
  process.exit(1);
}

// Check CDP availability via HTTP /json endpoint
async function getTargets() {
  const resp = await fetch(`http://${host}:${port}/json`);
  if (!resp.ok) {
    throw new Error(`CDP endpoint returned ${resp.status}`);
  }
  return resp.json();
}

async function injectViaCDP(cssText, action = "apply") {
  const targets = await getTargets();
  // Find DSH web client tabs (localhost:3080 or any page target)
  const pageTargets = targets.filter((t) => t.type === "page");
  if (pageTargets.length === 0) {
    throw new Error("No page targets found via CDP. Is DSH running with --remote-debugging-port?");
  }

  let injected = 0;
  for (const target of pageTargets) {
    // Filter: only inject into DSH pages (localhost:3080 or localhost with DSH title)
    const url = target.url || "";
    const title = target.title || "";
    const isDSH = url.includes("127.0.0.1:3080") || url.includes("localhost:3080") ||
                  title.includes("DeepSeek") || title.includes("Harness");
    if (!isDSH) continue;

    const wsUrl = target.webSocketDebuggerUrl;
    if (!wsUrl) continue;

    const result = await injectIntoTarget(wsUrl, cssText, action);
    if (result) injected++;
  }
  return injected;
}

function injectIntoTarget(wsUrl, cssText, action) {
  return new Promise((resolve, reject) => {
    // Use WebSocket via dynamic import (Node 22+ has global WebSocket)
    const ws = new WebSocket(wsUrl);

    let msgId = 0;
    const send = (method, params = {}) => {
      msgId++;
      ws.send(JSON.stringify({ id: msgId, method, params }));
      return msgId;
    };

    ws.addEventListener("open", () => {
      // Remove existing injection first
      send("Runtime.evaluate", {
        expression: `
          (function() {
            var el = document.getElementById('${INJECT_STYLE_ID}');
            if (el) el.remove();
            var bg = document.getElementById('dsh-skin-bg-layer');
            if (bg) bg.remove();
            ${action === "apply" ? `
              var style = document.createElement('style');
              style.id = '${INJECT_STYLE_ID}';
              style.textContent = ${JSON.stringify(cssText)};
              document.head.appendChild(style);
              // Add background layer element if needed
              if (style.textContent.includes('dsh-skin-bg-layer')) {
                var bgDiv = document.createElement('div');
                bgDiv.id = 'dsh-skin-bg-layer';
                document.body.insertBefore(bgDiv, document.body.firstChild);
              }
            ` : ""}
            return 'ok';
          })()
        `,
        returnByValue: true,
      });
    });

    ws.addEventListener("message", (event) => {
      const data = JSON.parse(event.data);
      if (data.id && data.result) {
        ws.close();
        resolve(true);
      }
      if (data.error) {
        ws.close();
        reject(new Error(data.error.message));
      }
    });

    ws.addEventListener("error", (err) => {
      reject(new Error("WebSocket error"));
    });

    setTimeout(() => {
      ws.close();
      reject(new Error("CDP injection timeout (5s)"));
    }, 5000);
  });
}

// Main logic
try {
  if (args.values.restore) {
    const count = await injectViaCDP("", "restore");
    console.log(`✓ Restored official appearance (${count} target${count !== 1 ? "s" : ""} affected)`);

    const state = loadState();
    state.activeThemeId = null;
    state.lastApplied = new Date().toISOString();
    saveState(state);
    process.exit(0);
  }

  // Determine which theme to apply
  let themeId = args.values.theme;
  if (!themeId && args.values["auto-apply"]) {
    const state = loadState();
    themeId = state.activeThemeId;
    if (!themeId) {
      console.error("No active theme in state. Use --theme <id> to specify one.");
      process.exit(1);
    }
  }

  if (!themeId) {
    console.error("No theme specified. Use --theme <id> or --auto-apply.");
    process.exit(1);
  }

  const theme = findTheme(themeId);
  if (!theme) {
    console.error(`Theme "${themeId}" not found. Run --list to see installed themes.`);
    process.exit(1);
  }

  // Validate custom CSS if present
  if (theme.customCss) {
    const { valid, errors } = validateSafeCss(theme.customCss);
    if (!valid) {
      console.error(`Theme "${themeId}" has invalid CSS:`);
      for (const err of errors) console.error(`  - ${err}`);
      process.exit(1);
    }
  }

  // Build the injection CSS
  let backgroundDataUrl = null;
  if (theme.hasBackground) {
    backgroundDataUrl = fileToDataUrl(theme.backgroundPath);
  }

  let cssText = buildInjectionCss(theme.themeJson, backgroundDataUrl);
  if (theme.customCss) {
    cssText += "\n/* === Custom theme.css === */\n" + theme.customCss;
  }

  const count = await injectViaCDP(cssText, "apply");
  console.log(`✓ Applied theme "${theme.manifest.name}" (${count} target${count !== 1 ? "s" : ""})`);

  // Save state
  const state = loadState();
  state.activeThemeId = themeId;
  state.lastApplied = new Date().toISOString();
  saveState(state);
} catch (err) {
  console.error(`✗ ${err.message}`);
  console.error(`\nMake sure DSH is running with --remote-debugging-port=${port}`);
  process.exit(1);
}
