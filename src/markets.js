(function exposeShopeeLikesMarkets(root, factory) {
  const markets = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = markets;
  }

  if (root) {
    root.ShopeeLikesMarkets = markets;
  }
})(typeof globalThis === "undefined" ? this : globalThis, function createMarkets() {
  const MARKETS = Object.freeze([
    Object.freeze({
      hostname: "shopee.com.br",
      name: "Brazil",
      locale: "pt-BR",
      currency: "BRL",
      imageHost: "down-br.img.susercontent.com",
      verified: true
    }),
    Object.freeze({
      hostname: "shopee.co.id",
      name: "Indonesia",
      locale: "id-ID",
      currency: "IDR",
      imageHost: "down-id.img.susercontent.com",
      verified: false
    }),
    Object.freeze({
      hostname: "shopee.com.my",
      name: "Malaysia",
      locale: "en-MY",
      currency: "MYR",
      imageHost: "down-my.img.susercontent.com",
      verified: false
    }),
    Object.freeze({
      hostname: "shopee.ph",
      name: "Philippines",
      locale: "en-PH",
      currency: "PHP",
      imageHost: "down-ph.img.susercontent.com",
      verified: false
    }),
    Object.freeze({
      hostname: "shopee.sg",
      name: "Singapore",
      locale: "en-SG",
      currency: "SGD",
      imageHost: "down-sg.img.susercontent.com",
      verified: false
    }),
    Object.freeze({
      hostname: "shopee.co.th",
      name: "Thailand",
      locale: "th-TH",
      currency: "THB",
      imageHost: "down-th.img.susercontent.com",
      verified: false
    }),
    Object.freeze({
      hostname: "shopee.tw",
      name: "Taiwan",
      locale: "zh-TW",
      currency: "TWD",
      imageHost: "down-tw.img.susercontent.com",
      verified: false
    }),
    Object.freeze({
      hostname: "shopee.vn",
      name: "Vietnam",
      locale: "vi-VN",
      currency: "VND",
      imageHost: "down-vn.img.susercontent.com",
      verified: false
    })
  ]);

  const marketsByHostname = new Map(MARKETS.map(market => [market.hostname, market]));

  function normalizeHostname(hostname) {
    return String(hostname || "").trim().toLowerCase().replace(/\.$/, "");
  }

  function getMarket(hostname) {
    return marketsByHostname.get(normalizeHostname(hostname)) || null;
  }

  function isSupportedUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && getMarket(url.hostname) !== null;
    } catch (error) {
      return false;
    }
  }

  function getMatchPatterns() {
    return MARKETS.map(market => `https://${market.hostname}/*`);
  }

  function getImageUrl(image, market) {
    if (!image) {
      return null;
    }

    if (/^https:\/\//i.test(image)) {
      return image;
    }

    if (!market?.imageHost) {
      throw new Error("A Shopee market is required to build an image URL.");
    }

    return `https://${market.imageHost}/file/${encodeURIComponent(image)}_tn.webp`;
  }

  return {
    MARKETS,
    getImageUrl,
    getMarket,
    getMatchPatterns,
    isSupportedUrl
  };
});
