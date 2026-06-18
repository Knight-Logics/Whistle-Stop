/* Menu — tab selectors + category sidebar + slide-in animations */
(function () {
  const root = document.getElementById("menu-app");
  if (!root) return;

  const isMenuPreview = new URLSearchParams(window.location.search).has("menuPreview");
  if (isMenuPreview) {
    document.documentElement.classList.add("ws-menu-preview-embed");
  }

  let data = null;
  let activeMenu = "main-menu";
  let pendingCategoryId = null;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function menuOrderNote(menu, cat) {
    return (
      cat.orderNote ||
      menu.orderNote ||
      "Shown for dine-in and ID-verified service only; pickup and delivery ordering uses food items."
    );
  }

  function isCategoryOrderable(menu, cat) {
    return menu?.orderable !== false && cat?.orderable !== false;
  }

  function renderItem(item, index, options = {}) {
    const canOrder = options.showOrderButton !== false && item.orderable !== false;
    if (window.WSMenuRender?.renderItem) {
      return window.WSMenuRender.renderItem(item, index, {
        showOrderButton: canOrder,
        orderable: canOrder,
        initialVisible: false,
      });
    }
    const price = item.price
      ? `<span class="price">${escapeHtml(item.price)}</span>`
      : "";
    const orderBtn = canOrder
      ? item.toastOrderUrl
        ? `<a href="${escapeHtml(item.toastOrderUrl)}" class="btn btn-outline menu-item-order-btn menu-item-order-link" target="_blank" rel="noopener noreferrer">Order on Toast</a>`
        : `<button type="button" class="btn btn-outline menu-item-order-btn" data-pickup-add data-item-name="${escapeHtml(item.name)}" data-item-price="${escapeHtml(item.price || "")}">Add to order</button>`
      : "";
    let desc = item.desc ? `<p>${escapeHtml(item.desc)}</p>` : "";
    if (item.link) {
      desc = `<p><a href="${escapeHtml(item.link)}">See happy hour →</a></p>`;
    }
    return `
      <article class="menu-item menu-item--animate" style="--item-i: ${index}">
        <div class="menu-item-body">
          <h3>${escapeHtml(item.name)}</h3>
          ${desc}
        </div>
        <div class="menu-item-actions">${price}${orderBtn}</div>
      </article>`;
  }

  function renderCategory(cat, menu) {
    const canOrder = isCategoryOrderable(menu, cat);
    const note = cat.note
      ? `<p class="menu-cat-note">${escapeHtml(cat.note)}</p>`
      : "";
    const orderNote = !canOrder
      ? `<p class="menu-cat-note menu-cat-order-note">${escapeHtml(menuOrderNote(menu, cat))}</p>`
      : "";
    const items = (cat.items || [])
      .map((item, i) => renderItem(item, i, { showOrderButton: canOrder }))
      .join("");
    return `
      <section class="menu-category-block" id="${menu.id}-${cat.id}" data-category="${cat.id}">
        <h2 class="menu-category-title">${escapeHtml(cat.name)}</h2>
        ${note}${orderNote}
        <div class="menu-items">${items}</div>
      </section>`;
  }

  function renderTabs() {
    return data.menus
      .map(
        (m) => `
      <button type="button" class="menu-tab" role="tab"
        aria-selected="${m.id === activeMenu ? "true" : "false"}"
        aria-controls="panel-${m.id}"
        data-menu="${m.id}">
        ${escapeHtml(m.label)}
      </button>`
      )
      .join("");
  }

  function renderSidebar(menu) {
    return menu.categories
      .map(
        (c) => `
      <a href="#${menu.id}-${c.id}" class="menu-cat-link" data-cat="${c.id}">
        ${escapeHtml(c.name)}
      </a>`
      )
      .join("");
  }

  function renderPanel(menu) {
    const isActive = menu.id === activeMenu;
    const categories = menu.categories
      .map((c) => renderCategory(c, menu))
      .join("");
    const image = menu.image
      ? `<div class="menu-panel-media reveal-right visible"><img src="${menu.image}" alt="${escapeHtml(menu.label)}" loading="lazy" /></div>`
      : menu.id === "main-menu"
        ? `<div class="menu-panel-media reveal-right visible"><img src="assets/gallery/WSMenu.webp" alt="Whistle Stop menu" loading="lazy" /></div>`
        : "";

    return `
      <div class="menu-panel ${isActive ? "is-active" : ""}" id="panel-${menu.id}"
        role="tabpanel" data-menu="${menu.id}" ${isActive ? "" : 'hidden'}>
        <div class="menu-panel-grid">
          <div class="menu-panel-content">
            ${menu.intro ? `<p class="menu-panel-intro">${escapeHtml(menu.intro)}</p>` : ""}
            ${categories}
          </div>
          ${image}
        </div>
      </div>`;
  }

  function render() {
    const toolbarSlot = document.getElementById("menu-toolbar-slot");
    const toolbarHtml = `
      <div class="menu-toolbar" id="menu-toolbar">
        <div class="container">
          <nav class="menu-tabs" role="tablist" aria-label="Menu type">
            ${renderTabs()}
          </nav>
        </div>
      </div>`;

    if (toolbarSlot) {
      toolbarSlot.innerHTML = toolbarHtml;
    }

    root.innerHTML = `
      <div class="container menu-layout">
        <aside class="menu-sidebar slide-in-left" id="menu-sidebar" aria-label="Menu categories"></aside>
        <div class="menu-panels" id="menu-panels">
          ${data.menus.map(renderPanel).join("")}
        </div>
      </div>`;

    bindEvents();
    window.WSUI?.refreshScrollReveal?.();
    if (window.WSPickupOrder) {
      window.WSPickupOrder.bindMenu(root);
      window.WSPickupOrder.updateBar();
    }
    updateSidebar();
    animatePanelItems();
    setupPinnedToolbar();
    setupScrollSpy();
  }

  function getMenu(id) {
    return data.menus.find((m) => m.id === id);
  }

  function getMenuScrollOffset() {
    const headerH =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 76;
    const toolbar = document.getElementById("menu-toolbar");
    const toolbarH = toolbar?.getBoundingClientRect().height || 0;
    return headerH + toolbarH + 8;
  }

  function scrollToMenuIntro(panel = document.querySelector(".menu-panel.is-active")) {
    if (!panel) return;
    const anchor = panel.querySelector(".menu-panel-intro") || panel.querySelector(".menu-panel-content");
    if (!anchor) return;

    const top = anchor.getBoundingClientRect().top + window.scrollY - getMenuScrollOffset();
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function updateSidebar() {
    const menu = getMenu(activeMenu);
    const sidebar = document.getElementById("menu-sidebar");
    if (!menu || !sidebar) return;
    sidebar.innerHTML = renderSidebar(menu);
    sidebar.querySelectorAll(".menu-cat-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const id = link.getAttribute("href").slice(1);
        const el = document.getElementById(id);
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - getMenuScrollOffset() - 12;
          window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        }
        sidebar.querySelectorAll(".menu-cat-link").forEach((l) => l.classList.remove("active"));
        link.classList.add("active");
      });
    });
    const first = sidebar.querySelector(".menu-cat-link");
    if (first) first.classList.add("active");
  }

  function switchMenu(menuId, pushHash = true) {
    if (!getMenu(menuId) || menuId === activeMenu) return;
    activeMenu = menuId;

    document.querySelectorAll(".menu-tab").forEach((tab) => {
      const on = tab.dataset.menu === menuId;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.classList.toggle("is-active", on);
    });

    let activePanel = null;
    document.querySelectorAll(".menu-panel").forEach((panel) => {
      const on = panel.dataset.menu === menuId;
      panel.classList.toggle("is-active", on);
      panel.hidden = !on;
      if (on) {
        activePanel = panel;
        panel.classList.remove("panel-entered");
        requestAnimationFrame(() => {
          panel.classList.add("panel-entered");
          animatePanelItems(panel);
        });
      }
    });

    updateSidebar();
    if (pushHash) history.replaceState(null, "", `#${menuId}`);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToMenuIntro(activePanel));
    });
  }

  function animatePanelItems(panel = document.querySelector(".menu-panel.is-active")) {
    if (!panel) return;
    const items = panel.querySelectorAll(".menu-item--animate");
    items.forEach((el, i) => {
      el.classList.remove("visible");
      el.style.setProperty("--item-i", i);
      requestAnimationFrame(() => {
        setTimeout(() => el.classList.add("visible"), 40 + i * 35);
      });
    });
  }

  function bindEvents() {
    document.querySelectorAll(".menu-tab").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.menu === activeMenu);
      tab.addEventListener("click", () => switchMenu(tab.dataset.menu));
    });

    const activePanel = document.querySelector(".menu-panel.is-active");
    if (activePanel) {
      activePanel.classList.add("panel-entered");
    }
  }

  function setupPinnedToolbar() {
    const toolbar = document.getElementById("menu-toolbar");
    const anchor = document.getElementById("menu-toolbar-anchor");
    const spacer = document.getElementById("menu-toolbar-spacer");
    if (!toolbar || !anchor) return;

    const headerH =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 76;

    const syncSpacer = (pinned) => {
      if (!spacer) return;
      spacer.style.height = pinned ? `${toolbar.offsetHeight}px` : "0";
    };

    const setPinned = (pinned) => {
      toolbar.classList.toggle("is-pinned", pinned);
      syncSpacer(pinned);
      document.documentElement.style.setProperty(
        "--menu-toolbar-h",
        `${toolbar.offsetHeight}px`
      );
    };

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        ([entry]) => setPinned(!entry.isIntersecting),
        { root: null, threshold: 0, rootMargin: `-${headerH}px 0px 0px 0px` }
      );
      observer.observe(anchor);
    } else {
      const onScroll = () => {
        const pinned = anchor.getBoundingClientRect().top <= headerH;
        setPinned(pinned);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    window.addEventListener("resize", () => syncSpacer(toolbar.classList.contains("is-pinned")), {
      passive: true,
    });

    document.documentElement.style.setProperty(
      "--menu-toolbar-h",
      `${toolbar.offsetHeight}px`
    );
    setPinned(false);
  }

  function setupScrollSpy() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const id = e.target.dataset.category;
          const link = document.querySelector(`.menu-cat-link[data-cat="${id}"]`);
          document.querySelectorAll(".menu-cat-link").forEach((l) => l.classList.remove("active"));
          link?.classList.add("active");
        });
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 }
    );

    document.querySelectorAll(".menu-category-block").forEach((el) => observer.observe(el));
  }

  function readHash() {
    const hash = (location.hash || "#main-menu").replace("#", "");
    if (getMenu(hash)) {
      pendingCategoryId = null;
      return hash;
    }
    for (const menu of data?.menus || []) {
      for (const cat of menu.categories || []) {
        if (`${menu.id}-${cat.id}` === hash) {
          pendingCategoryId = cat.id;
          return menu.id;
        }
      }
    }
    pendingCategoryId = null;
    return "main-menu";
  }

  function scrollToCategory(catId) {
    if (!catId) return;
    const menu = getMenu(activeMenu);
    const el = document.getElementById(`${menu?.id}-${catId}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - getMenuScrollOffset() - 12;
    window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
    const sidebar = document.getElementById("menu-sidebar");
    sidebar?.querySelectorAll(".menu-cat-link").forEach((l) => {
      l.classList.toggle("active", l.dataset.cat === catId);
    });
  }

  async   function initSidebarReveal() {
    const sidebar = document.getElementById("menu-sidebar");
    if (!sidebar) return;
    requestAnimationFrame(() => sidebar.classList.add("visible"));
  }

  function scrollToHashSection() {
    const hash = (location.hash || "").replace("#", "");
    if (!hash || getMenu(hash)) return;
    for (const menu of data?.menus || []) {
      for (const cat of menu.categories || []) {
        if (`${menu.id}-${cat.id}` !== hash) continue;
        if (menu.id !== activeMenu) switchMenu(menu.id, false);
        requestAnimationFrame(() => scrollToCategory(cat.id));
        return;
      }
    }
  }

  function applyPreviewData(next) {
    data = next;
    activeMenu = readHash();
    render();
    if (pendingCategoryId) {
      const catId = pendingCategoryId;
      pendingCategoryId = null;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToCategory(catId));
      });
    } else if (isMenuPreview) {
      requestAnimationFrame(() => scrollToHashSection());
    } else {
      initSidebarReveal();
      if (location.hash) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => scrollToMenuIntro());
        });
      }
    }
  }

  async function loadMenuData() {
    if (isMenuPreview) {
      const draft = window.WSConfig?.readPreviewSync?.("menus");
      if (draft) return draft;
    }
    return WSConfig.get("menus");
  }

  function bindHashNavigation() {
    window.addEventListener("hashchange", () => {
      const id = readHash();
      if (id !== activeMenu) {
        switchMenu(id, false);
        if (pendingCategoryId) {
          const catId = pendingCategoryId;
          pendingCategoryId = null;
          requestAnimationFrame(() => scrollToCategory(catId));
        }
      } else if (pendingCategoryId) {
        const catId = pendingCategoryId;
        pendingCategoryId = null;
        scrollToCategory(catId);
      } else {
        scrollToHashSection();
      }
    });
  }

  async function initPublic(reloadOnly) {
    try {
      applyPreviewData(await loadMenuData());
      if (!reloadOnly) bindHashNavigation();
    } catch (e) {
      root.innerHTML = "<p class='menu-error'>Menu could not load. Please refresh.</p>";
      console.error(e);
    }
  }

  function onAdminPreview(menus) {
    if (!menus?.menus) return;
    applyPreviewData(menus);
  }

  window.WSMenuPreview = { apply: onAdminPreview };

  function initPreview() {
    window.addEventListener("message", (e) => {
      if (e.data?.type !== "ws-menu-preview" || !e.data.menus) return;
      onAdminPreview(e.data.menus);
    });

    try {
      bindHashNavigation();
      const draft = window.WSConfig?.readPreviewSync?.("menus");
      if (draft) onAdminPreview(draft);
      window.parent.postMessage({ type: "ws-menu-preview-ready" }, "*");
    } catch (e) {
      root.innerHTML = "<p class='menu-error'>Menu could not load. Please refresh.</p>";
      console.error(e);
    }
  }

  if (isMenuPreview) {
    initPreview();
  } else {
    initPublic(false);
    document.addEventListener("ws-config-updated", (e) => {
      const section = e.detail?.section;
      if (section && section !== "menus" && section !== "all") return;
      initPublic(true);
    });
  }
})();
