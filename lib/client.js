window.__ModuleLoader__.load({
  id: "dsh-skin",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
/**
 * Browser half of dsh-skin. It contributes one additive row to DSH's existing
 * General settings slot, loads inventory from the same-origin Host API, and
 * refreshes the Host-owned stylesheet after committed selection changes.
 * It does not own persistence, ZIP validation, navigation, or settings chrome.
 *
 * This file is a CommonJS factory body. `scripts/build-client.mjs` wraps it for
 * DSH's browser ModuleLoader without introducing Node imports.
 */

const React = require("react");
const h = React.createElement;
const NS = "settings.dshSkin";
const API_PATH = "/_skin/api";

const dictionaries = {
  zh: {
    themeLabel: "皮肤",
    official: "官方外观",
    loading: "正在读取皮肤...",
    importZip: "导入 ZIP",
    importing: "正在导入...",
    imported: "已导入：{name}",
    empty: "没有可用皮肤",
    loadError: "无法读取皮肤：{message}",
    applyError: "无法应用皮肤：{message}",
    importError: "无法导入皮肤：{message}",
  },
  en: {
    themeLabel: "Skin",
    official: "Official appearance",
    loading: "Loading skins...",
    importZip: "Import ZIP",
    importing: "Importing...",
    imported: "Imported: {name}",
    empty: "No skins available",
    loadError: "Could not load skins: {message}",
    applyError: "Could not apply skin: {message}",
    importError: "Could not import skin: {message}",
  },
};

const styleId = "dsh-skin/settings.css";
const settingsCss = `
  .dsh-skin-settings { display: grid; grid-template-columns: minmax(96px, 1fr) minmax(180px, 2fr) auto; align-items: center; gap: 12px; width: 100%; }
  .dsh-skin-settings__label { color: var(--dsw-alias-label-primary); font-size: 14px; font-weight: 600; }
  .dsh-skin-settings__select { min-width: 0; width: 100%; height: 36px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); padding: 0 10px; }
  .dsh-skin-settings__button { min-width: 92px; height: 36px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); cursor: pointer; padding: 0 12px; }
  .dsh-skin-settings__button:hover:not(:disabled), .dsh-skin-settings__select:focus { border-color: var(--dsw-alias-brand-primary); }
  .dsh-skin-settings__button:disabled, .dsh-skin-settings__select:disabled { cursor: default; opacity: .55; }
  .dsh-skin-settings__file { display: none; }
  .dsh-skin-settings__status { grid-column: 2 / -1; min-height: 18px; color: var(--dsw-alias-label-secondary); font-size: 12px; overflow-wrap: anywhere; }
  .dsh-skin-settings__status[data-error="true"] { color: var(--dsw-alias-error-primary, #c33); }
  @media (max-width: 640px) { .dsh-skin-settings { grid-template-columns: 1fr auto; } .dsh-skin-settings__label { grid-column: 1 / -1; } .dsh-skin-settings__status { grid-column: 1 / -1; } }
`;

function registerSettingsStyle() {
  if (typeof document === "undefined" || document.querySelector(`style[data-plugin-css="${styleId}"]`) !== null) {
    return () => {};
  }
  const style = document.createElement("style");
  style.dataset.plugin = "dsh-skin";
  style.dataset.pluginCss = styleId;
  style.textContent = settingsCss;
  document.head.appendChild(style);
  return () => style.remove();
}

function format(t, key, values = {}) {
  let text = t(key);
  for (const [name, value] of Object.entries(values)) text = text.replace(`{${name}}`, String(value));
  return text;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function readJson(response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

function refreshStylesheet(href) {
  let link = document.querySelector('link[data-dsh-skin="1"]');
  if (link === null) {
    link = document.createElement("link");
    link.rel = "stylesheet";
    link.dataset.dshSkin = "1";
    document.head.appendChild(link);
  }
  link.href = href;
}

function SkinSettings({ t }) {
  const [snapshot, setSnapshot] = React.useState({ themes: [], activeThemeId: null, loading: true, locked: false });
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState({ text: "", error: false });
  const fileRef = React.useRef(null);

  const load = async () => {
    const data = await readJson(await fetch(`${API_PATH}/themes`, { headers: { Accept: "application/json" } }));
    setSnapshot({ themes: data.themes, activeThemeId: data.activeThemeId, loading: false, locked: data.selectionLocked === true });
    return data;
  };

  React.useEffect(() => {
    let active = true;
    load().catch(error => {
      if (active) {
        setSnapshot(current => ({ ...current, loading: false }));
        setStatus({ text: format(t, "loadError", { message: errorMessage(error) }), error: true });
      }
    });
    return () => { active = false; };
  }, []);

  const selectTheme = async (event) => {
    const themeId = event.target.value || null;
    setBusy(true);
    setStatus({ text: "", error: false });
    try {
      const data = await readJson(await fetch(`${API_PATH}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ themeId }),
      }));
      refreshStylesheet(data.stylesheetHref);
      setSnapshot(current => ({ ...current, activeThemeId: data.activeThemeId }));
    } catch (error) {
      setStatus({ text: format(t, "applyError", { message: errorMessage(error) }), error: true });
    } finally {
      setBusy(false);
    }
  };

  const importTheme = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus({ text: t("importing"), error: false });
    try {
      const form = new FormData();
      form.append("theme", file, file.name);
      const imported = await readJson(await fetch(`${API_PATH}/import`, { method: "POST", body: form }));
      await load();
      setStatus({ text: format(t, "imported", { name: imported.name }), error: false });
    } catch (error) {
      setStatus({ text: format(t, "importError", { message: errorMessage(error) }), error: true });
    } finally {
      event.target.value = "";
      setBusy(false);
    }
  };

  const unavailable = snapshot.loading || busy || snapshot.locked;
  return h("div", { className: "dsh-skin-settings" },
    h("label", { className: "dsh-skin-settings__label", htmlFor: "dsh-skin-theme" }, t("themeLabel")),
    h("select", {
      id: "dsh-skin-theme",
      className: "dsh-skin-settings__select",
      value: snapshot.activeThemeId ?? "",
      disabled: unavailable,
      onChange: selectTheme,
    },
    h("option", { value: "" }, t("official")),
    ...snapshot.themes.map(theme => h("option", { value: theme.id, key: theme.id }, theme.name))),
    h("button", {
      type: "button",
      className: "dsh-skin-settings__button",
      disabled: busy,
      onClick: () => fileRef.current?.click(),
    }, busy ? t("importing") : t("importZip")),
    h("input", {
      ref: fileRef,
      className: "dsh-skin-settings__file",
      type: "file",
      accept: ".zip",
      onChange: importTheme,
    }),
    h("div", {
      className: "dsh-skin-settings__status",
      role: "status",
      "aria-live": "polite",
      "data-error": status.error ? "true" : "false",
    }, snapshot.loading ? t("loading") : (status.text || (snapshot.themes.length === 0 ? t("empty") : ""))),
  );
}

const inject = ["slots", "locale"];

function apply(ctx) {
  ctx.effect(registerSettingsStyle, "dsh-skin: settings styles");
  ctx.effect(() => ctx.locale.register(NS, dictionaries), "dsh-skin: locale dictionaries");
  ctx.slots.inject("settings.general.item", () => ctx.slots.register({
    name: "settings.general.item",
    id: "dsh-skin",
    order: 30,
    locale: NS,
  }, SkinSettings));
}

module.exports = { inject, apply };

    return module.exports;
  },
});
