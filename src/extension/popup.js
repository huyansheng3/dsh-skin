/**
 * Popup script — manages the DSH Skin popup UI.
 * Lists bundled themes, applies/restores themes, and persists the active choice.
 */

// Built-in themes (bundled with the extension)
const BUILTIN_THEMES = [
  {
    id: "gothic-void",
    name: "Gothic Void",
    version: "1.0.0",
    hasBg: true,
  },
  {
    id: "ocean-breeze",
    name: "Ocean Breeze",
    version: "1.0.0",
    hasBg: false,
  },
  {
    id: "warm-sunset",
    name: "Warm Sunset",
    version: "1.0.0",
    hasBg: true,
  },
  {
    id: "matrix-green",
    name: "Matrix Green",
    version: "1.0.0",
    hasBg: false,
  },
  {
    id: "sakura-pink",
    name: "Sakura Pink",
    version: "1.0.0",
    hasBg: true,
  },
];

const themeList = document.getElementById("theme-list");
const statusEl = document.getElementById("status");
const restoreBtn = document.getElementById("restore-btn");

/** Render the theme list. */
function renderThemes(activeThemeId) {
  themeList.innerHTML = "";
  for (const theme of BUILTIN_THEMES) {
    const item = document.createElement("div");
    item.className = "theme-item" + (activeThemeId === theme.id ? " active" : "");
    item.dataset.themeId = theme.id;

    const nameSpan = document.createElement("span");
    nameSpan.className = "theme-name";
    nameSpan.textContent = theme.name;

    const metaSpan = document.createElement("span");
    metaSpan.className = "theme-meta";
    metaSpan.textContent = `v${theme.version}${theme.hasBg ? " · bg" : ""}`;

    item.appendChild(nameSpan);
    item.appendChild(metaSpan);

    item.addEventListener("click", () => applyTheme(theme.id));
    themeList.appendChild(item);
  }
}

/** Apply a theme to the current DSH tab. */
async function applyTheme(themeId) {
  // Send message to content script
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url?.includes("3080")) {
    // Save preference anyway; content script will apply on next load
    chrome.storage.local.set({ activeTheme: themeId });
    statusEl.textContent = `Saved (open DSH to apply)`;
    renderThemes(themeId);
    return;
  }

  chrome.tabs.sendMessage(tab.id, { action: "applyTheme", themeId }, (response) => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = `Error: ${chrome.runtime.lastError.message}`;
      return;
    }
    if (response?.success) {
      chrome.storage.local.set({ activeTheme: themeId });
      statusEl.textContent = `Applied: ${response.name}`;
      renderThemes(themeId);
    } else {
      statusEl.textContent = `Failed: ${response?.error || "unknown"}`;
    }
  });
}

/** Restore default DSH appearance. */
restoreBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url?.includes("3080")) {
    chrome.tabs.sendMessage(tab.id, { action: "restore" }, () => {
      chrome.storage.local.remove("activeTheme");
      statusEl.textContent = "Restored to default";
      renderThemes(null);
    });
  } else {
    chrome.storage.local.remove("activeTheme");
    statusEl.textContent = "Restored to default";
    renderThemes(null);
  }
});

// On popup open, check injection status and load active theme
chrome.storage.local.get("activeTheme", (result) => {
  const activeThemeId = result.activeTheme || null;
  renderThemes(activeThemeId);

  // Check if DSH is open
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url?.includes("3080")) {
      chrome.tabs.sendMessage(tab.id, { action: "getStatus" }, (response) => {
        if (chrome.runtime.lastError) {
          statusEl.textContent = "DSH tab found (reconnecting…)";
          return;
        }
        if (response?.injected) {
          statusEl.textContent = activeThemeId ? `Active: ${activeThemeId}` : "Injected";
        } else {
          statusEl.textContent = activeThemeId ? "Ready to apply" : "No theme active";
        }
      });
    } else {
      statusEl.textContent = "Open DSH (localhost:3080) to apply";
    }
  });
});
