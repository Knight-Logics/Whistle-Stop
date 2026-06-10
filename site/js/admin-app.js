/* Whistle Stop — staff admin (content updates only) */
(function () {
  const GUI = () => window.WSAdminGUI;

  const state = {
    tab: "events",
    site: null,
    events: null,
    menus: null,
    reviews: null,
    promos: null,
    images: null,
    socialManager: null,
  };

  /* Operational tabs — unchanged behavior. Mock tabs are preview-only GUIs. */
  const NAV_SECTIONS = [
    {
      title: "Website Manager",
      tabs: [
        { id: "events", label: "Events", hint: "Guest-facing dates & times" },
        { id: "menus", label: "Menus", hint: "Food & drink menus" },
        { id: "promos", label: "Events Promos", hint: "Photo cards on the site" },
        { id: "homepage", label: "Homepage", hint: "Homepage content" },
        { id: "heroes", label: "Hero Images", hint: "Top banner photos" },
      ],
    },
    {
      title: "Marketing Manager",
      tabs: [
        { id: "social", label: "Social Poster", hint: "Cross-post incl. GBP" },
        { id: "gbp", label: "Google Business Profile", hint: "Event dates & queue", mock: true },
        { id: "reviews-mgr", label: "Review Manager", hint: "Ratings & replies", mock: true },
        {
          id: "campaign-calendar",
          label: "Campaign Calendar",
          hint: "When to promote what (staff only)",
          mock: true,
        },
        { id: "qr-codes", label: "QR Codes", hint: "Trackable print codes", mock: true },
      ],
    },
    {
      title: "Revenue Tools",
      tabs: [
        { id: "ordering-hub", label: "Ordering Hub", mock: true },
        { id: "private-events", label: "Private Events", mock: true },
      ],
    },
    {
      title: "Reports",
      tabs: [{ id: "reports", label: "Reports", hint: "Weekly snapshot · not full GA4", mock: true }],
    },
    {
      title: "Coming soon",
      tabs: [
        { id: "integrations", label: "Integrations", mock: true },
        { id: "vip-club", label: "VIP Club", mock: true },
        { id: "86-board", label: "86 Board", mock: true },
      ],
    },
  ];

  const TABS = NAV_SECTIONS.flatMap((s) => s.tabs);
  const MOCK_TABS = new Set(TABS.filter((t) => t.mock).map((t) => t.id));

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function wireUnsavedBanner(panel) {
    const note = panel.querySelector(".admin-note");
    if (!note) return;

    let banner = panel.querySelector("#admin-unsaved-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "admin-unsaved-banner";
      banner.className = "admin-unsaved-banner";
      banner.hidden = true;
      banner.setAttribute("role", "status");
      banner.innerHTML =
        "<strong>Changes are currently not saved.</strong> Click <em>Save changes</em> at the top to publish your updates.";
      note.insertAdjacentElement("afterend", banner);
    } else {
      banner.hidden = true;
    }

    const markUnsaved = () => {
      banner.hidden = false;
    };

    panel._markUnsaved = markUnsaved;
    panel._clearUnsaved = () => {
      banner.hidden = true;
    };

    if (panel.dataset.unsavedBound) return;
    panel.dataset.unsavedBound = "1";

    panel.addEventListener("input", (e) => {
      if (e.target.matches("[data-field]")) markUnsaved();
    });
    panel.addEventListener("change", (e) => {
      if (e.target.matches("[data-field], select")) markUnsaved();
    });
    panel.addEventListener("click", (e) => {
      if (
        e.target.closest(
          "[data-remove-perf], [data-remove-item], [data-remove-promo], [data-remove-gallery], [data-remove-sig], [data-remove-faq], #add-perf, #add-menu-item, #add-promo, #add-homepage-promo, #add-gallery, #add-sig, #add-faq"
        ) ||
        e.target.closest(".admin-img-option") ||
        e.target.closest("[data-media-dropzone]") ||
        e.target.closest(".admin-media-upload-btn")
      ) {
        markUnsaved();
      }
    });
  }

  function toast(msg) {
    let el = $("#admin-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "admin-toast";
      el.className = "admin-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-visible");
    setTimeout(() => el.classList.remove("is-visible"), 2800);
  }

  async function loadAll() {
    WSConfig.invalidateCache();
    const [site, events, menus, reviews, promos, images, socialManager] = await Promise.all([
      WSConfig.get("site"),
      WSConfig.get("events"),
      WSConfig.get("menus"),
      WSConfig.get("reviews"),
      WSConfig.get("promos"),
      WSConfig.get("images"),
      WSConfig.get("socialManager"),
    ]);
    state.site = site;
    state.events = events;
    state.menus = menus;
    state.reviews = reviews;
    state.promos = promos;
    state.images = images;
    state.socialManager = socialManager;
  }

  function renderLogin() {
    document.body.className = "admin-body";
    document.body.innerHTML = `
      <div class="admin-login">
        <div class="admin-login-card">
          <h1>Staff Portal</h1>
          <p>Update the event calendar, menus, promo cards, and hero photos — no code required.</p>
          <form id="admin-login-form">
            <div class="admin-field">
              <label>Password</label>
              <input type="password" name="password" required autocomplete="current-password" />
            </div>
            <p id="login-error" style="color:var(--rust);font-size:0.9rem;display:none;margin:0.5rem 0 0"></p>
            <button type="submit" class="btn btn-primary" style="width:100%;margin-top:1rem">Sign in</button>
          </form>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-top:1.25rem;text-align:center">
            <a href="index.html">← Back to website</a>
          </p>
        </div>
      </div>`;

    $("#admin-login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const ok = await WSConfig.login(e.target.password.value);
      if (!ok) {
        const err = $("#login-error");
        err.textContent = "Incorrect password.";
        err.style.display = "block";
        return;
      }
      initApp();
    });
  }

  async function initApp() {
    await loadAll();
    document.body.className = "admin-body";
    document.body.innerHTML = `
      <div class="admin-shell is-active">
        <aside class="admin-sidebar">
          <div class="admin-sidebar-brand">
            <strong>Whistle Stop</strong>
            <span>Staff updates</span>
          </div>
          <nav class="admin-nav" id="admin-nav"></nav>
          <div style="padding:1rem 1.25rem 0">
            <a href="index.html" class="btn btn-outline" style="width:100%;font-size:0.85rem" target="_blank">View website ↗</a>
            <button type="button" class="btn btn-outline" id="admin-logout" style="width:100%;margin-top:0.5rem;font-size:0.85rem">Sign out</button>
          </div>
        </aside>
        <main class="admin-main" id="admin-main"></main>
      </div>`;

    const nav = $("#admin-nav");
    NAV_SECTIONS.forEach((section) => {
      const head = document.createElement("div");
      head.className = "admin-nav-section-title";
      head.textContent = section.title;
      nav.appendChild(head);
      section.tabs.forEach((t) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.tab = t.id;
        if (t.mock) btn.dataset.mock = "1";
        if (t.hint) btn.title = t.hint;
        btn.innerHTML = t.hint
          ? `<span class="admin-nav-label">${t.label}</span><span class="admin-nav-hint">${t.hint}</span>`
          : `<span class="admin-nav-label">${t.label}</span>`;
        if (t.id === state.tab) btn.classList.add("is-active");
        btn.addEventListener("click", () => switchTab(t.id));
        nav.appendChild(btn);
      });
    });

    $("#admin-logout").addEventListener("click", () => {
      WSConfig.logout();
      renderLogin();
    });

    await renderTab();
  }

  const PREVIEW_SECTIONS = {
    events: "events",
    menus: "menus",
    promos: "promos",
    heroes: "site",
  };

  async function switchTab(id) {
    if (state.tab && state.tab !== id) {
      const section = PREVIEW_SECTIONS[state.tab];
      if (section) WSConfig.clearPreview(section);
      if (state.tab === "homepage") WSConfig.clearPreview("promos");
    }
    state.tab = id;
    $("#admin-nav").querySelectorAll("button").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.tab === id);
    });
    await renderTab();
  }

  async function renderTab() {
    const tab = TABS.find((t) => t.id === state.tab);
    const main = $("#admin-main");
    const isMockTab = MOCK_TABS.has(state.tab);
    const isSocialTab = state.tab === "social";
    const isWideTab = ["heroes", "events", "menus", "promos", "homepage", "social"].includes(state.tab) || isMockTab;
    main.classList.toggle("admin-main--wide", isWideTab);
    main.innerHTML = `
      <div class="admin-topbar">
        <h2>${tab.label}</h2>
        <div class="admin-actions">
          ${
            isSocialTab
              ? `<span class="admin-social-top-hint">Posts publish via the local bridge — no save button needed.</span>`
              : isMockTab
                ? `<span class="admin-social-top-hint">Preview module — not connected to live data yet.</span>`
                : `<button type="button" class="btn btn-primary" id="admin-save-tab">Save changes</button>`
          }
        </div>
      </div>
      <div id="admin-panel"></div>`;

    const panel = $("#admin-panel");
    const g = GUI();

    try {
      switch (state.tab) {
        case "events":
          g.renderEvents(panel, state.events, state.images);
          break;
        case "menus":
          WSConfig.invalidateCache("menus");
          state.menus = await WSConfig.get("menus");
          g.renderMenus(panel, state.menus);
          break;
        case "promos":
          g.renderPromos(panel, state.promos || { homepageFeatured: [], eventsPageFeatured: [] }, state.images);
          break;
        case "homepage":
          g.renderHomepage(panel, state.site, state.images, state.promos);
          break;
        case "social":
          g.renderSocial(panel, state.socialManager, state.site);
          break;
        case "heroes":
          g.renderHeroes(panel, state.site, state.images);
          break;
        case "gbp":
          window.WSAdminMockups?.renderGbp(panel);
          break;
        case "reviews-mgr":
          window.WSAdminMockups?.renderReviews(panel);
          break;
        case "campaign-calendar":
          window.WSAdminMockups?.renderCampaignCalendar(panel);
          break;
        case "qr-codes":
          window.WSAdminMockups?.renderQrCodes(panel);
          break;
        case "ordering-hub":
          window.WSAdminMockups?.renderOrderingHub(panel);
          break;
        case "private-events":
          window.WSAdminMockups?.renderPrivateEvents(panel);
          break;
        case "reports":
          window.WSAdminMockups?.renderReports(panel);
          break;
        case "integrations":
          window.WSAdminMockups?.renderIntegrations(panel);
          break;
        case "vip-club":
          window.WSAdminMockups?.renderVipClub(panel);
          break;
        case "86-board":
          window.WSAdminMockups?.render86Board(panel);
          break;
        default:
          break;
      }
    } catch (err) {
      panel.innerHTML = `<p class="admin-note" style="border-color:var(--rust)">Could not load this section: ${err.message}. Try a hard refresh (Ctrl+Shift+R).</p>`;
      console.error(err);
    }

    if (!isSocialTab && !isMockTab) {
      wireUnsavedBanner(panel);
      $("#admin-save-tab")?.addEventListener("click", () => saveTab(state.tab));
    }
  }

  async function saveTab(tab, opts = {}) {
    const panel = $("#admin-panel");
    if (!panel) return false;
    const g = GUI();

    try {
      switch (tab) {
        case "events":
          state.events = g.collectEvents(panel, state.events);
          WSConfig.save("events", state.events);
          break;
        case "menus":
          state.menus = panel._getMenus ? panel._getMenus() : g.collectMenus(panel, state.menus);
          WSConfig.save("menus", state.menus);
          break;
        case "promos":
          state.promos = g.collectPromos(panel, state.promos);
          WSConfig.save("promos", state.promos);
          break;
        case "homepage":
          state.site = g.collectHomepage(panel, state.site);
          WSConfig.save("site", state.site);
          if (panel._getHomepagePromos) {
            state.promos = panel._getHomepagePromos(state.promos);
            WSConfig.save("promos", state.promos);
          }
          break;
        case "heroes":
          state.site = panel._collectHeroes
            ? panel._collectHeroes(state.site)
            : g.collectHeroes(panel, state.site);
          WSConfig.save("site", state.site);
          break;
        case "social":
          return true;
        default:
          return false;
      }
      panel._refreshPagePreview?.();
      panel._clearUnsaved?.();
      if (!opts.quiet) {
        toast("Saved! Your changes are live on the website — refresh or open the site to view.");
      }
      return true;
    } catch (e) {
      if (!opts.quiet) toast("Save failed: " + e.message);
      return false;
    }
  }

  async function start() {
    if (WSConfig.isAuthed()) await initApp();
    else renderLogin();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
