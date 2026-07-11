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

  /* Operational tabs save real content. Mock tabs are preview-only modules. */
  const NAV_SECTIONS = [
    {
      title: "Website",
      tabs: [
        { id: "events", label: "Events", hint: "Calendar, music & promos" },
        { id: "menus", label: "Menus", hint: "Legacy editor · Toast sync coming" },
        { id: "pages", label: "Other pages", hint: "Home, order, visit & more" },
      ],
    },
    {
      title: "Marketing",
      tabs: [
        { id: "social", label: "Social Poster", hint: "Cross-post incl. GBP" },
        { id: "gbp", label: "Google Business Profile", hint: "Event dates & queue", mock: true },
        { id: "reviews-mgr", label: "Review Manager", hint: "Ratings & replies", mock: true },
        {
          id: "campaign-calendar",
          label: "Campaign Calendar",
          hint: "Interest checks + outreach CRM",
        },
        { id: "qr-codes", label: "QR Codes", hint: "Trackable print codes" },
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
  const DRAFT_MANAGER_TABS = new Set(["events", "menus", "pages"]);

  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

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
        "<strong>Unsaved draft changes.</strong> The draft preview updates while you work; click <em>Save changes</em> to keep this version on this device.";
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
          "[data-remove-perf], [data-remove-item], [data-remove-promo], [data-remove-gallery], [data-remove-sig], [data-remove-faq], [data-edit-promo], [data-promo-editor-save], #add-perf, #add-menu-item, #add-promo, #add-homepage-promo, #add-gallery, #add-sig, #add-faq"
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
          <p>Update events, pages, campaigns, and social — no code required. Live URL: <code>…/Whistle-Stop/admin.html</code></p>
          <form id="admin-login-form">
            <div class="admin-field">
              <label>Username</label>
              <input type="text" name="username" required autocomplete="username" placeholder="owner, editor, or staff" />
            </div>
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
      const username = e.target.username.value;
      const password = e.target.password.value;
      const ok = await WSConfig.login(username, password);
      if (!ok) {
        const err = $("#login-error");
        err.textContent = "Incorrect username or password.";
        err.style.display = "block";
        return;
      }
      initApp();
    });
  }

  async function initApp() {
    await loadAll();
    const user = WSConfig.getSessionUser?.() || { username: "staff", role: "staff", displayName: "Staff" };
    document.body.className = "admin-body";
    document.body.innerHTML = `
      <div class="admin-shell is-active">
        <aside class="admin-sidebar">
          <div class="admin-sidebar-brand">
            <strong>Whistle Stop</strong>
            <span>Staff portal · ${escHtml(user.displayName || user.username)} (${escHtml(user.role)})</span>
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

    document.addEventListener("ws-social-host-needed", () => {
      if (window.WSSocial?.checkHostAndPrompt) {
        /* modal is shown from Social tab; toast here for post-login awareness */
        toast("Social Host offline — Graph posts still work. Open Social Poster for host download.");
      }
    });

    await renderTab();
    try {
      await window.WSSocial?.checkHostAndPrompt?.();
    } catch (_) {}
  }

  window.addEventListener("ws-admin-switch-tab", (e) => {
    if (e.detail?.tab) switchTab(e.detail.tab);
  });

  const PREVIEW_SECTIONS = {
    events: "events",
    menus: "menus",
    promos: "promos",
    heroes: "site",
  };

  async function switchTab(id) {
    if (state.tab && state.tab !== id) {
      if (state.tab === "campaign-calendar") {
        window.WSAdminCampaigns?.destroy();
      }
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
    const isCampaignTab = state.tab === "campaign-calendar";
    const isWideTab = ["heroes", "events", "menus", "pages", "social", "qr-codes", "campaign-calendar"].includes(state.tab) || isMockTab;
    main.classList.toggle("admin-main--wide", isWideTab);
    main.classList.toggle("admin-main--draft-manager", DRAFT_MANAGER_TABS.has(state.tab));
    main.innerHTML = `
      <div class="admin-topbar">
        <h2>${tab.label}</h2>
        <div class="admin-actions">
          ${
            isSocialTab
              ? `<span class="admin-social-top-hint">Posts publish via the local bridge — no save button needed.</span>`
              : isCampaignTab
                ? `<span class="admin-social-top-hint">Interest-check signups + outreach CRM — syncs via knightlogics.com API when live.</span>`
                : isMockTab
                ? `<span class="admin-social-top-hint">Preview module — not connected to live data yet.</span>`
                : `<span class="admin-draft-state">Draft preview mode</span><button type="button" class="btn btn-outline" id="admin-save-tab">Save draft</button>${
                    WSConfig.canPublish?.()
                      ? `<button type="button" class="btn btn-primary" id="admin-publish-live">Publish live</button>`
                      : `<span class="admin-social-top-hint">Publish live requires owner/editor role</span>`
                  }`
          }
        </div>
      </div>
      <div id="admin-panel"></div>`;

    const panel = $("#admin-panel");
    const g = GUI();

    try {
      switch (state.tab) {
        case "events":
          WSConfig.invalidateCache("events");
          WSConfig.invalidateCache("promos");
          state.events = await WSConfig.get("events");
          state.promos = await WSConfig.get("promos");
          g.renderEvents(panel, state.events, state.images, state.promos, state.site);
          break;
        case "menus":
          WSConfig.invalidateCache("menus");
          state.menus = await WSConfig.get("menus");
          g.renderMenus(panel, state.menus, state.images);
          break;
        case "pages":
          g.renderPages(panel, state.site, state.images, state.promos);
          break;
        case "social":
          g.renderSocial(panel, state.socialManager, state.site);
          break;
        case "gbp":
          window.WSAdminMockups?.renderGbp(panel);
          break;
        case "reviews-mgr":
          window.WSAdminMockups?.renderReviews(panel);
          break;
        case "campaign-calendar":
          await window.WSAdminCampaigns?.render(panel);
          break;
        case "qr-codes":
          if (!state.events) {
            WSConfig.invalidateCache("events");
            state.events = await WSConfig.get("events");
          }
          window.WSAdminQRCodes?.render(panel, { events: state.events });
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
      $("#admin-publish-live")?.addEventListener("click", () => openPublishLiveModal(state.tab));
    }
  }

  function openPublishLiveModal(tab) {
    if (!WSConfig.canPublish?.()) {
      toast("Your role cannot publish live. Sign in as owner or editor.");
      return;
    }
    const g = GUI();
    if (!g?.openAdminModal) {
      toast("Publish UI failed to load. Hard refresh and try again.");
      return;
    }

    g.openAdminModal({
      title: "Publish live to website",
      subtitle: "Updates the public GitHub Pages site for all visitors. Requires admin password.",
      bodyHtml: `
        <p class="admin-note" style="margin-top:0">This sends your current draft content (events, menus, promos, homepage, heroes) to the secure Knight Logics publish bridge. GitHub Pages usually updates within 1–3 minutes.</p>
        <div class="admin-field">
          <label for="admin-publish-password">Admin password</label>
          <input type="password" id="admin-publish-password" autocomplete="current-password" placeholder="Same password used to sign in" />
        </div>
        <p id="admin-publish-status" class="admin-publish-status" hidden></p>`,
      footerHtml: `
        <button type="button" class="btn btn-outline admin-btn-sm" data-admin-modal-close>Cancel</button>
        <button type="button" class="btn btn-primary admin-btn-sm" id="admin-publish-confirm">Publish live</button>`,
      onMount: (root) => {
        const passwordInput = root.querySelector("#admin-publish-password");
        const statusEl = root.querySelector("#admin-publish-status");
        const confirmBtn = root.querySelector("#admin-publish-confirm");
        const saved = WSConfig.getSessionPassword?.();
        if (saved && passwordInput) passwordInput.value = saved;

        confirmBtn?.addEventListener("click", async () => {
          const password = (passwordInput?.value || "").trim();
          if (!password) {
            toast("Enter the admin password to publish live.");
            passwordInput?.focus();
            return;
          }

          confirmBtn.disabled = true;
          confirmBtn.textContent = "Publishing…";
          if (statusEl) {
            statusEl.hidden = false;
            statusEl.textContent = "Saving draft and sending to publish bridge…";
          }

          try {
            await saveTab(tab, { quiet: true });
            const result = await WSConfig.publishContent({ adminPassword: password, sourceTab: tab });
            if (statusEl) {
              statusEl.textContent = "Published to GitHub. Waiting for the live site to refresh…";
            }
            toast("Publish sent. Waiting for GitHub Pages…");
            const live = await WSConfig.waitForPublishLive(result.versionId, { attempts: 24, intervalMs: 5000 });
            await WSConfig.finalizeLocalAfterPublish();
            await loadAll();
            g.closeAdminModal();
            await renderTab();
            if (live.live) {
              toast("Live site updated successfully.");
            } else {
              toast("Publish completed. Live site may still be refreshing — check again in a minute.");
            }
          } catch (err) {
            if (statusEl) statusEl.textContent = err.message || "Publish failed.";
            toast(err.message || "Publish failed.");
            confirmBtn.disabled = false;
            confirmBtn.textContent = "Publish live";
          }
        });
      },
    });
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
          if (panel._getPromos) {
            state.promos = panel._getPromos(state.promos);
            WSConfig.save("promos", state.promos);
          }
          if (panel._collectEventsSite) {
            state.site = panel._collectEventsSite(state.site);
            WSConfig.save("site", state.site);
          }
          break;
        case "menus":
          state.menus = panel._getMenus ? panel._getMenus() : g.collectMenus(panel, state.menus);
          WSConfig.save("menus", state.menus);
          break;
        case "pages":
          if (panel._collectPagesDraft) {
            const draft = panel._collectPagesDraft({ site: state.site, promos: state.promos });
            state.site = draft.site;
            state.promos = draft.promos;
            WSConfig.save("site", state.site);
            WSConfig.save("promos", state.promos);
          }
          break;
        case "social":
          return true;
        default:
          return false;
      }
      panel._refreshPagePreview?.();
      panel._clearUnsaved?.();
      if (!opts.quiet) {
        toast("Draft saved on this device. Use Publish live when ready for everyone to see it.");
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
