/* Menu — tab selectors + category sidebar + slide-in animations */
(function () {
  const root = document.getElementById("menu-app");
  if (!root) return;

  let data = null;
  let activeMenu = "main-menu";

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderItem(item, index) {
    const price = item.price
      ? `<span class="price">${escapeHtml(item.price)}</span>`
      : "";
    let desc = item.desc ? `<p>${escapeHtml(item.desc)}</p>` : "";
    if (item.link) {
      desc = `<p><a href="${escapeHtml(item.link)}">See happy hour →</a></p>`;
    }
    return `
      <article class="menu-item menu-item--animate" style="--item-i: ${index}">
        <div class="menu-item-body">
          <h4>${escapeHtml(item.name)}</h4>
          ${desc}
        </div>
        ${price}
      </article>`;
  }

  function renderCategory(cat, menuId) {
    const note = cat.note
      ? `<p class="menu-cat-note">${escapeHtml(cat.note)}</p>`
      : "";
    const items = (cat.items || [])
      .map((item, i) => renderItem(item, i))
      .join("");
    return `
      <section class="menu-category-block" id="${menuId}-${cat.id}" data-category="${cat.id}">
        <h3 class="menu-category-title">${escapeHtml(cat.name)}</h3>
        ${note}
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
      .map((c) => renderCategory(c, menu.id))
      .join("");
    const image = menu.image
      ? `<div class="menu-panel-media reveal-right"><img src="${menu.image}" alt="${escapeHtml(menu.label)}" loading="lazy" /></div>`
      : menu.id === "main-menu"
        ? `<div class="menu-panel-media reveal-right"><img src="assets/gallery/WSMenu.jpg" alt="Whistle Stop menu" loading="lazy" /></div>`
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
    root.innerHTML = `
      <div class="menu-toolbar" id="menu-toolbar">
        <div class="container">
          <nav class="menu-tabs" role="tablist" aria-label="Menu type">
            ${renderTabs()}
          </nav>
        </div>
      </div>
      <div class="container menu-layout">
        <aside class="menu-sidebar slide-in-left" id="menu-sidebar" aria-label="Menu categories"></aside>
        <div class="menu-panels" id="menu-panels">
          ${data.menus.map(renderPanel).join("")}
        </div>
      </div>`;

    bindEvents();
    updateSidebar();
    animatePanelItems();
    setupStickyToolbar();
    setupScrollSpy();
  }

  function getMenu(id) {
    return data.menus.find((m) => m.id === id);
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
          const top = el.getBoundingClientRect().top + window.scrollY - 140;
          window.scrollTo({ top, behavior: "smooth" });
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

    document.querySelectorAll(".menu-panel").forEach((panel) => {
      const on = panel.dataset.menu === menuId;
      panel.classList.toggle("is-active", on);
      panel.hidden = !on;
      if (on) {
        panel.classList.remove("panel-entered");
        requestAnimationFrame(() => {
          panel.classList.add("panel-entered");
          animatePanelItems(panel);
        });
      }
    });

    updateSidebar();
    if (pushHash) history.replaceState(null, "", `#${menuId}`);
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

  function setupStickyToolbar() {
    const toolbar = document.getElementById("menu-toolbar");
    if (!toolbar) return;
    const onScroll = () => {
      toolbar.classList.toggle("is-stuck", toolbar.getBoundingClientRect().top <= 76);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
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
    if (getMenu(hash)) return hash;
    return "main-menu";
  }

  async   function initSidebarReveal() {
    const sidebar = document.getElementById("menu-sidebar");
    if (!sidebar) return;
    requestAnimationFrame(() => sidebar.classList.add("visible"));
  }

  async function init() {
    try {
      const res = await fetch("data/menus.json");
      data = await res.json();
      activeMenu = readHash();
      render();
      initSidebarReveal();
      window.addEventListener("hashchange", () => {
        const id = readHash();
        if (id !== activeMenu) switchMenu(id, false);
      });
    } catch (e) {
      root.innerHTML = "<p class='menu-error'>Menu could not load. Please refresh.</p>";
      console.error(e);
    }
  }

  init();
})();
