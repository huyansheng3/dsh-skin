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

test("built client registers a native General settings contribution", () => {
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

  let registered;
  let injectedSlot;
  const disposers = [];
  const ctx = {
    effect(factory) {
      const dispose = factory();
      if (typeof dispose === "function") disposers.push(dispose);
      return dispose;
    },
    locale: { register() { return () => {}; } },
    slots: {
      inject(name, factory) {
        injectedSlot = name;
        return factory();
      },
      register(options, component) {
        registered = { options, component };
        return () => {};
      },
    },
  };
  plugin.apply(ctx);

  assert.equal(appendedStyle.dataset.pluginCss, "dsh-skin/settings.css");
  assert.match(appendedStyle.textContent, /\.dsh-skin-settings/);
  assert.equal(injectedSlot, "settings.general.item");
  assert.equal(registered.options.name, "settings.general.item");
  assert.equal(registered.options.id, "dsh-skin");
  assert.ok(Number.isFinite(registered.options.order));

  const tree = registered.component({ t: key => key });
  const serialized = JSON.stringify(tree);
  assert.match(serialized, /themeLabel/);
  assert.match(serialized, /"type":"select"/);
  assert.match(serialized, /"type":"file"/);
  assert.match(serialized, /"accept":"\.zip"/);

  for (const dispose of disposers.reverse()) dispose();
  assert.equal(appendedStyle.removed, true);
});
