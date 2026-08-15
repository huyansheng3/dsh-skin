/**
 * Browser-context audit payload for an isolated DSH instance populated by the
 * Gallery package audit. It activates every requested or non-builtin theme, waits for the
 * Host stylesheet revision, and checks rendered DSH tokens, background safety,
 * contrast over worst-case black/white artwork, overflow, and visible controls.
 *
 * Run through a browser automation evaluator after opening DSH. The payload
 * returns only a summary and failures, restores official appearance, and does
 * not import packages, start a server, inspect private data, or mutate source.
 */

(async () => {
  const API_PATH = "/_skin/api";
  const parseColor = (value) => {
    const normalized = value.trim();
    const hex = normalized.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (hex) {
      let digits = hex[1];
      if (digits.length === 3 || digits.length === 4) digits = [...digits].map(char => char + char).join("");
      return {
        r: parseInt(digits.slice(0, 2), 16),
        g: parseInt(digits.slice(2, 4), 16),
        b: parseInt(digits.slice(4, 6), 16),
        a: digits.length === 8 ? parseInt(digits.slice(6, 8), 16) / 255 : 1,
      };
    }
    const match = normalized.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
    if (!match) return null;
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: match[4] === undefined ? 1 : Number(match[4]) };
  };
  const composite = (foreground, background) => ({
    r: foreground.r * foreground.a + background.r * (1 - foreground.a),
    g: foreground.g * foreground.a + background.g * (1 - foreground.a),
    b: foreground.b * foreground.a + background.b * (1 - foreground.a),
    a: 1,
  });
  const channel = (value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const luminance = color => 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  const contrast = (first, second) => {
    const one = luminance(first);
    const two = luminance(second);
    return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
  };
  const backdropContrast = (text, surface, base) => {
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const white = { r: 255, g: 255, b: 255, a: 1 };
    return Math.min(...[black, white].map(backdrop => {
      const basePixel = composite(base, backdrop);
      return contrast(text, composite(surface, basePixel));
    }));
  };
  const renderedBackground = (element) => {
    const ancestors = [];
    for (let current = element; current; current = current.parentElement) ancestors.unshift(current);
    return ancestors.reduce((background, current) => {
      const parsed = parseColor(getComputedStyle(current).backgroundColor);
      return parsed ? composite(parsed, background) : background;
    }, { r: 255, g: 255, b: 255, a: 1 });
  };
  const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  const readJson = async (url, options) => {
    const response = await fetch(url, options);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  };
  const refreshStylesheet = async (href) => {
    const response = await fetch(href, { cache: "no-store" });
    if (!response.ok) throw new Error(`Stylesheet HTTP ${response.status}`);
    let link = document.querySelector('link[data-dsh-skin="1"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.dataset.dshSkin = "1";
      document.head.appendChild(link);
    }
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Stylesheet load timeout")), 5000);
      link.onload = () => { clearTimeout(timeout); resolve(); };
      link.onerror = () => { clearTimeout(timeout); reject(new Error("Stylesheet load failed")); };
      link.href = href;
    });
    await delay(20);
  };
  const activate = async (themeId) => {
    const data = await readJson(`${API_PATH}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ themeId }),
    });
    await refreshStylesheet(data.stylesheetHref);
  };

  const inventory = await readJson(`${API_PATH}/themes`);
  const requestedIds = Array.isArray(window.__DSH_SKIN_AUDIT_THEME_IDS)
    ? new Set(window.__DSH_SKIN_AUDIT_THEME_IDS)
    : null;
  const themes = inventory.themes.filter(theme => requestedIds
    ? requestedIds.has(theme.id)
    : theme.builtin === false);
  const failures = [];
  let minimumObservedContrast = Infinity;
  try {
    for (const theme of themes) {
      const issues = [];
      try {
        await activate(theme.id);
        const styles = getComputedStyle(document.body);
        const base = parseColor(styles.getPropertyValue("--dsw-alias-bg-base"));
        const panel = parseColor(styles.getPropertyValue("--dsw-alias-bg-layer-1"));
        const panelAlt = parseColor(styles.getPropertyValue("--dsw-alias-bg-layer-2"));
        const primary = parseColor(styles.getPropertyValue("--dsw-alias-label-primary"));
        const muted = parseColor(styles.getPropertyValue("--dsw-alias-label-secondary"));
        if (!base || !panel || !panelAlt || !primary || !muted) issues.push("missing-computed-token");
        else {
          if (base.a < 0.855) issues.push(`base-alpha:${base.a.toFixed(2)}`);
          if (panel.a < 0.915) issues.push(`panel-alpha:${panel.a.toFixed(2)}`);
          if (panelAlt.a < 0.875) issues.push(`panel-alt-alpha:${panelAlt.a.toFixed(2)}`);
          for (const [label, text] of [["primary", primary], ["muted", muted]]) {
            for (const [surfaceName, surface] of [["base", base], ["panel", panel], ["panel-alt", panelAlt]]) {
              const ratio = backdropContrast(text, surface, base);
              minimumObservedContrast = Math.min(minimumObservedContrast, ratio);
              if (ratio < 4.5) issues.push(`${label}-${surfaceName}-contrast:${ratio.toFixed(2)}`);
            }
          }
        }
        const background = getComputedStyle(document.body, "::before");
        if (background.backgroundImage === "none") issues.push("missing-background-layer");
        if (background.pointerEvents !== "none") issues.push(`background-pointer-events:${background.pointerEvents}`);
        if (document.documentElement.scrollWidth > window.innerWidth + 2) issues.push("horizontal-overflow");
        const visibleButtons = [...document.querySelectorAll("button")].filter(button => {
          const rect = button.getBoundingClientRect();
          const style = getComputedStyle(button);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        }).length;
        if (visibleButtons < 8) issues.push(`visible-buttons:${visibleButtons}`);
        const textControls = [...document.querySelectorAll("button, select")].filter(control => {
          const rect = control.getBoundingClientRect();
          const style = getComputedStyle(control);
          return !control.disabled && rect.width > 0 && rect.height > 0
            && style.display !== "none" && style.visibility !== "hidden"
            && (control.tagName === "SELECT" || control.textContent.trim());
        });
        for (const control of textControls) {
          const foreground = parseColor(getComputedStyle(control).color);
          const background = renderedBackground(control);
          if (!foreground) continue;
          const ratio = contrast(foreground, background);
          minimumObservedContrast = Math.min(minimumObservedContrast, ratio);
          if (ratio < 4.5) {
            const label = control.getAttribute("aria-label") || control.textContent.trim().slice(0, 24) || control.tagName;
            issues.push(`control-contrast:${label}:${ratio.toFixed(2)}`);
            break;
          }
        }
      } catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
      }
      if (issues.length > 0) failures.push({ id: theme.id, name: theme.name, issues });
    }
  } finally {
    await activate(inventory.activeThemeId);
  }
  return {
    total: themes.length,
    passed: themes.length - failures.length,
    failed: failures.length,
    minimumObservedContrast: Number(minimumObservedContrast.toFixed(2)),
    failures,
  };
})()
