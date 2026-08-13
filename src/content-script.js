(function startShopeeLikes() {
  if (window.top !== window.self || document.getElementById("shopee-likes-root")) {
    return;
  }

  const api = window.ShopeeLikesApi;
  const root = document.createElement("div");
  root.id = "shopee-likes-root";
  const shadow = root.attachShadow({ mode: "open" });
  document.documentElement.appendChild(root);

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .launcher, .panel { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .launcher {
      align-items: center;
      background: #ee4d2d;
      border: 0;
      border-radius: 999px;
      bottom: 24px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, .22);
      color: white;
      cursor: pointer;
      display: flex;
      font-size: 14px;
      font-weight: 700;
      gap: 8px;
      padding: 12px 16px;
      position: fixed;
      right: 24px;
      z-index: 2147483647;
    }
    .launcher:hover { background: #d84325; }
    .panel {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      bottom: 76px;
      box-shadow: 0 18px 56px rgba(15, 23, 42, .24);
      color: #111827;
      display: none;
      max-height: min(72vh, 720px);
      overflow: hidden;
      position: fixed;
      right: 24px;
      width: min(440px, calc(100vw - 32px));
      z-index: 2147483647;
    }
    .panel.open { display: flex; flex-direction: column; }
    .header { align-items: center; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; padding: 16px; }
    .title { font-size: 16px; font-weight: 700; }
    .subtitle { color: #6b7280; font-size: 12px; margin-top: 3px; }
    .actions { display: flex; gap: 6px; }
    .icon-button { background: transparent; border: 0; color: #6b7280; cursor: pointer; font-size: 18px; padding: 4px 6px; }
    .content { overflow: auto; padding: 12px; }
    .status { color: #6b7280; font-size: 13px; padding: 16px 4px; }
    .error { color: #b42318; font-size: 13px; line-height: 1.4; padding: 12px 4px; }
    .grid { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .card { border: 1px solid #eee; border-radius: 12px; color: inherit; display: block; overflow: hidden; text-decoration: none; }
    .card:hover { border-color: #ee4d2d; }
    .image { aspect-ratio: 1; background: #f8fafc; display: block; object-fit: cover; width: 100%; }
    .details { padding: 9px; }
    .name { display: -webkit-box; font-size: 12px; line-height: 1.35; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
    .price { color: #ee4d2d; font-size: 14px; font-weight: 700; margin-top: 7px; }
    .shop { color: #6b7280; font-size: 11px; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `;

  const launcher = document.createElement("button");
  launcher.className = "launcher";
  launcher.type = "button";
  launcher.textContent = "♥ Meus favoritos";

  const panel = document.createElement("section");
  panel.className = "panel";
  panel.setAttribute("aria-label", "Meus favoritos Shopee");
  panel.innerHTML = `
    <div class="header">
      <div>
        <div class="title">Meus favoritos</div>
        <div class="subtitle">Shopee Brasil</div>
      </div>
      <div class="actions">
        <button class="icon-button refresh" type="button" title="Atualizar" aria-label="Atualizar">↻</button>
        <button class="icon-button close" type="button" title="Fechar" aria-label="Fechar">×</button>
      </div>
    </div>
    <div class="content"><div class="status">Carregue seus favoritos.</div></div>
  `;

  shadow.append(style, launcher, panel);

  const content = panel.querySelector(".content");

  function setContent(node) {
    content.replaceChildren(node);
  }

  function setStatus(message) {
    const node = document.createElement("div");
    node.className = "status";
    node.textContent = message;
    setContent(node);
  }

  function setError(error) {
    const node = document.createElement("div");
    node.className = "error";
    node.textContent = `Não foi possível carregar seus favoritos: ${error.message}`;
    setContent(node);
  }

  function imageUrl(image) {
    return image ? `https://down-br.img.susercontent.com/file/${encodeURIComponent(image)}_tn.webp` : null;
  }

  function formatPrice(item) {
    if (item.price == null) {
      return "Preço indisponível";
    }

    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: item.currency || "BRL"
    }).format(item.price);
  }

  function renderItems(items) {
    if (!items.length) {
      setStatus("Você ainda não tem produtos favoritados.");
      return;
    }

    const grid = document.createElement("div");
    grid.className = "grid";

    for (const rawItem of items) {
      const item = api.normalizeItem(rawItem, location.origin);
      const card = document.createElement("a");
      card.className = "card";
      card.href = item.url || "#";
      card.target = "_blank";
      card.rel = "noopener noreferrer";

      const image = document.createElement("img");
      image.className = "image";
      image.alt = item.name;
      image.loading = "lazy";
      image.src = imageUrl(item.image) || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

      const details = document.createElement("div");
      details.className = "details";
      const name = document.createElement("div");
      name.className = "name";
      name.textContent = item.name;
      const price = document.createElement("div");
      price.className = "price";
      price.textContent = formatPrice(item);
      const shop = document.createElement("div");
      shop.className = "shop";
      shop.textContent = item.shopName;
      details.append(name, price, shop);
      card.append(image, details);
      grid.append(card);
    }

    setContent(grid);
  }

  async function loadItems() {
    setStatus("Carregando favoritos…");

    try {
      const result = await api.getAllLikedItems({ origin: location.origin });
      renderItems(result.items);
    } catch (error) {
      setError(error);
    }
  }

  function toggle() {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) {
      loadItems();
    }
  }

  launcher.addEventListener("click", toggle);
  panel.querySelector(".close").addEventListener("click", () => panel.classList.remove("open"));
  panel.querySelector(".refresh").addEventListener("click", loadItems);
  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === "toggle-shopee-likes") {
      toggle();
    }
  });
})();
