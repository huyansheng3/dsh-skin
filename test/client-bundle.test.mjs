import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const CLIENT_BUNDLE = new URL("../lib/client.js", import.meta.url);

function fakeReact() {
  return {
    createElement(type, props, ...children) {
      return { type, props: { ...(props ?? {}), children } };
    },
    useEffect() {},
    useRef(value) { return { current: value }; },
    useState(initial) {
      return [typeof initial === "function" ? initial() : initial, () => {}];
    },
  };
}

test("built client registers a native Skin Gallery settings section", () => {
  let definition;
  let appendedStyle;
  const window = {
    __ModuleLoader__: {
      load(value) { definition = value; },
    },
  };
  const document = {
    querySelector() { return null; },
    createElement(tag) {
      assert.equal(tag, "style");
      return {
        dataset: {},
        removed: false,
        remove() { this.removed = true; },
      };
    },
    head: {
      appendChild(style) { appendedStyle = style; },
    },
  };
  runInNewContext(readFileSync(CLIENT_BUNDLE, "utf8"), { document, window });

  assert.equal(definition.id, "dsh-skin");
  const plugin = definition.factory((id) => {
    if (id === "react") return fakeReact();
    throw new Error(`Unexpected client dependency: ${id}`);
  });
  assert.deepEqual([...plugin.inject], ["slots", "locale"]);

  const registered = [];
  const injectedSlots = [];
  const disposers = [];
  const ctx = {
    effect(factory) {
      const dispose = factory();
      if (typeof dispose === "function") disposers.push(dispose);
      return dispose;
    },
    locale: {
      register() { return () => {}; },
      bind() { return key => key; },
    },
    slots: {
      inject(name, factory) {
        injectedSlots.push(name);
        return factory();
      },
      register(options, component) {
        registered.push({ options, component });
        return () => {};
      },
    },
  };
  plugin.apply(ctx);

  assert.equal(appendedStyle.dataset.pluginCss, "dsh-skin/settings.css");
  assert.match(appendedStyle.textContent, /\.dsh-skin-settings/);
  assert.match(appendedStyle.textContent, /button\[aria-current="true"\]/);
  assert.match(appendedStyle.textContent, /--ds-theme-color-panel-alt/);
  assert.deepEqual(injectedSlots, ["settings.section"]);
  assert.equal(registered.length, 1);
  assert.equal(registered[0].options.name, "settings.section");
  assert.equal(registered[0].options.id, "dsh-skin-gallery");
  assert.ok(Number.isFinite(registered[0].options.order));
  assert.equal(typeof registered[0].options.label, "function");
  assert.equal(registered[0].options.label(), "galleryLabel");

  const tree = registered[0].component({ t: key => key });
  const serialized = JSON.stringify(tree);
  assert.match(serialized, /galleryTitle/);
  assert.match(serialized, /galleryDescription/);
  assert.match(serialized, /"role":"grid"/);
  assert.match(serialized, /"type":"file"/);
  assert.match(serialized, /"accept":"\.zip"/);

  for (const dispose of disposers.reverse()) dispose();
  assert.equal(appendedStyle.removed, true);
});
