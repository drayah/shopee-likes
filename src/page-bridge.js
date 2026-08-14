(function installShopeeLikesPageBridge() {
  const REQUEST_SOURCE = "shopee-likes-extension";
  const RESPONSE_SOURCE = "shopee-likes-page";
  const REQUEST_TYPE = "shopee-likes-fetch";
  const RESPONSE_TYPE = "shopee-likes-fetch-response";
  const ALLOWED_PATHS = new Set([
    "/api/v4/pages/get_like_count",
    "/api/v4/pages/get_liked_items"
  ]);

  if (window.__shopeeLikesPageBridgeInstalled) {
    return;
  }

  window.__shopeeLikesPageBridgeInstalled = true;

  function respond(requestId, response) {
    window.postMessage({
      source: RESPONSE_SOURCE,
      type: RESPONSE_TYPE,
      requestId,
      ...response
    }, location.origin);
  }

  window.addEventListener("message", async event => {
    if (event.source !== window || event.origin !== location.origin) {
      return;
    }

    const message = event.data;
    if (message?.source !== REQUEST_SOURCE || message.type !== REQUEST_TYPE) {
      return;
    }

    let requestUrl;
    try {
      requestUrl = new URL(message.path, location.origin);
    } catch (error) {
      respond(message.requestId, { error: "Invalid request URL." });
      return;
    }

    if (requestUrl.origin !== location.origin || !ALLOWED_PATHS.has(requestUrl.pathname)) {
      respond(message.requestId, { error: "Request path is not allowed." });
      return;
    }

    try {
      const response = await window.fetch(requestUrl.toString(), {
        credentials: "include",
        headers: { accept: "application/json" }
      });

      respond(message.requestId, {
        body: await response.text(),
        ok: response.ok,
        status: response.status
      });
    } catch (error) {
      respond(message.requestId, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
})();

