const test = require("node:test");
const assert = require("node:assert/strict");
const fixture = require("./fixtures/liked-items-response.json");
const {
  createProductUrl,
  getAllLikedItems,
  getLikedItemsUrl,
  getLikeCount,
  normalizeItem
} = require("../src/api.js");

function responseFrom(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(value)
  };
}

test("builds the verified liked-items URL", () => {
  assert.equal(
    getLikedItemsUrl({ cursor: 0, limit: 2, offset: 0, status: 0 }),
    "https://shopee.com.br/api/v4/pages/get_liked_items?cursor=0&limit=2&offset=0&status=0"
  );
});
test("reads the favorites count from the Brazil response shape", async () => {
  const result = await getLikeCount({
    fetchImpl: async () => responseFrom({
      data: { distribution: { product_liked_count: 2 }, total_count: 2 },
      error: 0
    })
  });

  assert.equal(result.totalCount, 2);
});

test("loads and normalizes a complete favorites page", async () => {
  const calls = [];
  const result = await getAllLikedItems({
    fetchImpl: async url => {
      calls.push(url);
      if (url.includes("get_like_count")) {
        return responseFrom({ data: { total_count: 1 }, error: 0 });
      }
      return responseFrom(fixture);
    }
  });

  assert.equal(calls.length, 2);
  assert.equal(result.totalCount, 1);
  assert.equal(result.items.length, 1);
  assert.equal(normalizeItem(result.items[0]).price, 37.02);
  assert.equal(result.items[0].shop_name, "Loja de exemplo");
});

test("creates a product URL from the API identifiers", () => {
  assert.equal(
    createProductUrl({ itemid: 123456789, shopid: 987654321, name: "Produto de exemplo" }),
    "https://shopee.com.br/Produto%20de%20exemplo-i.987654321.123456789"
  );
});

test("fails with a useful message for API errors", async () => {
  await assert.rejects(
    () => getLikeCount({
      fetchImpl: async () => responseFrom({ error: 13 }, 403)
    }),
    /HTTP 403.*get_like_count/
  );
});
