/* Whistle Stop — print QR library + live brochure composer */
window.WSAdminQRCodes = (function () {
  const STORAGE_KEY = "ws_admin_qr_custom";
  const BROCHURE_META_KEY = "ws_admin_qr_brochures";
  const LIVE_SITE = "https://www.whistlestopgrill.com";
  const REBUILD_SITE = "https://knight-logics.github.io/Whistle-Stop";

  const LAND_PAGES = [
    { id: "menu", label: "Menu", file: "menu.html" },
    { id: "events", label: "Events calendar", file: "events.html" },
    { id: "happy-hour", label: "Happy hour", file: "happy-hour.html" },
    { id: "home", label: "Homepage", file: "index.html" },
    { id: "order", label: "Order online", file: "https://www.whistlestopgrill.com/online-ordering", external: true },
    { id: "private-events", label: "Private parties", file: "private-events.html" },
  ];

  const QR_POSITIONS = [
    { id: "top-left", label: "Top left" },
    { id: "top-center", label: "Top center" },
    { id: "top-right", label: "Top right" },
    { id: "middle-left", label: "Middle left" },
    { id: "center", label: "Center" },
    { id: "middle-right", label: "Middle right" },
    { id: "bottom-left", label: "Bottom left" },
    { id: "bottom-center", label: "Bottom center" },
    { id: "bottom-right", label: "Bottom right" },
  ];

  const REDEEM_PRESETS = [
    {
      id: "server",
      label: "Show server when seated (recommended)",
      note: "Show your server or bartender when you sit down — before you order. Dine-in only.",
    },
    {
      id: "bar",
      label: "Show bartender at the bar",
      note: "Show the bartender before your first round. Dine-in only.",
    },
    {
      id: "visit",
      label: "This visit only — not online orders",
      note: "Valid for one dine-in visit. One per table. Not valid on Toast or delivery apps.",
    },
    {
      id: "custom",
      label: "Custom staff note…",
      note: "",
    },
  ];

  const CREATE_HINTS = {
    event: "Links to the event on your website calendar. Print on cornhole boards, patio tents, or flyers — guests scan to see date, time, and details.",
    offer:
      "Print offer for the table or bar — not a Toast coupon. Guest scans, sees the headline on their phone, and shows staff when they order. Staff applies it in person.",
    link: "Simple trackable link to menu, reviews, hours, etc. No offer banner — use the preset cards above for common links.",
    campaign:
      "Links to a Campaign Calendar interest-check signup page (e.g. D&D night). Tracks scans via UTM; signups appear in Campaign Calendar → Outreach.",
  };

  const PRESETS = [
    {
      id: "main-site",
      title: "Main website",
      placement: "Table tents · window cling · general",
      url: "https://www.whistlestopgrill.com/",
      staticQr: "assets/qr-whistlestop-main.png",
      note: "Matches your current print QR (whistlestopgrill.com).",
    },
    {
      id: "menu",
      title: "Menu",
      placement: "Table tents · bar rail",
      url: trackUrl("menu.html", "menu", "table-tent"),
    },
    {
      id: "order",
      title: "Order online",
      placement: "Bar & counter · receipts",
      url: trackUrl("https://www.whistlestopgrill.com/online-ordering", "order", "bar-counter"),
    },
    {
      id: "reviews",
      title: "Google review",
      placement: "Receipts · check presenter",
      url: trackUrl(
        "https://www.google.com/maps/search/?api=1&query=Whistle+Stop+Grill+Bar+915+Main+Street+Safety+Harbor+FL",
        "google-review",
        "receipt"
      ),
    },
    {
      id: "gift-cards",
      title: "Gift cards",
      placement: "Host stand",
      url: trackUrl("https://order.toasttab.com/egift/whistle-stop-grill-bar", "gift-card", "host-stand"),
    },
    {
      id: "events",
      title: "Events calendar",
      placement: "Cornhole board · patio signage",
      url: trackUrl("events.html", "events", "cornhole-board"),
    },
    {
      id: "private-events",
      title: "Private parties",
      placement: "Events page · host stand",
      url: trackUrl("private-events.html", "private-events", "host-stand"),
    },
    {
      id: "happy-hour",
      title: "Happy hour",
      placement: "Bar coasters · patio",
      url: trackUrl("happy-hour.html", "happy-hour", "bar-coaster"),
    },
  ];

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function slugify(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
  }

  function getPublicSiteBase() {
    const host = typeof location !== "undefined" ? location.hostname : "";
    if (host === "127.0.0.1" || host === "localhost" || host.includes("github.io")) {
      return REBUILD_SITE.replace(/\/$/, "") + "/";
    }
    return LIVE_SITE.replace(/\/$/, "") + "/";
  }

  function trackUrl(pathOrUrl, campaign, placement, extra = {}) {
    let url;
    const isAbsolute = /^https?:\/\//i.test(pathOrUrl);
    try {
      url = new URL(pathOrUrl, isAbsolute ? undefined : getPublicSiteBase());
    } catch {
      url = new URL(getPublicSiteBase());
    }
    url.searchParams.set("utm_source", "qr");
    url.searchParams.set("utm_medium", "print");
    url.searchParams.set("utm_campaign", campaign);
    if (placement) url.searchParams.set("utm_content", slugify(placement));
    if (extra.offerText) url.searchParams.set("ws_offer", extra.offerText);
    if (extra.offerNote) url.searchParams.set("ws_offer_note", extra.offerNote);
    if (extra.offerExp) url.searchParams.set("ws_offer_exp", extra.offerExp);
    return url.toString();
  }

  function eventHash(perf) {
    return `${slugify(perf.title)}-${perf.date}`;
  }

  function buildOfferUrl(pageId, { offerText, offerNote, offerExp, placement, campaign }) {
    const page = LAND_PAGES.find((p) => p.id === pageId) || LAND_PAGES[0];
    const code = campaign || slugify(offerText) || "offer";
    return trackUrl(page.file, code, placement, { offerText, offerNote, offerExp });
  }

  function buildEventUrl(perf, { placement } = {}) {
    const hash = eventHash(perf);
    const url = new URL("events.html", getPublicSiteBase());
    url.searchParams.set("utm_source", "qr");
    url.searchParams.set("utm_medium", "print");
    url.searchParams.set("utm_campaign", `event-${slugify(perf.title)}`);
    if (placement) url.searchParams.set("utm_content", slugify(placement));
    url.hash = hash;
    return url.toString();
  }

  function getQrApiUrl(url, size, margin = 2) {
    return (
      "https://api.qrserver.com/v1/create-qr-code/?size=" +
      size +
      "x" +
      size +
      "&ecc=M&margin=" +
      margin +
      "&data=" +
      encodeURIComponent(url)
    );
  }

  function loadCustom() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveCustom(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 60)));
  }

  function loadBrochureMeta() {
    try {
      return JSON.parse(localStorage.getItem(BROCHURE_META_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveBrochureMeta(list) {
    localStorage.setItem(BROCHURE_META_KEY, JSON.stringify(list.slice(0, 12)));
  }

  function allCodes() {
    return [...PRESETS, ...loadCustom()];
  }

  function kindTag(code) {
    if (code.kind === "offer" || code.kind === "promo")
      return `<span class="admin-qr-custom-tag admin-qr-kind-offer">Offer</span>`;
    if (code.kind === "event") return `<span class="admin-qr-custom-tag admin-qr-kind-event">Event</span>`;
    if (code.kind === "link") return `<span class="admin-qr-custom-tag">Link</span>`;
    return "";
  }

  function assetFilename(code, size, ext = ".png") {
    return ["whistlestop", code?.id || "qr", String(size)].filter(Boolean).join("-") + ext;
  }

  async function downloadBlob(blob, filename) {
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  }

  async function downloadQrImage(imgSrc, filename) {
    const response = await fetch(imgSrc);
    if (!response.ok) throw new Error("Could not download QR image");
    await downloadBlob(await response.blob(), filename);
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  function qrRectForPosition(canvasW, canvasH, qrSize, position, marginPct) {
    const m = (marginPct / 100) * Math.min(canvasW, canvasH);
    const cx = (canvasW - qrSize) / 2;
    const cy = (canvasH - qrSize) / 2;
    const positions = {
      "top-left": { x: m, y: m },
      "top-center": { x: cx, y: m },
      "top-right": { x: canvasW - qrSize - m, y: m },
      "middle-left": { x: m, y: cy },
      center: { x: cx, y: cy },
      "middle-right": { x: canvasW - qrSize - m, y: cy },
      "bottom-left": { x: m, y: canvasH - qrSize - m },
      "bottom-center": { x: cx, y: canvasH - qrSize - m },
      "bottom-right": { x: canvasW - qrSize - m, y: canvasH - qrSize - m },
    };
    return positions[position] || positions["bottom-right"];
  }

  async function compositeBrochure({ brochureUrl, code, position, sizePct }) {
    const base = await loadImage(brochureUrl);
    const canvas = document.createElement("canvas");
    canvas.width = base.naturalWidth || base.width;
    canvas.height = base.naturalHeight || base.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(base, 0, 0);

    const qrPx = Math.round(canvas.width * (sizePct / 100));
    const qrUrl = getQrApiUrl(code.url, Math.min(800, Math.max(256, qrPx)), 2);
    const qr = await loadImage(qrUrl);
    const { x, y } = qrRectForPosition(canvas.width, canvas.height, qrPx, position, 3);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 6, y - 6, qrPx + 12, qrPx + 12);
    ctx.drawImage(qr, x, y, qrPx, qrPx);

    const captionText = code.brochureLabel || code.title || "";
    if (captionText) {
      const fontSize = Math.max(11, Math.round(canvas.width * 0.018));
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.fillStyle = "#141414";
      ctx.textAlign = "center";
      wrapCaption(ctx, captionText, x + qrPx / 2, y + qrPx + fontSize + 8, qrPx + 48, fontSize);
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create brochure"))), "image/png");
    });
  }

  function wrapCaption(ctx, text, cx, y, maxW, fontSize) {
    const words = String(text).split(/\s+/);
    let line = "";
    const lines = [];
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else line = test;
    });
    if (line) lines.push(line);
    lines.slice(0, 2).forEach((ln, i) => {
      ctx.fillText(ln, cx, y + i * (fontSize + 3));
    });
  }

  function upcomingEvents(eventsData) {
    if (!eventsData) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const perfs = (eventsData.performances || [])
      .filter((p) => p.date && p.title)
      .sort((a, b) => a.date.localeCompare(b.date));
    const future = perfs.filter((p) => new Date(p.date + "T12:00:00") >= today);
    const recurring = (eventsData.recurring || []).map((r) => ({ ...r, isRecurring: true }));
    return [...future, ...recurring];
  }

  function render(panel, options = {}) {
    const eventsData = options.events || null;
    let activeId = PRESETS[0].id;
    let qrSize = 300;
    let brochurePosition = "bottom-right";
    let brochureSizePct = 16;
    let selectedBrochureId = loadBrochureMeta()[0]?.id || "";
    let lastBrochureBlob = null;
    let brochurePreviewTimer = null;
    let brochurePreviewGen = 0;

    panel.innerHTML = `
      <p class="admin-note" style="margin-top:0">
        <strong>Print QR library</strong> — download codes for table tents, events, and flyers, or composite them onto uploaded brochure art. Offers are <em>in-venue only</em> (guest shows staff when ordering) — not Toast checkout coupons.
      </p>
      <div class="admin-qr-toast-placeholder" aria-disabled="true">
        <h3>Discount QR codes — awaiting Toast implementation</h3>
        <p>Auto-applied checkout coupons via Toast POS are not wired yet. Use <strong>Table tent offer (in-venue)</strong> below for staff-honored promos, or campaign signup QRs for interest checks.</p>
      </div>
      <div class="admin-qr-manager">
        <div class="admin-qr-manager-main">
          <div class="admin-qr-manager-grid" id="qr-code-grid"></div>

          <div class="admin-mock-card admin-qr-create-card">
            <h3>Create print QR</h3>
            <div class="admin-form-grid cols-2">
              <div class="admin-field" style="grid-column:1/-1">
                <label for="qr-create-type">What is this QR for?</label>
                <select id="qr-create-type">
                  <option value="event">Event tent / flyer</option>
                  <option value="campaign">Campaign signup (interest check)</option>
                  <option value="offer">Table tent offer (in-venue)</option>
                  <option value="link">Trackable info link</option>
                </select>
              </div>
            </div>
            <p class="admin-qr-create-type-hint" id="qr-create-hint">${esc(CREATE_HINTS.event)}</p>

            <div id="qr-fields-event" class="admin-qr-create-panel">
              <div class="admin-form-grid cols-2">
                <div class="admin-field" style="grid-column:1/-1">
                  <label for="qr-event-pick">Event (from Events tab)</label>
                  <select id="qr-event-pick"><option value="">— Select event —</option></select>
                </div>
                <div class="admin-field">
                  <label for="qr-event-placement">Print placement</label>
                  <input id="qr-event-placement" type="text" value="Event tent · patio" placeholder="Cornhole board · flyer" />
                </div>
                <div class="admin-field">
                  <label for="qr-event-label">Label on brochure (optional)</label>
                  <input id="qr-event-label" type="text" placeholder="Live music · Jun 14" />
                </div>
              </div>
            </div>

            <div id="qr-fields-campaign" class="admin-qr-create-panel" hidden>
              <div class="admin-form-grid cols-2">
                <div class="admin-field" style="grid-column:1/-1">
                  <label for="qr-campaign-slug">Campaign</label>
                  <select id="qr-campaign-slug"><option value="">— Loading campaigns —</option></select>
                </div>
                <div class="admin-field">
                  <label for="qr-campaign-placement">Print placement</label>
                  <input id="qr-campaign-placement" type="text" value="Flyer · patio tent" placeholder="Cornhole board · flyer" />
                </div>
                <div class="admin-field">
                  <label for="qr-campaign-label">Label on brochure (optional)</label>
                  <input id="qr-campaign-label" type="text" placeholder="D&amp;D interest signup" />
                </div>
              </div>
            </div>

            <div id="qr-fields-offer" class="admin-qr-create-panel" hidden>
              <div class="admin-form-grid cols-2">
                <div class="admin-field" style="grid-column:1/-1">
                  <label for="qr-offer-headline">Headline on tent</label>
                  <input id="qr-offer-headline" type="text" placeholder="Free beer with $20 food purchase" />
                </div>
                <div class="admin-field" style="grid-column:1/-1">
                  <label for="qr-offer-redeem">How staff honors it</label>
                  <select id="qr-offer-redeem">
                    ${REDEEM_PRESETS.map((r) => `<option value="${r.id}">${esc(r.label)}</option>`).join("")}
                  </select>
                </div>
                <div class="admin-field" style="grid-column:1/-1" id="qr-offer-custom-note-wrap" hidden>
                  <label for="qr-offer-custom-note">Custom staff note</label>
                  <input id="qr-offer-custom-note" type="text" placeholder="One per table · not valid with other promos" />
                </div>
                <div class="admin-field">
                  <label for="qr-offer-page">Guest lands on</label>
                  <select id="qr-offer-page">
                    ${LAND_PAGES.filter((p) => !p.external)
                      .map((p) => `<option value="${p.id}">${esc(p.label)}</option>`)
                      .join("")}
                  </select>
                </div>
                <div class="admin-field">
                  <label for="qr-offer-placement">Print placement</label>
                  <input id="qr-offer-placement" type="text" placeholder="Table tent · bar rail" />
                </div>
                <div class="admin-field">
                  <label for="qr-offer-exp">Valid through (optional)</label>
                  <input id="qr-offer-exp" type="date" />
                </div>
              </div>
            </div>

            <div id="qr-fields-link" class="admin-qr-create-panel" hidden>
              <div class="admin-form-grid cols-2">
                <div class="admin-field">
                  <label for="qr-link-label">Card label</label>
                  <input id="qr-link-label" type="text" placeholder="Patio menu tent" />
                </div>
                <div class="admin-field">
                  <label for="qr-link-page">Destination</label>
                  <select id="qr-link-page">
                    ${LAND_PAGES.map((p) => `<option value="${p.id}">${esc(p.label)}</option>`).join("")}
                  </select>
                </div>
                <div class="admin-field" style="grid-column:1/-1">
                  <label for="qr-link-placement">Print placement</label>
                  <input id="qr-link-placement" type="text" placeholder="Host stand · receipt" />
                </div>
              </div>
            </div>

            <div class="admin-qr-builder-actions">
              <button type="button" class="btn btn-primary admin-btn-sm" id="qr-create-btn">Add to library</button>
              <span id="qr-create-status" class="admin-mock-subnote"></span>
            </div>
          </div>

          <div class="admin-mock-card admin-qr-brochure-card">
            <h3>Brochure with QR</h3>
            <p class="admin-mock-subnote">Upload flyer or tent art — preview updates automatically as you change QR, position, or size.</p>
            <div class="admin-form-grid cols-2">
              <div class="admin-field">
                <label for="qr-brochure-upload">Upload brochure</label>
                <input id="qr-brochure-upload" type="file" accept="image/png,image/jpeg,image/webp" />
              </div>
              <div class="admin-field">
                <label for="qr-brochure-pick">Template</label>
                <select id="qr-brochure-pick"><option value="">— Upload first —</option></select>
              </div>
              <div class="admin-field">
                <label for="qr-brochure-code">QR code</label>
                <select id="qr-brochure-code"></select>
              </div>
              <div class="admin-field">
                <label for="qr-brochure-size">QR size (% of width)</label>
                <input id="qr-brochure-size" type="range" min="8" max="32" value="16" />
                <span id="qr-brochure-size-label" class="admin-mock-subnote">16%</span>
              </div>
              <div class="admin-field" style="grid-column:1/-1">
                <label>QR position on art</label>
                <div class="admin-qr-position-grid" id="qr-brochure-position-grid" role="group" aria-label="QR position">
                  ${QR_POSITIONS.map(
                    (p) =>
                      `<button type="button" class="admin-qr-position-btn${p.id === "bottom-right" ? " is-active" : ""}" data-position="${p.id}" title="${esc(p.label)}" aria-label="${esc(p.label)}"></button>`
                  ).join("")}
                </div>
              </div>
            </div>
            <div class="admin-qr-brochure-preview-wrap" id="qr-brochure-preview-wrap">
              <p class="admin-qr-brochure-preview-placeholder" id="qr-brochure-placeholder">Upload a brochure and pick a QR to see live preview.</p>
              <img id="qr-brochure-preview" alt="Brochure preview" class="admin-qr-brochure-preview" hidden />
            </div>
            <div class="admin-qr-brochure-actions">
              <button type="button" class="btn btn-primary admin-btn-sm" id="qr-brochure-download">Download brochure PNG</button>
              <button type="button" class="btn btn-outline admin-btn-sm" id="qr-brochure-delete" hidden>Remove template</button>
            </div>
            <p id="qr-brochure-status" class="admin-mock-subnote"></p>
          </div>
        </div>
        <aside class="admin-qr-manager-detail admin-mock-card" id="qr-code-detail">
          <p class="admin-mock-subnote">Select a code from the library.</p>
        </aside>
      </div>`;

    const grid = panel.querySelector("#qr-code-grid");
    const detail = panel.querySelector("#qr-code-detail");
    const eventSelect = panel.querySelector("#qr-event-pick");
    const previewWrap = panel.querySelector("#qr-brochure-preview-wrap");
    const previewImg = panel.querySelector("#qr-brochure-preview");
    const previewPlaceholder = panel.querySelector("#qr-brochure-placeholder");

    function fillEventSelect() {
      const items = upcomingEvents(eventsData);
      if (!items.length) {
        eventSelect.innerHTML = '<option value="">No events yet — add one in the Events tab</option>';
        return;
      }
      eventSelect.innerHTML =
        '<option value="">— Select event —</option>' +
        items
          .map((ev) => {
            if (ev.isRecurring) {
              return `<option value="rec|${esc(ev.id)}">${esc(ev.title)} (weekly)</option>`;
            }
            return `<option value="perf|${esc(ev.date)}|${esc(ev.title)}">${esc(ev.date)} · ${esc(ev.title)}</option>`;
          })
          .join("");
    }

    fillEventSelect();

    function findCode(id) {
      return allCodes().find((c) => c.id === id);
    }

    function setCreateType(type) {
      panel.querySelector("#qr-create-hint").textContent = CREATE_HINTS[type] || "";
      panel.querySelector("#qr-fields-event").hidden = type !== "event";
      panel.querySelector("#qr-fields-campaign").hidden = type !== "campaign";
      panel.querySelector("#qr-fields-offer").hidden = type !== "offer";
      panel.querySelector("#qr-fields-link").hidden = type !== "link";
    }

    async function populateCampaignSelect() {
      const sel = panel.querySelector("#qr-campaign-slug");
      if (!sel || !window.WSCampaignStore) return;
      try {
        const { campaigns } = await window.WSCampaignStore.getCampaigns();
        sel.innerHTML =
          `<option value="">— Select campaign —</option>` +
          campaigns
            .map((c) => `<option value="${esc(c.slug || c.id)}">${esc(c.title)}</option>`)
            .join("");
      } catch {
        sel.innerHTML = `<option value="dnd-game-night">Dungeons &amp; Dragons Game Night</option>`;
      }
    }

    function applyQrPrefill() {
      try {
        const raw = sessionStorage.getItem("ws_qr_prefill");
        if (!raw) return;
        sessionStorage.removeItem("ws_qr_prefill");
        const pre = JSON.parse(raw);
        if (pre.url) {
          setCreateType("link");
          panel.querySelector("#qr-create-type").value = "link";
          panel.querySelector("#qr-link-label").value = pre.label || "Campaign signup";
          panel.querySelector("#qr-link-placement").value = pre.placement || "Campaign flyer";
        }
        if (pre.mode === "campaign" && pre.campaign) {
          setCreateType("campaign");
          panel.querySelector("#qr-create-type").value = "campaign";
          populateCampaignSelect().then(() => {
            panel.querySelector("#qr-campaign-slug").value = pre.campaign;
          });
          panel.querySelector("#qr-campaign-placement").value = pre.placement || "Campaign flyer";
          panel.querySelector("#qr-campaign-label").value = pre.label || "";
        }
      } catch (_) {}
    }

    function redeemNote() {
      const presetId = panel.querySelector("#qr-offer-redeem")?.value;
      const preset = REDEEM_PRESETS.find((r) => r.id === presetId);
      if (presetId === "custom") {
        return panel.querySelector("#qr-offer-custom-note")?.value?.trim() || REDEEM_PRESETS[0].note;
      }
      return preset?.note || REDEEM_PRESETS[0].note;
    }

    function renderGrid() {
      grid.innerHTML = allCodes()
        .map(
          (code) => `
        <button type="button" class="admin-qr-manager-card${code.id === activeId ? " is-active" : ""}" data-qr-id="${esc(code.id)}">
          <div class="admin-qr-manager-thumb" aria-hidden="true">
            ${
              code.staticQr
                ? `<img src="${esc(code.staticQr)}" alt="" width="72" height="72" />`
                : `<img src="${esc(getQrApiUrl(code.url, 120))}" alt="" width="72" height="72" loading="lazy" />`
            }
          </div>
          <strong>${esc(code.title)}</strong>
          <span>${esc(code.placement || "")}</span>
          ${kindTag(code)}
        </button>`
        )
        .join("");
      refreshBrochureCodeSelect();
      scheduleBrochurePreview();
    }

    function renderDetail() {
      const code = findCode(activeId);
      if (!code) {
        detail.innerHTML = `<p class="admin-mock-subnote">Select a code from the library.</p>`;
        return;
      }

      const imgSrc = code.staticQr || getQrApiUrl(code.url, qrSize);
      const imgDim = code.staticQr ? 250 : qrSize;

      detail.innerHTML = `
        <h3>${esc(code.title)}</h3>
        ${code.note ? `<p class="admin-mock-subnote">${esc(code.note)}</p>` : ""}
        ${code.offerText ? `<p class="admin-qr-offer-callout"><strong>Guest phone shows:</strong> ${esc(code.offerText)}</p>` : ""}
        ${code.offerNote ? `<p class="admin-mock-subnote"><strong>Staff:</strong> ${esc(code.offerNote)}</p>` : ""}
        ${code.kind === "event" ? `<p class="admin-mock-subnote">Scans open this event on the website calendar.</p>` : ""}
        <p class="admin-mock-subnote"><strong>Placement:</strong> ${esc(code.placement || "—")}</p>
        <div class="admin-qr-detail-preview">
          <img id="qr-detail-img" src="${esc(imgSrc)}" alt="QR code" width="${imgDim}" height="${imgDim}" />
        </div>
        <div class="admin-field">
          <label>Trackable URL</label>
          <div class="admin-qr-url-row">
            <input type="text" id="qr-detail-url" readonly value="${esc(code.url)}" />
            <button type="button" class="btn btn-outline admin-btn-sm" id="qr-copy-url">Copy</button>
          </div>
        </div>
        <div class="admin-qr-size-row">
          <span class="admin-qr-size-label">Download QR size</span>
          <div class="admin-qr-sizes" id="qr-sizes">
            ${[200, 250, 300, 500, 800]
              .map(
                (s) =>
                  `<button type="button" class="admin-qr-size-btn${s === qrSize ? " is-active" : ""}" data-size="${s}">${s}px</button>`
              )
              .join("")}
          </div>
        </div>
        <div class="admin-qr-detail-actions">
          <button type="button" class="btn btn-primary admin-btn-sm" id="qr-download-png">Download QR PNG</button>
          ${code.custom ? `<button type="button" class="btn btn-outline admin-btn-sm" id="qr-delete-custom">Remove</button>` : ""}
        </div>`;
    }

    function refresh() {
      renderGrid();
      renderDetail();
      refreshBrochurePickSelect();
    }

    function refreshBrochureCodeSelect() {
      const sel = panel.querySelector("#qr-brochure-code");
      if (!sel) return;
      const prev = sel.value;
      sel.innerHTML = allCodes().map((c) => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join("");
      if (prev && findCode(prev)) sel.value = prev;
      else if (findCode(activeId)) sel.value = activeId;
    }

    function refreshBrochurePickSelect() {
      const sel = panel.querySelector("#qr-brochure-pick");
      const list = loadBrochureMeta();
      if (!sel) return;
      if (!list.length) {
        sel.innerHTML = '<option value="">— Upload first —</option>';
        selectedBrochureId = "";
        panel.querySelector("#qr-brochure-delete").hidden = true;
        scheduleBrochurePreview();
        return;
      }
      if (!selectedBrochureId || !list.find((b) => b.id === selectedBrochureId)) {
        selectedBrochureId = list[0].id;
      }
      sel.innerHTML = list.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join("");
      sel.value = selectedBrochureId;
      panel.querySelector("#qr-brochure-delete").hidden = false;
      scheduleBrochurePreview();
    }

    async function getBrochureUrl(meta) {
      if (!meta?.uploadRef || !window.WSConfig?.resolveMediaSrc) return "";
      return WSConfig.resolveMediaSrc(meta.uploadRef);
    }

    function scheduleBrochurePreview() {
      clearTimeout(brochurePreviewTimer);
      brochurePreviewTimer = setTimeout(() => updateBrochurePreview(), 350);
    }

    async function updateBrochurePreview() {
      const gen = ++brochurePreviewGen;
      const meta = loadBrochureMeta().find((b) => b.id === selectedBrochureId);
      const codeId = panel.querySelector("#qr-brochure-code")?.value || activeId;
      const code = findCode(codeId);

      if (!meta || !code) {
        lastBrochureBlob = null;
        previewImg.hidden = true;
        previewPlaceholder.hidden = false;
        previewPlaceholder.textContent = "Upload a brochure and pick a QR to see live preview.";
        previewWrap.classList.remove("is-loading");
        return;
      }

      previewWrap.classList.add("is-loading");
      previewPlaceholder.hidden = false;
      previewPlaceholder.textContent = "Updating preview…";

      try {
        const brochureUrl = await getBrochureUrl(meta);
        const blob = await compositeBrochure({
          brochureUrl,
          code,
          position: brochurePosition,
          sizePct: brochureSizePct,
        });
        if (gen !== brochurePreviewGen) return;

        lastBrochureBlob = blob;
        if (previewImg._prevUrl) URL.revokeObjectURL(previewImg._prevUrl);
        previewImg._prevUrl = URL.createObjectURL(blob);
        previewImg.src = previewImg._prevUrl;
        previewImg.hidden = false;
        previewPlaceholder.hidden = true;
        panel.querySelector("#qr-brochure-status").textContent = "Live preview";
        panel.querySelector("#qr-brochure-status").style.color = "var(--text-muted)";
      } catch (err) {
        if (gen !== brochurePreviewGen) return;
        lastBrochureBlob = null;
        previewImg.hidden = true;
        previewPlaceholder.hidden = false;
        previewPlaceholder.textContent = err.message || "Could not build preview.";
        panel.querySelector("#qr-brochure-status").textContent = "";
      } finally {
        if (gen === brochurePreviewGen) previewWrap.classList.remove("is-loading");
      }
    }

    grid.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-qr-id]");
      if (!btn) return;
      activeId = btn.dataset.qrId;
      renderGrid();
      renderDetail();
    });

    detail.addEventListener("click", async (e) => {
      const code = findCode(activeId);
      if (!code) return;

      if (e.target.closest("#qr-copy-url")) {
        const input = detail.querySelector("#qr-detail-url");
        try {
          await navigator.clipboard.writeText(input?.value || code.url);
          e.target.closest("#qr-copy-url").textContent = "Copied";
          setTimeout(() => {
            const b = detail.querySelector("#qr-copy-url");
            if (b) b.textContent = "Copy";
          }, 1500);
        } catch {
          input?.select();
        }
        return;
      }

      if (e.target.closest("#qr-download-png")) {
        const btn = e.target.closest("#qr-download-png");
        btn.disabled = true;
        try {
          await downloadQrImage(getQrApiUrl(code.url, qrSize), assetFilename(code, qrSize));
        } catch (err) {
          alert(err.message || "Download failed");
        } finally {
          btn.disabled = false;
        }
        return;
      }

      const sizeBtn = e.target.closest(".admin-qr-size-btn");
      if (sizeBtn) {
        qrSize = Number(sizeBtn.dataset.size) || 300;
        if (!code.staticQr) {
          const img = detail.querySelector("#qr-detail-img");
          if (img) img.src = getQrApiUrl(code.url, qrSize);
        }
        detail.querySelectorAll(".admin-qr-size-btn").forEach((b) => {
          b.classList.toggle("is-active", Number(b.dataset.size) === qrSize);
        });
        return;
      }

      if (e.target.closest("#qr-delete-custom") && code.custom) {
        saveCustom(loadCustom().filter((c) => c.id !== code.id));
        activeId = PRESETS[0].id;
        refresh();
      }
    });

    panel.querySelector("#qr-create-type")?.addEventListener("change", (e) => {
      setCreateType(e.target.value);
    });

    panel.querySelector("#qr-offer-redeem")?.addEventListener("change", (e) => {
      panel.querySelector("#qr-offer-custom-note-wrap").hidden = e.target.value !== "custom";
    });

    panel.querySelector("#qr-create-btn")?.addEventListener("click", () => {
      const type = panel.querySelector("#qr-create-type")?.value;
      const status = panel.querySelector("#qr-create-status");
      let entry = null;

      if (type === "event") {
        const pick = panel.querySelector("#qr-event-pick")?.value || "";
        const placement = panel.querySelector("#qr-event-placement")?.value?.trim() || "Event tent";
        const brochureLabel = panel.querySelector("#qr-event-label")?.value?.trim();
        if (!pick) {
          status.textContent = "Select an event (add it in the Events tab first).";
          status.style.color = "var(--rust)";
          return;
        }
        const parts = pick.split("|");
        let url;
        let title;
        if (parts[0] === "rec") {
          const rec = (eventsData?.recurring || []).find((r) => r.id === parts[1]);
          if (!rec) {
            status.textContent = "Event not found — reopen this tab.";
            status.style.color = "var(--rust)";
            return;
          }
          title = rec.title;
          url = trackUrl("events.html", `recurring-${slugify(rec.title)}`, placement);
        } else if (parts[0] === "perf") {
          const perf = (eventsData?.performances || []).find(
            (p) => p.date === parts[1] && p.title === parts.slice(2).join("|")
          );
          if (!perf) {
            status.textContent = "Event not found — reopen this tab.";
            status.style.color = "var(--rust)";
            return;
          }
          title = `${perf.title} · ${perf.date}`;
          url = buildEventUrl(perf, { placement });
        } else {
          status.textContent = "Invalid event.";
          status.style.color = "var(--rust)";
          return;
        }
        entry = {
          id: `event-${slugify(title)}-${Date.now()}`,
          title,
          placement,
          url,
          brochureLabel: brochureLabel || title,
          kind: "event",
          custom: true,
        };
      } else if (type === "offer") {
        const offerText = panel.querySelector("#qr-offer-headline")?.value?.trim();
        const offerNote = redeemNote();
        const pageId = panel.querySelector("#qr-offer-page")?.value;
        const placement = panel.querySelector("#qr-offer-placement")?.value?.trim();
        const offerExp = panel.querySelector("#qr-offer-exp")?.value || "";
        if (!offerText) {
          status.textContent = "Enter the headline guests should see on the tent.";
          status.style.color = "var(--rust)";
          return;
        }
        const campaign = slugify(offerText);
        entry = {
          id: `offer-${campaign}-${Date.now()}`,
          title: offerText,
          placement: placement || "Table tent",
          url: buildOfferUrl(pageId, { offerText, offerNote, offerExp, placement, campaign }),
          offerText,
          offerNote,
          offerExp: offerExp || undefined,
          brochureLabel: offerText,
          kind: "offer",
          custom: true,
        };
      } else if (type === "campaign") {
        const slug = panel.querySelector("#qr-campaign-slug")?.value || "";
        const placement = panel.querySelector("#qr-campaign-placement")?.value?.trim() || "Flyer";
        const brochureLabel = panel.querySelector("#qr-campaign-label")?.value?.trim();
        if (!slug) {
          status.textContent = "Select a campaign (manage in Campaign Calendar).";
          status.style.color = "var(--rust)";
          return;
        }
        const base = getPublicSiteBase();
        const url = trackUrl(`campaign.html?campaign=${encodeURIComponent(slug)}`, slug, placement);
        const title = brochureLabel || `Campaign: ${slug}`;
        entry = {
          id: `campaign-${slug}-${Date.now()}`,
          title,
          placement,
          url,
          brochureLabel: title,
          kind: "campaign",
          custom: true,
        };
      } else {
        const label = panel.querySelector("#qr-link-label")?.value?.trim();
        const pageId = panel.querySelector("#qr-link-page")?.value;
        const placement = panel.querySelector("#qr-link-placement")?.value?.trim();
        const page = LAND_PAGES.find((p) => p.id === pageId);
        if (!label || !page) {
          status.textContent = "Label and destination are required.";
          status.style.color = "var(--rust)";
          return;
        }
        entry = {
          id: `link-${slugify(label)}-${Date.now()}`,
          title: label,
          placement: placement || "Print",
          url: trackUrl(page.file, slugify(label), placement),
          brochureLabel: label,
          kind: "link",
          custom: true,
        };
      }

      const list = loadCustom();
      list.unshift(entry);
      saveCustom(list);
      activeId = entry.id;
      status.textContent = "Added to library — download QR or use in brochure below.";
      status.style.color = "var(--sage)";
      refresh();
    });

    panel.querySelector("#qr-brochure-upload")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      const status = panel.querySelector("#qr-brochure-status");
      if (!file || !window.WSConfig?.saveUpload) return;
      status.textContent = "Uploading…";
      try {
        const uploaded = await WSConfig.saveUpload(file);
        const meta = { id: uploaded.id, name: file.name, uploadRef: uploaded.ref, createdAt: Date.now() };
        const list = loadBrochureMeta();
        list.unshift(meta);
        saveBrochureMeta(list);
        selectedBrochureId = meta.id;
        status.textContent = "";
        refreshBrochurePickSelect();
      } catch (err) {
        status.textContent = err.message || "Upload failed";
        status.style.color = "var(--rust)";
      }
      e.target.value = "";
    });

    panel.querySelector("#qr-brochure-pick")?.addEventListener("change", (e) => {
      selectedBrochureId = e.target.value;
      scheduleBrochurePreview();
    });

    panel.querySelector("#qr-brochure-code")?.addEventListener("change", () => {
      scheduleBrochurePreview();
    });

    panel.querySelector("#qr-brochure-position-grid")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-position]");
      if (!btn) return;
      brochurePosition = btn.dataset.position;
      panel.querySelectorAll(".admin-qr-position-btn").forEach((b) => {
        b.classList.toggle("is-active", b.dataset.position === brochurePosition);
      });
      scheduleBrochurePreview();
    });

    panel.querySelector("#qr-brochure-size")?.addEventListener("input", (e) => {
      brochureSizePct = Number(e.target.value) || 16;
      panel.querySelector("#qr-brochure-size-label").textContent = `${brochureSizePct}%`;
      scheduleBrochurePreview();
    });

    panel.querySelector("#qr-brochure-delete")?.addEventListener("click", () => {
      saveBrochureMeta(loadBrochureMeta().filter((b) => b.id !== selectedBrochureId));
      selectedBrochureId = loadBrochureMeta()[0]?.id || "";
      lastBrochureBlob = null;
      refreshBrochurePickSelect();
    });

    panel.querySelector("#qr-brochure-download")?.addEventListener("click", async () => {
      const status = panel.querySelector("#qr-brochure-status");
      const code = findCode(panel.querySelector("#qr-brochure-code")?.value || activeId);
      if (!code) {
        status.textContent = "Select a QR code.";
        status.style.color = "var(--rust)";
        return;
      }
      const btn = panel.querySelector("#qr-brochure-download");
      btn.disabled = true;
      try {
        if (!lastBrochureBlob) await updateBrochurePreview();
        if (!lastBrochureBlob) throw new Error("Upload a brochure first.");
        await downloadBlob(lastBrochureBlob, assetFilename(code, "brochure"));
        status.textContent = "Downloaded.";
        status.style.color = "var(--sage)";
      } catch (err) {
        status.textContent = err.message || "Download failed";
        status.style.color = "var(--rust)";
      } finally {
        btn.disabled = false;
      }
    });

    setCreateType("event");
    populateCampaignSelect();
    refresh();
    refreshBrochurePickSelect();
    applyQrPrefill();
  }

  return {
    render,
    trackUrl,
    getQrApiUrl,
    buildOfferUrl,
    buildEventUrl,
    PRESETS,
  };
})();
