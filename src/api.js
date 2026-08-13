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

  function getDefaultOrigin() {
    if (typeof location !== "undefined" && location.origin) {
      return location.origin;
    }

    return DEFAULT_ORIGIN;
  }

  function resolveFetch(fetchImpl) {
    if (fetchImpl) {
      return fetchImpl;
    }

    if (typeof fetch === "function") {
      return fetch.bind(typeof globalThis === "undefined" ? undefined : globalThis);
    }

    throw new Error("A fetch implementation is required.");
  }

  function endpoint(path, origin) {
    return new URL(path, origin || getDefaultOrigin()).toString();
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
    const data = payload.data || {};
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
    const data = payload.data || {};

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
    const limit = Math.max(requestedPageSize, count.totalCount);
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
