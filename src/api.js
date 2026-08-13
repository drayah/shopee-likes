(function exposeShopeeLikesApi(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.ShopeeLikesApi = api;
  }
})(typeof globalThis === "undefined" ? this : globalThis, function createApi() {
  const DEFAULT_ORIGIN = "https://shopee.com.br";
  const DEFAULT_PAGE_SIZE = 50;
  const BRIDGE_REQUEST_SOURCE = "shopee-likes-extension";
  const BRIDGE_RESPONSE_SOURCE = "shopee-likes-page";
  const BRIDGE_REQUEST_TYPE = "shopee-likes-fetch";
  const BRIDGE_RESPONSE_TYPE = "shopee-likes-fetch-response";
  const BRIDGE_TIMEOUT_MS = 15000;

  function getDefaultOrigin() {
    if (typeof location !== "undefined" && location.origin) {
      return location.origin;
    }

    return DEFAULT_ORIGIN;
  }

  function canUsePageBridge() {
    return typeof window !== "undefined"
      && typeof window.addEventListener === "function"
      && typeof window.postMessage === "function";
  }

  function pageFetch(input) {
    const requestUrl = new URL(input, getDefaultOrigin());

    if (requestUrl.origin !== getDefaultOrigin()) {
      return Promise.reject(new Error("Shopee Likes page bridge only permits same-origin requests."));
    }

    const requestId = `shopee-likes-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    return new Promise((resolve, reject) => {
      let timeoutId;

      function cleanup() {
        window.removeEventListener("message", onMessage);
        clearTimeout(timeoutId);
      }

      function onMessage(event) {
        if (event.source !== window || event.origin !== requestUrl.origin) {
          return;
        }

        const message = event.data;
        if (message?.source !== BRIDGE_RESPONSE_SOURCE
          || message.type !== BRIDGE_RESPONSE_TYPE
          || message.requestId !== requestId) {
          return;
        }

        cleanup();

        if (message.error) {
          reject(new Error(message.error));
          return;
        }

        resolve({
          ok: Boolean(message.ok),
          status: Number(message.status) || 0,
          text: async () => String(message.body || "")
        });
      }

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("Shopee page request timed out."));
      }, BRIDGE_TIMEOUT_MS);

      window.addEventListener("message", onMessage);
      window.postMessage({
        source: BRIDGE_REQUEST_SOURCE,
        type: BRIDGE_REQUEST_TYPE,
        requestId,
        path: `${requestUrl.pathname}${requestUrl.search}`
      }, requestUrl.origin);
    });
  }

  function resolveFetch(fetchImpl) {
    if (fetchImpl) {
      return fetchImpl;
    }

    if (canUsePageBridge()) {
      return pageFetch;
    }

    if (typeof fetch === "function") {
      return fetch.bind(typeof globalThis === "undefined" ? undefined : globalThis);
    }

    throw new Error("A fetch implementation is required.");
  }

  function endpoint(path, origin) {
    return new URL(path, origin || getDefaultOrigin()).toString();
  }

  function responseData(payload) {
    if (payload?.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
      return payload.data;
    }

    return payload || {};
  }

  function getLikeCountUrl(origin) {
    return endpoint("/api/v4/pages/get_like_count", origin);
  }

  function getLikedItemsUrl({ cursor = 0, limit = DEFAULT_PAGE_SIZE, offset = 0, status = 0, origin } = {}) {
    const url = new URL("/api/v4/pages/get_liked_items", origin || getDefaultOrigin());
    url.search = new URLSearchParams({
      cursor: String(cursor),
      limit: String(limit),
      offset: String(offset),
      status: String(status)
    }).toString();
    return url.toString();
  }

  async function readJson(response, requestUrl) {
    const body = await response.text();
    let parsed;

    try {
      parsed = JSON.parse(body);
    } catch (error) {
      throw new Error(`Shopee returned non-JSON from ${requestUrl}: ${body.slice(0, 240)}`);
    }

    if (!response.ok) {
      throw new Error(`Shopee returned HTTP ${response.status} from ${requestUrl}: ${JSON.stringify(parsed).slice(0, 240)}`);
    }

    if (parsed.error && parsed.error !== 0) {
      throw new Error(`Shopee returned API error ${parsed.error} from ${requestUrl}`);
    }

    return parsed;
  }

  async function getLikeCount({ fetchImpl, origin } = {}) {
    const requestUrl = getLikeCountUrl(origin);
    const response = await resolveFetch(fetchImpl)(requestUrl, {
      credentials: "include",
      headers: { accept: "application/json" }
    });
    const payload = await readJson(response, requestUrl);
    const data = responseData(payload);
    const distribution = data.distribution || {};

    return {
      totalCount: Number(data.total_count ?? distribution.product_liked_count ?? 0),
      raw: payload
    };
  }

  async function getLikedItemsPage({ fetchImpl, cursor = 0, limit = DEFAULT_PAGE_SIZE, offset = 0, status = 0, origin } = {}) {
    const requestUrl = getLikedItemsUrl({ cursor, limit, offset, status, origin });
    const response = await resolveFetch(fetchImpl)(requestUrl, {
      credentials: "include",
      headers: { accept: "application/json" }
    });
    const payload = await readJson(response, requestUrl);
    const data = responseData(payload);

    return {
      items: Array.isArray(data.items) ? data.items : [],
      paging: data.paging || { cursor, offset, nomore: true },
      cards: Array.isArray(data.new_items?.item_cards) ? data.new_items.item_cards : [],
      raw: payload
    };
  }

  async function getAllLikedItems({ fetchImpl, origin, pageSize = DEFAULT_PAGE_SIZE } = {}) {
    const count = await getLikeCount({ fetchImpl, origin });
    const requestedPageSize = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
    const limit = count.totalCount > 0
      ? Math.min(requestedPageSize, count.totalCount)
      : requestedPageSize;
    const items = [];
    let cursor = 0;
    let offset = 0;
    let page;

    for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
      page = await getLikedItemsPage({ fetchImpl, origin, cursor, limit, offset });
      items.push(...page.items);

      if (page.paging.nomore || page.items.length === 0) {
        break;
      }

      const nextCursor = page.paging.cursor ?? cursor + page.items.length;
      const nextOffset = page.paging.offset ?? offset;

      if (nextCursor === cursor && nextOffset === offset) {
        throw new Error("Shopee returned a non-advancing favorites cursor.");
      }

      cursor = nextCursor;
      offset = nextOffset;
    }

    return {
      items,
      totalCount: count.totalCount,
      count,
      lastPage: page
    };
  }

  function createProductUrl(item, origin = DEFAULT_ORIGIN) {
    if (!item || item.itemid == null || item.shopid == null) {
      return null;
    }

    const title = item.name ? `${encodeURIComponent(item.name)}-` : "product-";
    return `${origin}/${title}i.${item.shopid}.${item.itemid}`;
  }

  function normalizeItem(item, origin) {
    return {
      itemId: item.itemid,
      shopId: item.shopid,
      name: item.name || "Sem título",
      image: item.image || null,
      shopName: item.shop_name || "",
      currency: item.currency || "BRL",
      price: Number.isFinite(item.price) ? item.price / 100000 : null,
      liked: item.liked === true,
      stock: item.stock ?? null,
      status: item.item_status || item.status || null,
      url: createProductUrl(item, origin)
    };
  }

  return {
    DEFAULT_ORIGIN,
    DEFAULT_PAGE_SIZE,
    createProductUrl,
    getAllLikedItems,
    getLikedItemsPage,
    getLikedItemsUrl,
    getLikeCount,
    getLikeCountUrl,
    normalizeItem
  };
});
