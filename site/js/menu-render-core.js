/* Shared menu HTML renderer — used by menu.js and admin draft preview */
window.WSMenuRender = (function () {
  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderItem(item, index, options = {}) {
    const { showOrderButton = false, initialVisible = false, orderable = true } = options;
    const canOrder = showOrderButton && orderable !== false && item.orderable !== false;
    const price = item.price
      ? `<span class="price">${escapeHtml(item.price)}</span>`
      : "";
    let orderBtn = "";
    if (canOrder) {
      if (item.toastOrderUrl) {
        orderBtn = `<a href="${escapeHtml(item.toastOrderUrl)}" class="btn btn-outline menu-item-order-btn menu-item-order-link" target="_blank" rel="noopener noreferrer">Order on Toast</a>`;
      } else {
        orderBtn = `<button type="button" class="btn btn-outline menu-item-order-btn" data-pickup-add data-item-name="${escapeHtml(item.name)}" data-item-price="${escapeHtml(item.price || "")}">Add to order</button>`;
      }
    }
    const actions =
      price || orderBtn
        ? `<div class="menu-item-actions">${price}${orderBtn}</div>`
        : "";
    let desc = item.desc ? `<p>${escapeHtml(item.desc)}</p>` : "";
    if (item.link) {
      desc = `<p><a href="${escapeHtml(item.link)}">See happy hour →</a></p>`;
    }
    const visibleClass = initialVisible ? " visible" : "";
    return `
      <article class="menu-item menu-item--animate${visibleClass}" style="--item-i: ${index}">
        <div class="menu-item-body">
          <h3>${escapeHtml(item.name)}</h3>
          ${desc}
        </div>
        ${actions}
      </article>`;
  }

  function renderCategory(cat, menuId, options = {}) {
    const categoryOrderable = options.orderable !== false && cat.orderable !== false;
    const note = cat.note
      ? `<p class="menu-cat-note">${escapeHtml(cat.note)}</p>`
      : "";
    const orderNote =
      options.showOrderButton && !categoryOrderable
        ? `<p class="menu-cat-note menu-cat-order-note">${escapeHtml(cat.orderNote || options.orderNote || "Shown for dine-in service only.")}</p>`
        : "";
    const itemOptions = { ...options, orderable: categoryOrderable };
    const items = (cat.items || []).map((item, i) => renderItem(item, i, itemOptions)).join("");
    return `
      <section class="menu-category-block" id="${menuId}-${cat.id}" data-category="${cat.id}">
        <h2 class="menu-category-title">${escapeHtml(cat.name)}</h2>
        ${note}${orderNote}
        <div class="menu-items">${items}</div>
      </section>`;
  }

  function renderTabs(menus, activeMenuId) {
    return menus
      .map(
        (m) => `
      <button type="button" class="menu-tab${m.id === activeMenuId ? " is-active" : ""}" role="tab"
        aria-selected="${m.id === activeMenuId ? "true" : "false"}"
        data-menu="${escapeHtml(m.id)}" disabled>
        ${escapeHtml(m.label)}
      </button>`
      )
      .join("");
  }

  function renderSidebar(menu, activeCategoryId) {
    return menu.categories
      .map(
        (c) => `
      <span class="menu-cat-link${c.id === activeCategoryId ? " active" : ""}" data-cat="${escapeHtml(c.id)}">
        ${escapeHtml(c.name)}
      </span>`
      )
      .join("");
  }

  function renderPanel(menu, activeMenuId, options = {}) {
    const isActive = menu.id === activeMenuId;
    const menuOptions = {
      ...options,
      orderable: options.orderable !== false && menu.orderable !== false,
      orderNote: menu.orderNote || options.orderNote,
    };
    const categories = menu.categories.map((c) => renderCategory(c, menu.id, menuOptions)).join("");
    const image = menu.image
        ? `<div class="menu-panel-media reveal-right visible"><img src="${escapeHtml(menu.image)}" alt="${escapeHtml(menu.label)}" loading="lazy" /></div>`
      : menu.id === "main-menu"
        ? `<div class="menu-panel-media reveal-right visible"><img src="assets/gallery/WSMenu.webp" alt="Whistle Stop menu" loading="lazy" /></div>`
        : "";

    return `
      <div class="menu-panel${isActive ? " is-active panel-entered" : ""}" data-menu="${escapeHtml(menu.id)}"${isActive ? "" : " hidden"}>
        <div class="menu-panel-grid">
          <div class="menu-panel-content">
            ${menu.intro ? `<p class="menu-panel-intro">${escapeHtml(menu.intro)}</p>` : ""}
            ${categories}
          </div>
          ${image}
        </div>
      </div>`;
  }

  function renderApp(menusData, activeMenuId, activeCategoryId) {
    const menus = menusData?.menus || [];
    const activeMenu = menus.find((m) => m.id === activeMenuId) || menus[0];
    const catId = activeCategoryId || activeMenu?.categories?.[0]?.id || "";

    return `
      <div class="menu-toolbar admin-menu-draft-toolbar">
        <div class="container">
          <nav class="menu-tabs" role="tablist" aria-label="Menu type preview">
            ${renderTabs(menus, activeMenu?.id || "main-menu")}
          </nav>
        </div>
      </div>
      <div class="container menu-layout">
        <aside class="menu-sidebar visible" aria-label="Menu categories preview">
          ${activeMenu ? renderSidebar(activeMenu, catId) : ""}
        </aside>
        <div class="menu-panels">
          ${menus.map((m) => renderPanel(m, activeMenu?.id || "main-menu", { initialVisible: true })).join("")}
        </div>
      </div>`;
  }

  return { renderApp, renderItem, escapeHtml };
})();
