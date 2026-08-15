const test = require("node:test");
const assert = require("node:assert/strict");
const manifest = require("../manifest.json");
const {
  MARKETS,
  getImageUrl,
  getMarket,
  getMatchPatterns,
  isSupportedUrl
} = require("../src/markets.js");

const EXPECTED_HOSTNAMES = [
  "shopee.com.br",
  "shopee.co.id",
  "shopee.com.my",
  "shopee.ph",
  "shopee.sg",
  "shopee.co.th",
  "shopee.tw",
  "shopee.vn"
];

test("defines the eight supported Shopee markets", () => {
  assert.deepEqual(MARKETS.map(market => market.hostname), EXPECTED_HOSTNAMES);
  assert.deepEqual(
    MARKETS.filter(market => market.verified).map(market => market.hostname),
    ["shopee.com.br"]
  );

  for (const market of MARKETS) {
    assert.match(market.locale, /^[a-z]{2}-[A-Z]{2}$/);
    assert.match(market.currency, /^[A-Z]{3}$/);
    assert.match(market.imageHost, /^down-[a-z]{2}\.img\.susercontent\.com$/);
  }
});

test("resolves supported hosts and rejects unsupported URLs", () => {
  assert.equal(getMarket("SHOPEE.PH.")?.currency, "PHP");
  assert.equal(getMarket("example.com"), null);
  assert.equal(isSupportedUrl("https://shopee.vn/product/123"), true);
  assert.equal(isSupportedUrl("http://shopee.vn/product/123"), false);
  assert.equal(isSupportedUrl("https://shopee.vn.example.com/product/123"), false);
  assert.equal(isSupportedUrl("not a URL"), false);
});

test("builds market-specific image URLs and preserves complete HTTPS URLs", () => {
  const philippines = getMarket("shopee.ph");

  assert.equal(
    getImageUrl("example image", philippines),
    "https://down-ph.img.susercontent.com/file/example%20image_tn.webp"
  );
  assert.equal(
    getImageUrl("https://cdn.example.com/image.webp", philippines),
    "https://cdn.example.com/image.webp"
  );
  assert.equal(getImageUrl(null, philippines), null);
  assert.throws(() => getImageUrl("example", null), /market is required/);
});

test("keeps manifest permissions synchronized with the market registry", () => {
  const expectedPatterns = getMatchPatterns();

  assert.deepEqual(manifest.host_permissions, expectedPatterns);
  assert.equal(manifest.content_scripts.length, 2);

  for (const contentScript of manifest.content_scripts) {
    assert.deepEqual(contentScript.matches, expectedPatterns);
  }

  assert.deepEqual(manifest.content_scripts[1].js, [
    "src/markets.js",
    "src/api.js",
    "src/content-script.js"
  ]);
});
