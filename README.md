# Shopee Likes

An unofficial open-source Chrome extension that adds a desktop view for your Shopee Brasil liked products.

Shopee’s desktop site exposes the heart button but does not provide a visible way to open the liked-products list. This extension reads the same authenticated, same-origin endpoints used by the site and renders the list in a small panel.

## Status

Early prototype: `0.1.0`.

The verified read flow is:

```text
GET /api/v4/pages/get_like_count
GET /api/v4/pages/get_liked_items?cursor=0&limit=N&offset=0&status=0
```

The response includes `data.items`, `data.new_items.item_cards`, and `data.paging`. The extension is read-only: it does not like or unlike products and it does not collect or transmit data to a third party.

The requests run through a narrowly scoped page-world bridge because Shopee accepts the same request from the page’s own JavaScript context but may reject a direct isolated-world content-script request with error `90309999`. The bridge permits only these two same-origin GET paths:

```text
/api/v4/pages/get_like_count
/api/v4/pages/get_liked_items
```

It does not read cookies, copy CSRF tokens, or forward arbitrary requests.

Shopee may change or protect these undocumented internal endpoints at any time. CAPTCHA, anti-bot responses, login expiry, or ad-blocking can prevent the panel from loading.

## Install locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this repository directory.
5. Open a logged-in `https://shopee.com.br/` page.
6. Click the floating **Meus favoritos** button or the extension toolbar action.

The extension requests access only to `https://shopee.com.br/*`. It uses the current page’s authenticated session through same-origin requests; it does not read cookies or ask for credentials.

## Development

This project intentionally has no runtime dependencies or build step.

```sh
npm test
npm run check
```

## Privacy and security

- No analytics, backend, remote code, or account data storage.
- No cookie, password, CSRF-token, or authorization-header access.
- Product data stays in the current page and extension UI.
- The project is not affiliated with Shopee.

## License

MIT. See [LICENSE](LICENSE).
