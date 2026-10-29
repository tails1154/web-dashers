const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("assets/scripts/core/v3-feature-pack.js", "utf8");
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
assert.equal(source.includes("V3 Labs"), false, "the old Labs placeholder must stay removed");
console.log(`V3 feature inventory OK: ${features.length} separate features`);
