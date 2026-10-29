const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("assets/scripts/core/v3-feature-pack.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const sceneSource = fs.readFileSync("assets/scripts/core/game-scene.js", "utf8");
const storage = new Map();
const window = {
  addEventListener() {},
  removeEventListener() {},
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
  innerWidth: 960,
  innerHeight: 540
};
const context = vm.createContext({
  window,
  localStorage: window.localStorage,
  document: { body: { style: {} } },
  navigator: {},
  console
});
vm.runInContext(source, context, { filename: "v3-feature-pack.js" });

const features = window.WDV3.features;
assert.equal(new Set(features.map(feature => feature.id)).size, features.length, "feature IDs must be unique");
assert.ok(features.length >= 100, `expected at least 100 features, got ${features.length}`);
assert.ok(features.some(feature => feature.kind === "command"));
assert.ok(features.some(feature => feature.kind === "toggle"));
assert.equal(`${source}\n${index}\n${sceneSource}`.includes("V3 Labs"), false, "the old Labs placeholder must stay removed");
assert.equal(index.includes("v3-features.js"), false, "the old placeholder script must stay removed");
assert.equal(window.WDV3.isEnabled("editor_snap_to_grid"), false);
window.WDV3.run("editor_snap_to_grid", {});
assert.equal(window.WDV3.isEnabled("editor_snap_to_grid"), true);
assert.equal(window.wdEditorSnapToGrid, true);
window.WDV3.run("editor_snap_to_grid", {});
assert.equal(window.WDV3.isEnabled("editor_snap_to_grid"), false);
window.WDV3.run("editor_snap_to_grid", {});
assert.equal(window.WDV3.isEnabled("editor_snap_to_grid"), true);
window.WDV3.run("reset_v3_preferences", {});
assert.equal(window.WDV3.isEnabled("editor_snap_to_grid"), false);
console.log(`V3 feature inventory OK: ${features.length} separate features`);
