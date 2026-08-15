const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "content-script.js"),
  "utf8"
);

function pixelVariable(name) {
  const match = source.match(new RegExp(`--${name}: (\\d+)px;`));
  assert.ok(match, `Missing --${name} CSS variable`);
  return Number(match[1]);
}

test("keeps the launcher clear of Shopee chat and the panel above the launcher", () => {
  const launcherBottom = pixelVariable("shopee-likes-launcher-bottom");
  const panelBottom = pixelVariable("shopee-likes-panel-bottom");
  const launcherHeight = pixelVariable("shopee-likes-launcher-height");

  assert.ok(launcherBottom >= 64);
  assert.equal(panelBottom - launcherBottom - launcherHeight, 12);
  assert.match(source, /bottom: var\(--shopee-likes-launcher-bottom\);/);
  assert.match(source, /bottom: var\(--shopee-likes-panel-bottom\);/);
  assert.match(source, /height: var\(--shopee-likes-launcher-height\);/);
});
