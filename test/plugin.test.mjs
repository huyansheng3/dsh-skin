import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import { apply } from "../src/index.js";
import { getStatePath, getThemesDir } from "../src/lib/theme-manager.mjs";

let dataDir;

before(() => {
  dataDir = mkdtempSync(join(tmpdir(), "dsh-skin-plugin-test-"));
  process.env.DSH_SKIN_DATA_DIR = dataDir;
});

after(() => {
  delete process.env.DSH_SKIN_DATA_DIR;
  rmSync(dataDir, { recursive: true, force: true });
});

function mount(config = {}) {
  const routes = [];
  const taps = [];
  const webServer = {
    register(route) {
      routes.push(route);
      return () => {};
    },
    tapIndex(tap) {
      taps.push(tap);
      return () => {};
    },
  };
  const webCtx = {
    webServer,
    logger: { info() {}, warn() {}, debug() {} },
    effect(factory) {
      return factory();
    },
  };
  const ctx = {
    inject(services, callback) {
      assert.deepEqual(services, ["webServer"]);
      callback(webCtx);
    },
  };
  apply(ctx, config);
  return { routes, taps };
}

function request(method, url, body = "", headers = {}) {
  const req = Readable.from(body ? [Buffer.from(body)] : []);
  req.method = method;
  req.url = url;
  req.headers = headers;
  return req;
}

function response() {
  return {
    status: undefined,
    headers: {},
    body: Buffer.alloc(0),
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    writeHead(status, headers = {}) {
      this.status = status;
      for (const [name, value] of Object.entries(headers)) this.setHeader(name, value);
    },
    end(chunk = "") {
      this.body = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    },
    json() {
      return JSON.parse(this.body.toString("utf8"));
    },
  };
}

test("uses an isolated data directory when DSH_SKIN_DATA_DIR is set", () => {
  assert.equal(getThemesDir(), join(dataDir, "themes"));
  assert.equal(getStatePath(), join(dataDir, "state.json"));
});

test("injects the active stylesheet and exposes only scoped skin asset routes", () => {
  const { routes, taps } = mount();
  assert.deepEqual(routes.map(route => [route.kind, route.path]), [
    ["exact", "/_skin/active.css"],
    ["prefix", "/_skin/bg"],
    ["prefix", "/_skin/preview"],
    ["prefix", "/_skin/api"],
  ]);
  assert.equal(taps.length, 1);

  const html = taps[0]("<html><head></head><body></body></html>");
  assert.match(html, /<link[^>]+data-dsh-skin="1"[^>]+\/_skin\/active\.css/);
  assert.match(html, /%3Ar4/, "CSS renderer changes must invalidate immutable browser caches");
  assert.doesNotMatch(html, /__dsh_skin_btn|__dsh_skin_panel|\/_skin\/settings/);
});

test("theme inventory exposes a restricted preview URL for each background", async () => {
  const { routes } = mount();
  const api = routes.find(route => route.path === "/_skin/api");
  const preview = routes.find(route => route.path === "/_skin/preview");
  const inventoryResponse = response();

  await api.handler(request("GET", "/_skin/api/themes"), inventoryResponse);
  const theme = inventoryResponse.json().themes.find(item => item.id === "cyndi-sugarhigh-2.0");
  assert.match(theme.previewHref, /^\/_skin\/preview\/cyndi-sugarhigh-2\.0\.jpg\?v=/);

  const previewResponse = response();
  await preview.handler(request("GET", new URL(theme.previewHref, "http://dsh.local").pathname), previewResponse);
  assert.equal(previewResponse.status, 200);
  assert.equal(previewResponse.headers["content-type"], "image/jpeg");

  const denied = response();
  await preview.handler(request("GET", "/_skin/preview/not-a-theme.jpg"), denied);
  assert.equal(denied.status, 404);
});

test("an explicit deactivate overrides the first-run default theme", async () => {
  const { routes } = mount({ defaultTheme: "cyndi-sugarhigh-2.0" });
  const api = routes.find(route => route.path === "/_skin/api");

  const initial = response();
  await api.handler(request("GET", "/_skin/api/themes"), initial);
  assert.equal(initial.status, 200);
  assert.equal(initial.json().activeThemeId, "cyndi-sugarhigh-2.0");

  const changed = response();
  await api.handler(request(
    "POST",
    "/_skin/api/activate",
    JSON.stringify({ themeId: null }),
    { "content-type": "application/json", host: "127.0.0.1:3080", origin: "http://127.0.0.1:3080" },
  ), changed);
  assert.equal(changed.status, 200);
  assert.equal(changed.json().activeThemeId, null);
  assert.match(changed.json().stylesheetHref, /^\/_skin\/active\.css\?v=/);

  const afterChange = response();
  await api.handler(request("GET", "/_skin/api/themes"), afterChange);
  assert.equal(afterChange.json().activeThemeId, null);
  assert.equal(JSON.parse(readFileSync(getStatePath(), "utf8")).activeThemeId, null);
});

test("rejects cross-origin theme mutations", async () => {
  const { routes } = mount();
  const api = routes.find(route => route.path === "/_skin/api");
  const res = response();
  await api.handler(request(
    "POST",
    "/_skin/api/activate",
    JSON.stringify({ themeId: null }),
    { "content-type": "application/json", host: "127.0.0.1:3080", origin: "https://example.com" },
  ), res);
  assert.equal(res.status, 403);
  assert.match(res.json().error, /origin/i);
});

test("discovers a Gallery builtin root, preserves selection, and lets user themes override IDs", async () => {
  const galleryDir = join(dataDir, "gallery-builtins");
  const builtinDir = join(galleryDir, "gallery-fixture");
  const userDir = join(getThemesDir(), "gallery-fixture");
  mkdirSync(builtinDir, { recursive: true });
  writeFileSync(join(builtinDir, "manifest.json"), JSON.stringify({
    schema: 1,
    id: "gallery-fixture",
    name: "Gallery Fixture",
    version: "1.0.0",
  }));
  writeFileSync(join(builtinDir, "theme.json"), JSON.stringify({
    schema: 1,
    colors: { light: {}, dark: {} },
  }));
  writeFileSync(getStatePath(), JSON.stringify({
    activeThemeId: "cyndi-sugarhigh-2.0",
    revision: 7,
  }));
  process.env.DSH_SKIN_GALLERY_DIR = galleryDir;

  try {
    const { routes } = mount();
    const api = routes.find(route => route.path === "/_skin/api");
    const initial = response();
    await api.handler(request("GET", "/_skin/api/themes"), initial);
    const galleryTheme = initial.json().themes.find(theme => theme.id === "gallery-fixture");
    assert.equal(galleryTheme.name, "Gallery Fixture");
    assert.equal(galleryTheme.builtin, true);
    assert.equal(initial.json().activeThemeId, "cyndi-sugarhigh-2.0");

    mkdirSync(getThemesDir(), { recursive: true });
    cpSync(builtinDir, userDir, { recursive: true });
    const userManifest = JSON.parse(readFileSync(join(userDir, "manifest.json"), "utf8"));
    userManifest.name = "User Override";
    writeFileSync(join(userDir, "manifest.json"), JSON.stringify(userManifest));

    const overridden = response();
    await api.handler(request("GET", "/_skin/api/themes"), overridden);
    const matches = overridden.json().themes.filter(theme => theme.id === "gallery-fixture");
    assert.equal(matches.length, 1);
    assert.equal(matches[0].name, "User Override");
    assert.equal(matches[0].builtin, false);
    assert.equal(overridden.json().activeThemeId, "cyndi-sugarhigh-2.0");
    assert.equal(JSON.parse(readFileSync(getStatePath(), "utf8")).revision, 7);
  } finally {
    delete process.env.DSH_SKIN_GALLERY_DIR;
    rmSync(galleryDir, { recursive: true, force: true });
    rmSync(userDir, { recursive: true, force: true });
  }
});
