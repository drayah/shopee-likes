const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const manifest = require("../manifest.json");
const packageJson = require("../package.json");

function readPngDimensions(filePath) {
  const image = fs.readFileSync(filePath);

  assert.equal(image.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(image.subarray(12, 16).toString("ascii"), "IHDR");

  return {
    width: image.readUInt32BE(16),
    height: image.readUInt32BE(20)
  };
}

test("keeps release metadata and icon files ready for Chrome", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, packageJson.version);
  assert.equal(manifest.homepage_url, "https://drayah.github.io/shopee-likes/");

  for (const size of [16, 32, 48, 128]) {
    const relativePath = manifest.icons[String(size)];
    const iconPath = path.join(__dirname, "..", relativePath);

    assert.equal(relativePath, `icons/icon-${size}.png`);
    assert.deepEqual(readPngDimensions(iconPath), { width: size, height: size });
  }

  assert.deepEqual(manifest.action.default_icon, {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png"
  });
});
