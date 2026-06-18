/* Order list + Toast online ordering handoff (Toast does not sync external carts) */
window.WSPickupOrder = (function () {
  const STORAGE_KEY = "ws-pickup-order";
  const DEFAULT_CHECKOUT_URL = "https://www.whistlestopgrill.com/online-ordering";
  const DEFAULT_PARTNERS = {
    uberEats: "https://www.ubereats.com/store/whistle-stop-grill-%26-bar/zy-ne-DhQW-IryRjRNjCIg",
    doorDash: "https://www.doordash.com/search?query=Whistle+Stop+Grill+Safety+Harbor",
    grubhub: "https://www.grubhub.com/search?searchQuery=whistle+stop+grill+safety+harbor",
  };
  let resolvedOrderUrl = null;
  let deliveryLinks = { ...DEFAULT_PARTNERS };
  const DEFAULT_TAX_RATE = 0.07;
  let taxRate = DEFAULT_TAX_RATE;
  let taxNote = "Final total is calculated at Toast checkout (tax + any fees).";

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parsePrice(priceStr) {
    const s = String(priceStr || "").trim();
    if (!s || /^mp$/i.test(s)) return null;
    const match = s.match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
    return match ? parseFloat(match[1]) : null;
  }

  function formatMoney(amount) {
    return `$${amount.toFixed(2)}`;
  }

  function computeTotals(items) {
    let subtotal = 0;
    let unpricedCount = 0;
    items.forEach((item) => {
      const value = parsePrice(item.price);
      if (value != null) subtotal += value;
      else unpricedCount += 1;
    });
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    return { subtotal, tax, total, unpricedCount, taxRate };
  }

  function readItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("ws-pickup-order-change", { detail: { count: items.length } }));
  }

  function getCheckoutUrl() {
    if (resolvedOrderUrl) return resolvedOrderUrl;
    return DEFAULT_CHECKOUT_URL;
  }

  async function loadSiteOrderingConfig() {
    try {
      if (window.WSConfig?.get) {
        const site = await window.WSConfig.get("site");
        if (site.ordering?.estimatedTaxRate != null) {
          taxRate = Number(site.ordering.estimatedTaxRate) || DEFAULT_TAX_RATE;
        }
        if (site.ordering?.taxNote) taxNote = site.ordering.taxNote;
        resolvedOrderUrl =
          site.links?.toastCheckout || site.links?.orderOnline || DEFAULT_CHECKOUT_URL;
        if (resolvedOrderUrl === "menu.html" || resolvedOrderUrl.endsWith("/menu.html")) {
          resolvedOrderUrl = DEFAULT_CHECKOUT_URL;
        }
        if (site.links?.uberEats) deliveryLinks.uberEats = site.links.uberEats;
        if (site.links?.doorDash) deliveryLinks.doorDash = site.links.doorDash;
        if (site.links?.grubhub) deliveryLinks.grubhub = site.links.grubhub;
        return resolvedOrderUrl;
      }
    } catch {
      /* fall through */
    }
    resolvedOrderUrl = getCheckoutUrl();
    return resolvedOrderUrl;
  }

  function addItem(name, price) {
    const trimmed = String(name || "").trim();
    if (!trimmed) return false;
    const items = readItems();
    items.push({ name: trimmed, price: String(price || "").trim() });
    writeItems(items);
    return true;
  }

  function getCount() {
    return readItems().length;
  }

  function renderTotalsSummary(items, { compact = false } = {}) {
    const totals = computeTotals(items);
    const count = items.length;
    const countLabel = count === 1 ? "1 item" : `${count} items`;

    if (totals.subtotal <= 0 && totals.unpricedCount > 0) {
      return {
        html: `<p class="pickup-order-totals${compact ? " pickup-order-totals--compact" : ""}"><strong>${countLabel}</strong> · prices vary (MP items)</p>`,
        totals,
        countLabel,
      };
    }

    if (totals.subtotal <= 0) {
      return {
        html: `<p class="pickup-order-totals${compact ? " pickup-order-totals--compact" : ""}"><strong>${countLabel}</strong></p>`,
        totals,
        countLabel,
      };
    }

    const taxPct = Math.round(totals.taxRate * 100);
    const mpNote =
      totals.unpricedCount > 0
        ? ` <span class="pickup-order-totals-note">+ ${totals.unpricedCount} item${totals.unpricedCount === 1 ? "" : "s"} not priced</span>`
        : "";

    if (compact) {
      return {
        html: `
          <p class="pickup-order-totals pickup-order-totals--compact">
            <strong>${countLabel}</strong> · Est. ${formatMoney(totals.total)}
            <span class="pickup-order-totals-note">(${formatMoney(totals.subtotal)} + ~${taxPct}% tax)</span>${mpNote}
          </p>`,
        totals,
        countLabel,
      };
    }

    return {
      html: `
        <div class="pickup-order-totals">
          <div class="pickup-order-totals-row"><span>Subtotal (${countLabel})</span><span>${formatMoney(totals.subtotal)}</span></div>
          <div class="pickup-order-totals-row"><span>Est. tax (~${taxPct}%)</span><span>${formatMoney(totals.tax)}</span></div>
          <div class="pickup-order-totals-row pickup-order-totals-row--total"><span>Est. total</span><strong>${formatMoney(totals.total)}</strong></div>
          ${mpNote ? `<p class="pickup-order-totals-footnote">${totals.unpricedCount} market-price item${totals.unpricedCount === 1 ? "" : "s"} not included in estimate.</p>` : ""}
          <p class="pickup-order-totals-footnote">${escapeHtml(taxNote)}</p>
        </div>`,
      totals,
      countLabel,
    };
  }

  function showToast(message) {
    let toast = document.getElementById("pickup-order-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "pickup-order-toast";
      toast.className = "pickup-order-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function renderItemReferenceList(items) {
    if (!items.length) return "";
    const lines = items.map((item) => `<li>${escapeHtml(item.name)}</li>`).join("");
    return `<ul class="fulfillment-item-list">${lines}</ul>`;
  }

  function showFulfillmentStep(modal, step) {
    modal.querySelector("#fulfillment-step-choose")?.toggleAttribute("hidden", step !== "choose");
    modal.querySelector("#fulfillment-step-pickup")?.toggleAttribute("hidden", step !== "pickup");
    modal.querySelector("#fulfillment-step-delivery")?.toggleAttribute("hidden", step !== "delivery");
    modal.dataset.fulfillmentStep = step;
  }

  function ensureFulfillmentModal() {
    let modal = document.getElementById("ws-fulfillment-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "ws-fulfillment-modal";
    modal.className = "toast-handoff-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="toast-handoff-backdrop" data-fulfillment-close></div>
      <div class="toast-handoff-dialog" role="dialog" aria-modal="true" aria-labelledby="fulfillment-title">
        <button type="button" class="toast-handoff-close" data-fulfillment-close aria-label="Close">&times;</button>
        <div id="fulfillment-step-choose" class="fulfillment-step">
          <h2 id="fulfillment-title">Pickup or delivery?</h2>
          <p>Build your food list from the menu first, then choose pickup or delivery. Bar drinks stay informational here because alcohol requires ID-verified service through approved checkout or staff.</p>
          <div id="fulfillment-totals"></div>
          <div class="fulfillment-choices">
            <button type="button" class="fulfillment-choice" data-fulfillment-pick>
              <span class="fulfillment-choice__title">Pickup</span>
              <span class="fulfillment-choice__desc">Pay online &amp; pick up at 915 Main Street (~30 min)</span>
            </button>
            <button type="button" class="fulfillment-choice" data-fulfillment-deliver>
              <span class="fulfillment-choice__title">Delivery</span>
              <span class="fulfillment-choice__desc">Uber Eats, DoorDash, or Grubhub brings it to you</span>
            </button>
          </div>
        </div>
        <div id="fulfillment-step-pickup" class="fulfillment-step" hidden>
          <button type="button" class="fulfillment-back" data-fulfillment-back>← Back</button>
          <h2>Pickup checkout</h2>
          <p>Re-add your items on Whistle Stop&rsquo;s online ordering page, pay, and choose a pickup time. Your list below is a helper — carts don&rsquo;t sync automatically.</p>
          <div id="fulfillment-pickup-totals"></div>
          <div id="fulfillment-pickup-items"></div>
          <ol class="toast-handoff-steps">
            <li>Open online ordering</li>
            <li>Re-add items, pay, and pick up at 915 Main Street</li>
          </ol>
          <p class="toast-handoff-note">Whistle Stop does not deliver in-house — pickup is the direct restaurant order.</p>
          <div class="toast-handoff-actions">
            <a href="${escapeHtml(DEFAULT_CHECKOUT_URL)}" class="btn btn-primary" id="fulfillment-pickup-open" target="_blank" rel="noopener noreferrer">Open pickup ordering</a>
          </div>
        </div>
        <div id="fulfillment-step-delivery" class="fulfillment-step" hidden>
          <button type="button" class="fulfillment-back" data-fulfillment-back>← Back</button>
          <h2>Choose a delivery partner</h2>
          <p>Whistle Stop partners with these apps. Menus, fees, delivery zones, and any age-restricted items are controlled by each platform.</p>
          <div id="fulfillment-delivery-items"></div>
          <div class="fulfillment-partners">
            <a class="fulfillment-partner" id="fulfillment-uber" target="_blank" rel="noopener noreferrer" href="${escapeHtml(DEFAULT_PARTNERS.uberEats)}">
              <strong>Uber Eats</strong><span>Order delivery →</span>
            </a>
            <a class="fulfillment-partner" id="fulfillment-doordash" target="_blank" rel="noopener noreferrer" href="${escapeHtml(DEFAULT_PARTNERS.doorDash)}">
              <strong>DoorDash</strong><span>Order delivery →</span>
            </a>
            <a class="fulfillment-partner" id="fulfillment-grubhub" target="_blank" rel="noopener noreferrer" href="${escapeHtml(DEFAULT_PARTNERS.grubhub)}">
              <strong>Grubhub</strong><span>Order delivery →</span>
            </a>
          </div>
          <p class="toast-handoff-note">Third-party apps add service and delivery fees. Pickup is often fastest on busy nights.</p>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelectorAll("[data-fulfillment-close]").forEach((el) => {
      el.addEventListener("click", () => closeFulfillmentModal());
    });
    modal.querySelectorAll("[data-fulfillment-back]").forEach((el) => {
      el.addEventListener("click", () => showFulfillmentStep(modal, "choose"));
    });
    modal.querySelector("[data-fulfillment-pick]")?.addEventListener("click", () => showFulfillmentStep(modal, "pickup"));
    modal.querySelector("[data-fulfillment-deliver]")?.addEventListener("click", () => showFulfillmentStep(modal, "delivery"));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) closeFulfillmentModal();
    });

    return modal;
  }

  function updateFulfillmentModalContent(modal) {
    const items = readItems();
    const { html } = renderTotalsSummary(items, { compact: false });
    modal.querySelector("#fulfillment-totals")?.replaceChildren();
    const totalsSlot = modal.querySelector("#fulfillment-totals");
    if (totalsSlot) totalsSlot.innerHTML = html;
    const pickupTotals = modal.querySelector("#fulfillment-pickup-totals");
    if (pickupTotals) pickupTotals.innerHTML = html;
    const itemHtml = renderItemReferenceList(items);
    modal.querySelector("#fulfillment-pickup-items")?.replaceChildren();
    const pickupItems = modal.querySelector("#fulfillment-pickup-items");
    if (pickupItems && itemHtml) pickupItems.innerHTML = itemHtml;
    const deliveryItems = modal.querySelector("#fulfillment-delivery-items");
    if (deliveryItems && itemHtml) deliveryItems.innerHTML = itemHtml;
  }

  async function openFulfillmentModal() {
    await loadSiteOrderingConfig();
    const modal = ensureFulfillmentModal();
    const pickupBtn = modal.querySelector("#fulfillment-pickup-open");
    if (pickupBtn) pickupBtn.setAttribute("href", getCheckoutUrl());
    modal.querySelector("#fulfillment-uber")?.setAttribute("href", deliveryLinks.uberEats);
    modal.querySelector("#fulfillment-doordash")?.setAttribute("href", deliveryLinks.doorDash);
    modal.querySelector("#fulfillment-grubhub")?.setAttribute("href", deliveryLinks.grubhub);
    updateFulfillmentModalContent(modal);
    showFulfillmentStep(modal, "choose");
    modal.hidden = false;
    document.body.classList.add("toast-handoff-open");
    modal.querySelector(".fulfillment-choice")?.focus();
  }

  function closeFulfillmentModal() {
    const modal = document.getElementById("ws-fulfillment-modal");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("toast-handoff-open");
  }

  function bindFulfillmentCheckout(el) {
    if (!el || el.dataset.fulfillmentBound === "1") return;
    el.dataset.fulfillmentBound = "1";
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!readItems().length) {
        window.location.href = "menu.html";
        return;
      }
      openFulfillmentModal();
    });
  }

  function setHeaderOrderPanelOpen(wrap, open) {
    if (!wrap || !wrap.classList.contains("ws-header-order-wrap--active")) return;
    wrap.classList.toggle("is-open", open);
    const link = wrap.querySelector(".ws-header-order");
    link?.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function bindHeaderOrderPanel() {
    document.querySelectorAll(".ws-header-order-wrap").forEach((wrap) => {
      if (wrap.dataset.headerPanelBound === "1") return;
      wrap.dataset.headerPanelBound = "1";

      let closeTimer = null;
      const trigger = wrap.querySelector(".ws-header-order");
      const panel = wrap.querySelector(".ws-header-order-preview");

      function openPanel() {
        if (!readItems().length) return;
        clearTimeout(closeTimer);
        setHeaderOrderPanelOpen(wrap, true);
      }

      function scheduleClose() {
        clearTimeout(closeTimer);
        closeTimer = setTimeout(() => setHeaderOrderPanelOpen(wrap, false), 320);
      }

      [wrap, panel].forEach((el) => {
        if (!el) return;
        el.addEventListener("mouseenter", openPanel);
        el.addEventListener("mouseleave", scheduleClose);
      });

      trigger?.addEventListener("click", (e) => {
        if (!readItems().length) return;
        e.preventDefault();
        openPanel();
      });

      wrap.addEventListener("click", (e) => {
        const removeBtn = e.target.closest("[data-header-order-remove]");
        if (removeBtn) {
          e.preventDefault();
          e.stopPropagation();
          const index = Number.parseInt(removeBtn.getAttribute("data-header-order-remove"), 10);
          if (!Number.isNaN(index)) {
            removeItem(index);
            if (!readItems().length) setHeaderOrderPanelOpen(wrap, false);
          }
          return;
        }

        const checkoutBtn = e.target.closest("[data-header-order-checkout]");
        if (checkoutBtn) {
          e.preventDefault();
          e.stopPropagation();
          setHeaderOrderPanelOpen(wrap, false);
          openFulfillmentModal();
        }
      });

      wrap.addEventListener("keydown", (e) => {
        if (e.key === "Escape") setHeaderOrderPanelOpen(wrap, false);
      });

      document.addEventListener("click", (e) => {
        if (!wrap.contains(e.target)) setHeaderOrderPanelOpen(wrap, false);
      });
    });
  }

  function bindHeaderOrderShortcut() {
    bindHeaderOrderPanel();
    document.querySelectorAll(".ws-header-order").forEach((el) => {
      if (el.dataset.orderShortcutBound === "1") return;
      el.dataset.orderShortcutBound = "1";
      el.setAttribute("aria-haspopup", "true");
      el.setAttribute("aria-expanded", "false");
    });
    updateHeaderOrder();
  }

  function updateHeaderOrder() {
    const items = readItems();
    const count = items.length;
    const label =
      count === 0
        ? null
        : count === 1
          ? "Checkout (1 item)"
          : `Checkout (${count} items)`;
    const { html: totalsHtml } = renderTotalsSummary(items, { compact: true });

    document.querySelectorAll(".ws-header-order-wrap").forEach((wrap) => {
      const link = wrap.querySelector(".ws-header-order");
      const textEl = wrap.querySelector(".ws-header-order__text");
      const preview = wrap.querySelector(".ws-header-order-preview");
      const list = wrap.querySelector(".ws-header-order-preview__list");
      const summary = wrap.querySelector(".ws-header-order-preview__summary");
      const wasOpen = wrap.classList.contains("is-open");
      if (!link || !textEl) return;

      if (count > 0) {
        wrap.classList.add("ws-header-order-wrap--active");
        textEl.textContent = label;
        link.setAttribute("title", label);
        link.setAttribute("aria-label", `${label} — review your order`);
        if (preview && list) {
          preview.hidden = false;
          preview.setAttribute("aria-hidden", "false");
          list.innerHTML = items
            .map((item, index) => {
              const price = item.price
                ? `<span class="ws-header-order-preview__price">${escapeHtml(item.price)}</span>`
                : `<span class="ws-header-order-preview__price"></span>`;
              return `<li>
                <button type="button" class="ws-header-order-preview__remove" data-header-order-remove="${index}" aria-label="Remove ${escapeHtml(item.name)}">&times;</button>
                <span class="ws-header-order-preview__name">${escapeHtml(item.name)}</span>
                ${price}
              </li>`;
            })
            .join("");
          if (summary) summary.innerHTML = totalsHtml;
        }
        if (wasOpen) setHeaderOrderPanelOpen(wrap, true);
        return;
      }

      wrap.classList.remove("ws-header-order-wrap--active", "is-open");
      textEl.textContent = "Order Online";
      link.setAttribute("title", "Order online — browse menu");
      link.setAttribute("aria-label", "Order online — browse menu");
      link.setAttribute("aria-expanded", "false");
      if (preview) {
        preview.hidden = true;
        preview.setAttribute("aria-hidden", "true");
        if (list) list.innerHTML = "";
        if (summary) summary.innerHTML = "";
      }
    });
  }

  function updateBar() {
    const items = readItems();
    const count = items.length;
    let bar = document.getElementById("pickup-order-bar");
    updateHeaderOrder();
    if (!count) {
      bar?.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement("aside");
      bar.id = "pickup-order-bar";
      bar.className = "pickup-order-bar";
      bar.setAttribute("aria-label", "Order list");
      document.body.appendChild(bar);
    }
    const { html: totalsHtml } = renderTotalsSummary(items, { compact: true });
    bar.innerHTML = `
      <div class="pickup-order-bar-inner container">
        <div class="pickup-order-bar-summary">${totalsHtml}</div>
        <div class="pickup-order-bar-actions">
          <a href="order.html#pickup-order" class="btn btn-outline pickup-order-bar-view">View order</a>
          <button type="button" class="btn btn-primary pickup-order-bar-checkout" data-fulfillment-checkout>Checkout</button>
        </div>
      </div>`;
    bindFulfillmentCheckout(bar.querySelector("[data-fulfillment-checkout]"));
  }

  function bindMenu(root) {
    if (!root || root.dataset.pickupBound === "1") return;
    root.dataset.pickupBound = "1";
    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pickup-add]");
      if (!btn || !root.contains(btn)) return;
      const name = btn.getAttribute("data-item-name") || "";
      const price = btn.getAttribute("data-item-price") || "";
      if (!addItem(name, price)) return;
      btn.classList.add("is-added");
      setTimeout(() => btn.classList.remove("is-added"), 1200);
      showToast(`Added ${name} to your order`);
      updateBar();
    });
  }

  function removeItem(index) {
    const items = readItems();
    if (index < 0 || index >= items.length) return false;
    const removed = items[index];
    items.splice(index, 1);
    writeItems(items);
    showToast(`Removed ${removed.name}`);
    updateBar();
    renderOrderPage();
    return true;
  }

  function clearItems() {
    writeItems([]);
    updateBar();
    renderOrderPage();
  }

  function bindOrderListActions() {
    const list = document.getElementById("pickup-order-list");
    if (!list || list.dataset.pickupActionsBound === "1") return;
    list.dataset.pickupActionsBound = "1";
    list.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pickup-remove]");
      if (!btn || !list.contains(btn)) return;
      const index = Number.parseInt(btn.getAttribute("data-pickup-remove"), 10);
      if (!Number.isNaN(index)) removeItem(index);
    });
  }

  function renderOrderPage() {
    const section = document.getElementById("pickup-order");
    const list = document.getElementById("pickup-order-list");
    const summarySlot = document.getElementById("pickup-order-summary");
    if (!section || !list) return;

    const items = readItems();
    if (!items.length) {
      section.hidden = true;
      list.innerHTML = "";
      if (summarySlot) summarySlot.innerHTML = "";
      return;
    }

    section.hidden = false;
    const { html: totalsHtml } = renderTotalsSummary(items, { compact: false });
    if (summarySlot) summarySlot.innerHTML = totalsHtml;

    list.innerHTML = items
      .map((item, index) => {
        const price = item.price
          ? `<span class="pickup-order-list-price">${escapeHtml(item.price)}</span>`
          : "";
        return `<li class="pickup-order-list-item">
          <button type="button" class="pickup-order-remove" data-pickup-remove="${index}" aria-label="Remove ${escapeHtml(item.name)}">&times;</button>
          <span class="pickup-order-list-name">${escapeHtml(item.name)}</span>
          ${price}
        </li>`;
      })
      .join("");

    document.querySelectorAll("[data-fulfillment-checkout], [data-toast-handoff]").forEach(bindFulfillmentCheckout);
  }

  function initOrderPage() {
    bindOrderListActions();
    renderOrderPage();
    document.getElementById("pickup-order-clear")?.addEventListener("click", clearItems);
    document.querySelectorAll("[data-fulfillment-checkout], [data-toast-handoff]").forEach(bindFulfillmentCheckout);
  }

  window.addEventListener("ws-pickup-order-change", () => {
    updateHeaderOrder();
    updateBar();
    renderOrderPage();
  });
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      updateHeaderOrder();
      updateBar();
      renderOrderPage();
    }
  });

  async function boot() {
    await loadSiteOrderingConfig();
    initOrderPage();
    updateBar();
    bindHeaderOrderShortcut();
  }

  document.addEventListener("partials-loaded", bindHeaderOrderShortcut);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return {
    addItem,
    getCount,
    bindMenu,
    updateBar,
    updateHeaderOrder,
    getCheckoutUrl,
    loadSiteOrderingConfig,
    readItems,
    removeItem,
    clearItems,
    renderOrderPage,
    openFulfillmentModal,
    computeTotals,
  };
})();
