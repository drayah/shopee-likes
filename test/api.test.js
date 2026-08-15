const test = require("node:test");
const assert = require("node:assert/strict");
const fixture = require("./fixtures/liked-items-response.json");
const { MARKETS } = require("../src/markets.js");
const {
  createProductUrl,
  getAllLikedItems,
  getLikedItemsUrl,
  getLikeCount,
  normalizeItem
} = require("../src/api.js");

const TEST_ORIGIN = "https://shopee.sg";

function responseFrom(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(value)
  };
}

test("builds the liked-items URL from an explicit market origin", () => {
  assert.equal(
    getLikedItemsUrl({ cursor: 0, limit: 2, offset: 0, status: 0, origin: TEST_ORIGIN }),
    "https://shopee.sg/api/v4/pages/get_liked_items?cursor=0&limit=2&offset=0&status=0"
  );
});
test("reads a wrapped favorites count response", async () => {
  const result = await getLikeCount({
    origin: TEST_ORIGIN,
    fetchImpl: async () => responseFrom({
      data: { distribution: { product_liked_count: 2 }, total_count: 2 },
      error: 0
    })
  });

  assert.equal(result.totalCount, 2);
});

test("reads an unwrapped favorites count response", async () => {
  const result = await getLikeCount({
    origin: TEST_ORIGIN,
    fetchImpl: async () => responseFrom({
      distribution: { product_liked_count: 2 },
      total_count: 2
    })
  });

  assert.equal(result.totalCount, 2);
});

test("uses the page-world bridge when no fetch implementation is supplied", async () => {
  const originalWindow = global.window;
  const originalLocation = global.location;
  const listeners = new Set();
  const bridgeWindow = {
    addEventListener(type, listener) {
      if (type === "message") {
        listeners.add(listener);
      }
    },
    removeEventListener(type, listener) {
      if (type === "message") {
        listeners.delete(listener);
      }
    },
    postMessage(message, targetOrigin) {
      if (message.source !== "shopee-likes-extension") {
        return;
      }

      queueMicrotask(() => {
        for (const listener of listeners) {
          listener({
            data: {
              source: "shopee-likes-page",
              type: "shopee-likes-fetch-response",
              requestId: message.requestId,
              ok: true,
              status: 200,
              body: JSON.stringify({
                distribution: { product_liked_count: 2 },
                total_count: 2
              })
            },
            origin: targetOrigin,
            source: bridgeWindow
          });
        }
      });
    }
  };

  global.window = bridgeWindow;
  global.location = { origin: TEST_ORIGIN };

  try {
    const result = await getLikeCount();
    assert.equal(result.totalCount, 2);
  } finally {
    global.window = originalWindow;
    global.location = originalLocation;
  }
});

test("loads and normalizes a complete favorites page", async () => {
  const calls = [];
  const result = await getAllLikedItems({
    origin: TEST_ORIGIN,
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
  assert.match(calls[1], /limit=1/);
  assert.equal(normalizeItem(result.items[0], TEST_ORIGIN, "SGD").price, 37.02);
  assert.equal(result.items[0].shop_name, "Loja de exemplo");
});

test("runs the favorites flow against every supported market origin", async () => {
  for (const market of MARKETS) {
    const origin = `https://${market.hostname}`;
    const calls = [];
    const result = await getAllLikedItems({
      origin,
      fetchImpl: async url => {
        calls.push(url);
        if (url.includes("get_like_count")) {
          return responseFrom({ data: { total_count: 1 }, error: 0 });
        }
        return responseFrom(fixture);
      }
    });

    assert.equal(result.items.length, 1, market.hostname);
    assert.equal(calls.length, 2, market.hostname);
    assert.ok(
      calls.every(url => url.startsWith(`${origin}/api/v4/pages/`)),
      market.hostname
    );
  }
});

test("uses the actual count instead of requesting the default page size", async () => {
  const calls = [];
  await getAllLikedItems({
    origin: TEST_ORIGIN,
    fetchImpl: async url => {
      calls.push(url);
      if (url.includes("get_like_count")) {
        return responseFrom({
          distribution: { product_liked_count: 2 },
          total_count: 2
        });
      }
      return responseFrom({
        data: { items: [], paging: { cursor: 2, offset: 0, nomore: true } },
        error: 0
      });
    }
  });

  assert.match(calls[1], /limit=2/);
});

test("fails instead of returning partial favorites at the page safety limit", async () => {
  let pageCalls = 0;

  await assert.rejects(
    () => getAllLikedItems({
      origin: TEST_ORIGIN,
      pageSize: 1,
      fetchImpl: async url => {
        if (url.includes("get_like_count")) {
          return responseFrom({ data: { total_count: 101 }, error: 0 });
        }

        pageCalls += 1;
        return responseFrom({
          data: {
            items: [{ itemid: pageCalls }],
            paging: { cursor: pageCalls, offset: 0, nomore: false }
          },
          error: 0
        });
      }
    }),
    /exceeded the 100-page safety limit/
  );

  assert.equal(pageCalls, 100);
});

test("creates a product URL from the API identifiers", () => {
  assert.equal(
    createProductUrl(
      { itemid: 123456789, shopid: 987654321, name: "Example product" },
      TEST_ORIGIN
    ),
    "https://shopee.sg/Example%20product-i.987654321.123456789"
  );
});

test("uses the current market currency when an item omits one", () => {
  const item = normalizeItem({
    itemid: 123,
    shopid: 456,
    name: "Example product",
    price: 250000
  }, TEST_ORIGIN, "SGD");

  assert.equal(item.currency, "SGD");
  assert.equal(item.price, 2.5);
  assert.equal(item.url, "https://shopee.sg/Example%20product-i.456.123");
});

test("fails with a useful message for API errors", async () => {
  await assert.rejects(
    () => getLikeCount({
      origin: TEST_ORIGIN,
      fetchImpl: async () => responseFrom({ error: 13 }, 403)
    }),
    /HTTP 403.*get_like_count/
  );
});
