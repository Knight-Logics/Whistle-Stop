/* Guest-facing banner — in-venue print offers (?ws_offer=...) */
(function () {
  const params = new URLSearchParams(window.location.search);
  const offer = params.get("ws_offer");
  if (!offer) return;

  const note =
    params.get("ws_offer_note") ||
    "Show your server or bartender when you sit down — before you order. Not valid on online checkout.";
  const exp = params.get("ws_offer_exp");
  if (exp) {
    const end = new Date(exp + "T23:59:59");
    if (!Number.isNaN(end.getTime()) && end < new Date()) return;
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mount() {
    if (document.querySelector(".ws-qr-offer-banner")) return;
    const bar = document.createElement("div");
    bar.className = "ws-qr-offer-banner";
    bar.setAttribute("role", "status");
    bar.innerHTML = `
      <div class="ws-qr-offer-banner-inner">
        <p class="ws-qr-offer-banner-kicker">In-venue offer · show staff before you order</p>
        <p class="ws-qr-offer-banner-title">${esc(offer)}</p>
        <p class="ws-qr-offer-banner-note">${esc(note)}</p>
        <button type="button" class="ws-qr-offer-banner-close" aria-label="Dismiss">×</button>
      </div>`;
    bar.querySelector(".ws-qr-offer-banner-close")?.addEventListener("click", () => bar.remove());
    document.body.prepend(bar);
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
