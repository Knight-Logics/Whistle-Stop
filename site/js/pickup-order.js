/* Order list + Toast online ordering handoff (Toast does not sync external carts) */
window.WSPickupOrder = (function () {
  const STORAGE_KEY = "ws-pickup-order";
  const DEFAULT_ORDER_URL = "https://www.whistlestopgrill.com/online-ordering";
  const DEFAULT_TAX_RATE = 0.07;
  let resolvedOrderUrl = null;
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

  function getOrderUrl() {
    if (resolvedOrderUrl) return resolvedOrderUrl;
    const link = document.querySelector('[data-site="links.orderOnline"]');
    const href = link?.getAttribute("href");
    return href && href !== "#" ? href : DEFAULT_ORDER_URL;
  }

  async function loadSiteOrderingConfig() {
    try {
      if (window.WSConfig?.get) {
        const site = await window.WSConfig.get("site");
        if (site.ordering?.estimatedTaxRate != null) {
          taxRate = Number(site.ordering.estimatedTaxRate) || DEFAULT_TAX_RATE;
        }
        if (site.ordering?.taxNote) taxNote = site.ordering.taxNote;
        resolvedOrderUrl = site.links?.orderOnline || DEFAULT_ORDER_URL;
        return resolvedOrderUrl;
      }
    } catch {
      /* fall through */
    }
    resolvedOrderUrl = getOrderUrl();
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

  function updateHandoffTotals(modal) {
    const slot = modal.querySelector("#toast-handoff-totals");
    if (!slot) return;
    const items = readItems();
    const { html } = renderTotalsSummary(items, { compact: false });
    slot.innerHTML = html;
  }

  function ensureHandoffModal() {
    let modal = document.getElementById("toast-handoff-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "toast-handoff-modal";
    modal.className = "toast-handoff-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="toast-handoff-backdrop" data-toast-handoff-close></div>
      <div class="toast-handoff-dialog" role="dialog" aria-modal="true" aria-labelledby="toast-handoff-title">
        <button type="button" class="toast-handoff-close" data-toast-handoff-close aria-label="Close">&times;</button>
        <h2 id="toast-handoff-title">Finish &amp; pay online</h2>
        <p>Your list here is a helper only. Whistle Stop&rsquo;s online ordering page is where you add items to cart, pay, pick a pickup time, and get your confirmation number.</p>
        <div id="toast-handoff-totals"></div>
        <ol class="toast-handoff-steps">
          <li>Open online ordering below</li>
          <li>Re-add items, pay, and pick up at 915 Main Street</li>
        </ol>
        <p class="toast-handoff-note">If a menu section says &ldquo;Schedule Pickup Time,&rdquo; that category may not be open for ordering yet — try another section or call (727) 726-1956.</p>
        <div class="toast-handoff-actions">
          <a href="${escapeHtml(DEFAULT_ORDER_URL)}" class="btn btn-primary" id="toast-handoff-open" target="_blank" rel="noopener noreferrer">Open online ordering</a>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelectorAll("[data-toast-handoff-close]").forEach((el) => {
      el.addEventListener("click", () => closeHandoffModal());
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) closeHandoffModal();
    });

    return modal;
  }

  async function openHandoffModal() {
    const modal = ensureHandoffModal();
    const openBtn = modal.querySelector("#toast-handoff-open");
    const url = await loadSiteOrderingConfig();
    if (openBtn) openBtn.setAttribute("href", url);
    updateHandoffTotals(modal);
    modal.hidden = false;
    document.body.classList.add("toast-handoff-open");
    modal.querySelector("#toast-handoff-open")?.focus();
  }

  function closeHandoffModal() {
    const modal = document.getElementById("toast-handoff-modal");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("toast-handoff-open");
  }

  function bindToastCheckout(el) {
    if (!el || el.dataset.toastBound === "1") return;
    el.dataset.toastBound = "1";
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!readItems().length) return;
      openHandoffModal();
    });
  }

  function updateBar() {
    const items = readItems();
    const count = items.length;
    let bar = document.getElementById("pickup-order-bar");
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
          <button type="button" class="btn btn-primary pickup-order-bar-checkout" data-toast-handoff>Order online</button>
        </div>
      </div>`;
    bindToastCheckout(bar.querySelector("[data-toast-handoff]"));
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

    document.querySelectorAll("[data-toast-handoff]").forEach(bindToastCheckout);
  }

  function initOrderPage() {
    bindOrderListActions();
    renderOrderPage();
    document.getElementById("pickup-order-clear")?.addEventListener("click", clearItems);
    document.querySelectorAll("[data-toast-handoff]").forEach(bindToastCheckout);
  }

  window.addEventListener("ws-pickup-order-change", () => {
    updateBar();
    renderOrderPage();
  });
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      updateBar();
      renderOrderPage();
    }
  });

  async function boot() {
    await loadSiteOrderingConfig();
    initOrderPage();
    updateBar();
  }

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
    getOrderUrl,
    loadSiteOrderingConfig,
    readItems,
    removeItem,
    clearItems,
    renderOrderPage,
    openHandoffModal,
    computeTotals,
  };
})();
