/**
 * Content script — runs in the DSH web client page.
 * Injects the active theme's CSS into the page on load.
 * Listens for messages from the popup to switch themes.
 */

const INJECT_STYLE_ID = "dsh-skin-injected";
const INJECT_BG_ID = "dsh-skin-bg-layer";

/** Remove any existing injection. */
function removeInjection() {
  const el = document.getElementById(INJECT_STYLE_ID);
  if (el) el.remove();
  const bg = document.getElementById(INJECT_BG_ID);
  if (bg) bg.remove();
}

/** Inject CSS text and optionally a background layer element. */
function injectCss(cssText) {
  removeInjection();

  const style = document.createElement("style");
  style.id = INJECT_STYLE_ID;
  style.textContent = cssText;
  document.head.appendChild(style);

  // If the CSS references the background layer, add the element
  if (cssText.includes(INJECT_BG_ID)) {
    const bgDiv = document.createElement("div");
    bgDiv.id = INJECT_BG_ID;
    document.body.insertBefore(bgDiv, document.body.firstChild);
  }
}

/** Apply a theme from the extension's bundled themes. */
async function applyTheme(themeId) {
  // Fetch theme files from the extension's web_accessible_resources
  try {
    const manifestResp = await fetch(chrome.runtime.getURL(`themes/${themeId}/manifest.json`));
    if (!manifestResp.ok) throw new Error(`Theme manifest not found: ${themeId}`);
    const manifest = await manifestResp.json();

    const themeResp = await fetch(chrome.runtime.getURL(`themes/${themeId}/theme.json`));
    if (!themeResp.ok) throw new Error(`Theme JSON not found: ${themeId}`);
    const themeJson = await themeResp.json();

    // Build CSS from theme.json colors
    let cssText = "";
    if (themeJson.colors?.light) {
      cssText += "body {\n";
      for (const [key, value] of Object.entries(themeJson.colors.light)) {
        cssText += `  ${key}: ${value};\n`;
      }
      cssText += "}\n";
    }
    if (themeJson.colors?.dark) {
      cssText += "body[data-ds-dark-theme] {\n";
      for (const [key, value] of Object.entries(themeJson.colors.dark)) {
        cssText += `  ${key}: ${value};\n`;
      }
      cssText += "}\n";
    }

    // Background image
    if (themeJson.background?.file) {
      const bgUrl = chrome.runtime.getURL(`themes/${themeId}/${themeJson.background.file}`);
      const bg = themeJson.background;
      const opacity = bg.opacity ?? 1;
      const blur = bg.blur ?? 0;
      const size = bg.size ?? "cover";
      const position = bg.position ?? "center";

      cssText += `
#dsh-skin-bg-layer {
  position: fixed;
  inset: 0;
  z-index: -1;
  background-image: url("${bgUrl}");
  background-size: ${size};
  background-position: ${position};
  background-repeat: no-repeat;
  opacity: ${opacity};
  ${blur > 0 ? `filter: blur(${blur}px);` : ""}
  pointer-events: none;
}
#root { background: transparent !important; }
body { background: transparent !important; }
`;
    }

    // Load optional theme.css
    try {
      const cssResp = await fetch(chrome.runtime.getURL(`themes/${themeId}/theme.css`));
      if (cssResp.ok) {
        const customCss = await cssResp.text();
        cssText += `\n/* === ${themeId} custom CSS === */\n${customCss}`;
      }
    } catch {}

    injectCss(cssText);
    return { success: true, name: manifest.name };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// On load, check stored active theme and apply
chrome.storage.local.get("activeTheme", (result) => {
  if (result.activeTheme) {
    applyTheme(result.activeTheme);
  }
});

// Listen for theme switch messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "applyTheme") {
    applyTheme(message.themeId).then(sendResponse);
    return true; // async response
  }
  if (message.action === "restore") {
    removeInjection();
    chrome.storage.local.remove("activeTheme");
    sendResponse({ success: true });
    return true;
  }
  if (message.action === "getStatus") {
    const el = document.getElementById(INJECT_STYLE_ID);
    sendResponse({ injected: !!el });
    return true;
  }
});
