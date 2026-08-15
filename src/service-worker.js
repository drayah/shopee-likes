importScripts("markets.js");

chrome.action.onClicked.addListener(async tab => {
  if (!tab.id || !globalThis.ShopeeLikesMarkets.isSupportedUrl(tab.url)) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "toggle-shopee-likes" });
  } catch (error) {
    console.debug("Shopee Likes could not reach the page content script.", error);
  }
});
