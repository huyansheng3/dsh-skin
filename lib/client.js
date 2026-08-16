window.__ModuleLoader__.load({
  id: "dsh-skin",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
/**
 * Browser half of dsh-skin. It contributes a Skin Gallery section to DSH's
 * native settings navigation, loads image-backed theme inventory from the
 * same-origin Host API, and refreshes the Host-owned stylesheet after a card
 * selection. It does not own persistence, ZIP validation, navigation chrome,
 * or arbitrary filesystem asset access.
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
    galleryLabel: "皮肤库",
    galleryTitle: "皮肤库",
    galleryDescription: "点击预览图即可应用皮肤",
    official: "官方外观",
    officialDescription: "恢复 DeepSeek Harness 默认外观",
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
    galleryLabel: "Skin Gallery",
    galleryTitle: "Skin Gallery",
    galleryDescription: "Select a preview to apply a skin",
    official: "Official appearance",
    officialDescription: "Restore the default DeepSeek Harness appearance",
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
  .dsh-skin-settings { display: flex; flex-direction: column; min-height: 100%; gap: 16px; color: var(--dsw-alias-label-primary); }
  .dsh-skin-settings__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
  .dsh-skin-settings__title { margin: 0; font-size: 18px; font-weight: 600; line-height: 26px; }
  .dsh-skin-settings__description { margin: 4px 0 0; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
  .dsh-skin-settings__button { flex: none; min-width: 92px; height: 36px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); cursor: pointer; padding: 0 12px; font: inherit; }
  .dsh-skin-settings__button:hover:not(:disabled), .dsh-skin-settings__button:focus-visible { border-color: var(--dsw-alias-brand-primary); }
  .dsh-skin-settings__button:disabled, .dsh-skin-settings__gallery-button:disabled { cursor: default; opacity: .55; }
  .dsh-skin-settings__file { display: none; }
  .dsh-skin-settings__gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: 12px; }
  .dsh-skin-settings__gallery-button { position: relative; display: block; min-width: 0; aspect-ratio: 16 / 10; overflow: hidden; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); cursor: pointer; padding: 0; text-align: left; }
  .dsh-skin-settings__gallery-button:hover:not(:disabled), .dsh-skin-settings__gallery-button:focus-visible { border-color: var(--dsw-alias-brand-primary); outline: none; }
  .dsh-skin-settings__gallery-button[data-active="true"] { border: 2px solid var(--dsw-alias-brand-primary); }
  .dsh-skin-settings__preview { width: 100%; height: 100%; object-fit: cover; display: block; background: var(--dsw-alias-bg-base); }
  .dsh-skin-settings__fallback { display: block; width: 100%; height: 100%; background: linear-gradient(135deg, var(--dsw-alias-bg-layer-1) 0%, var(--dsw-alias-bg-layer-2) 100%); }
  .dsh-skin-settings__official { display: block; width: 100%; height: 100%; background: linear-gradient(135deg, var(--dsw-alias-bg-layer-1) 0 48%, var(--dsw-alias-bg-layer-2) 48% 52%, var(--dsw-alias-bg-layer-1) 52%); }
  .dsh-skin-settings__caption { position: absolute; right: 0; bottom: 0; left: 0; padding: 22px 10px 9px; background: linear-gradient(transparent, rgba(0, 0, 0, .78)); color: #fff; font-size: 13px; font-weight: 600; line-height: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dsh-skin-settings__caption small { display: block; margin-top: 1px; color: rgba(255, 255, 255, .76); font-size: 11px; font-weight: 400; line-height: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dsh-skin-settings__status { min-height: 18px; color: var(--dsw-alias-label-secondary); font-size: 12px; overflow-wrap: anywhere; }
  .dsh-skin-settings__status[data-error="true"] { color: var(--dsw-alias-error-primary, #c33); }
  /* DSH's settings shell supplies a fixed pale selected fill. Theme text can be
     light, so use the selected skin's panel token for both active nav contrast and hue. */
  [role="dialog"] button[aria-current="true"] { background-color: var(--ds-theme-color-panel-alt, var(--dsw-alias-bg-layer-2)) !important; color: var(--dsw-alias-label-primary) !important; box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l1); }
  @media (max-width: 640px) { .dsh-skin-settings__header { flex-direction: column; } .dsh-skin-settings__button { width: 100%; } .dsh-skin-settings__gallery { grid-template-columns: repeat(auto-fill, minmax(142px, 1fr)); gap: 10px; } }
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

function SkinGallerySection({ t }) {
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

  const selectTheme = async (themeId) => {
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
  const renderCard = (theme) => {
    const active = snapshot.activeThemeId === theme.id;
    return h("button", {
      type: "button",
      key: theme.id,
      className: "dsh-skin-settings__gallery-button",
      disabled: unavailable,
      "data-active": active ? "true" : "false",
      "aria-pressed": active,
      title: theme.name,
      onClick: () => selectTheme(theme.id),
    },
    theme.previewHref
      ? h("img", { className: "dsh-skin-settings__preview", src: theme.previewHref, alt: "", loading: "lazy" })
      : h("span", { className: "dsh-skin-settings__fallback", "aria-hidden": "true" }),
    h("span", { className: "dsh-skin-settings__caption" }, theme.name,
      theme.author ? h("small", null, theme.author) : null));
  };

  return h("section", { className: "dsh-skin-settings", "aria-label": t("galleryTitle") },
    h("div", { className: "dsh-skin-settings__header" },
      h("div", null,
        h("h2", { className: "dsh-skin-settings__title" }, t("galleryTitle")),
        h("p", { className: "dsh-skin-settings__description" }, t("galleryDescription"))),
      h("button", {
        type: "button",
        className: "dsh-skin-settings__button",
        disabled: busy || snapshot.locked,
        onClick: () => fileRef.current?.click(),
      }, busy ? t("importing") : t("importZip"))),
    h("input", {
      ref: fileRef,
      className: "dsh-skin-settings__file",
      type: "file",
      accept: ".zip",
      onChange: importTheme,
    }),
    h("div", { className: "dsh-skin-settings__gallery", role: "grid", "aria-busy": snapshot.loading ? "true" : "false" },
      h("button", {
        type: "button",
        className: "dsh-skin-settings__gallery-button",
        disabled: unavailable,
        "data-active": snapshot.activeThemeId === null ? "true" : "false",
        "aria-pressed": snapshot.activeThemeId === null,
        title: t("officialDescription"),
        onClick: () => selectTheme(null),
      },
      h("span", { className: "dsh-skin-settings__official", "aria-hidden": "true" }),
      h("span", { className: "dsh-skin-settings__caption" }, t("official"),
        h("small", null, t("officialDescription")))),
    ...snapshot.themes.map(renderCard)),
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
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "dsh-skin-gallery",
    order: 30,
    label: () => ctx.locale.bind(NS)("galleryLabel"),
    locale: NS,
  }, SkinGallerySection));
}

module.exports = { inject, apply };

    return module.exports;
  },
});
