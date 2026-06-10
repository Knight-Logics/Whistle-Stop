/* Whistle Stop — Social Media Manager (admin composer + bridge client) */
window.WSSocial = (function () {
  const LOCAL_BRIDGE = "http://127.0.0.1:8787";
  const CLOUD_BRIDGE = "https://knightlogics.com/api/whistle-stop-social";
  // Baked into GitHub Pages admin so every device works without per-browser API key setup.
  const CLOUD_BRIDGE_API_KEY = "ws-whistlestop-9611b65b47f34c8a9d297daaa119620e";
  const CLOUD_MEDIA_MAX_BYTES = 3.5 * 1024 * 1024;
  const LOCAL_MEDIA_MAX_BYTES = 12 * 1024 * 1024;

  const PLATFORM_ICONS = {
    facebook: "f",
    instagram: "ig",
    x: "𝕏",
    linkedin: "in",
    gbp: "G",
    tiktok: "♪",
    youtube: "▶",
    nextdoor: "N",
  };

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bridgeUrl(config) {
    const fromConfig = String(config?.bridgeUrl || "").trim().replace(/\/$/, "");
    if (isHttpsAdmin()) {
      if (fromConfig && !isLocalBridge(fromConfig)) return fromConfig;
      return CLOUD_BRIDGE;
    }
    return fromConfig || LOCAL_BRIDGE;
  }

  function normalizeCloudBridgeConfig(config) {
    if (!config || !isHttpsAdmin()) return config;
    const resolved = bridgeUrl(config);
    if (config.bridgeUrl !== resolved || isLocalBridge(config.bridgeUrl || "")) {
      config.bridgeUrl = resolved;
      if (window.WSConfig) {
        WSConfig.save("socialManager", { bridgeUrl: resolved, bridgeApiKey: config.bridgeApiKey || "" });
      }
    }
    return config;
  }

  function isLocalBridge(base) {
    return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(base);
  }

  function bridgeRoutes(config) {
    const base = bridgeUrl(config);
    if (!isLocalBridge(base)) {
      return {
        health: `${base}/health`,
        platforms: `${base}/platforms`,
        post: `${base}/post`,
        history: `${base}/history`,
      };
    }
    return {
      health: `${base}/health`,
      platforms: `${base}/api/platforms`,
      post: `${base}/api/post`,
      history: `${base}/api/history`,
    };
  }

  function sanitizeBridgeApiKey(value) {
    return String(value ?? "")
      .replace(/^\uFEFF/, "")
      .replace(/[^\x20-\x7E]/g, "")
      .trim();
  }

  function resolveBridgeApiKey(config) {
    const saved = sanitizeBridgeApiKey(config?.bridgeApiKey);
    if (saved) return saved;
    if (isHttpsAdmin()) return CLOUD_BRIDGE_API_KEY;
    return "";
  }

  function bridgeAuthReady(config) {
    if (resolveBridgeApiKey(config)) return true;
    if (window.WSConfig?.getAdminAuthHash?.()) return true;
    return false;
  }

  function bridgeHeaders(config, json = true) {
    const headers = {};
    if (json) headers["Content-Type"] = "application/json";
    const apiKey = resolveBridgeApiKey(config);
    if (apiKey) headers["X-WS-Social-Key"] = apiKey;
    return headers;
  }

  function withBridgeAuth(config, payload) {
    const out = { ...payload };
    if (resolveBridgeApiKey(config)) return out;
    const adminHash = window.WSConfig?.getAdminAuthHash?.();
    if (adminHash) out.adminPasswordHash = adminHash;
    return out;
  }

  function isHttpsAdmin() {
    return window.location.protocol === "https:";
  }

  const LOCAL_ADMIN_URL = "http://127.0.0.1:8080/admin.html";

  async function pingBridge(config) {
    const base = bridgeUrl(config);
    if (isHttpsAdmin() && isLocalBridge(base)) {
      return { online: false, blocked: true, reason: "mixed_content" };
    }
    try {
      const res = await fetch(bridgeRoutes(config).health, { cache: "no-store" });
      if (!res.ok) return { online: false };
      const data = await res.json();
      return { online: true, ...data };
    } catch {
      return { online: false };
    }
  }

  async function fetchPlatforms(config) {
    const res = await fetch(bridgeRoutes(config).platforms, { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load platforms from bridge");
    return res.json();
  }

  async function postToBridge(config, payload) {
    const url = bridgeRoutes(config).post;
    const authPayload = withBridgeAuth(config, payload);
    const body = JSON.stringify(authPayload);
    const debug = {
      url,
      textLen: String(payload.text || "").length,
      platforms: payload.platforms || [],
      mediaChars: payload.mediaBase64 ? String(payload.mediaBase64).length : 0,
      bodyBytes: body.length,
      auth: resolveBridgeApiKey(config) ? "api-key" : window.WSConfig?.getAdminAuthHash?.() ? "admin-login" : "none",
    };
    console.info("[WSSocial] posting", debug);

    const res = await fetch(url, {
      method: "POST",
      headers: bridgeHeaders(config),
      body,
    });
    let data = {};
    try {
      data = await res.json();
    } catch (parseErr) {
      console.error("[WSSocial] non-JSON response", { status: res.status, url, parseErr });
      throw new Error(`Bridge returned ${res.status} without JSON. Check URL: ${url}`);
    }

    if (!res.ok || data.ok === false) {
      console.error("[WSSocial] post failed", { status: res.status, debug, response: data });
      const detail = data.debug ? ` (${JSON.stringify(data.debug)})` : "";
      throw new Error((data.error || `Post failed (${res.status})`) + detail);
    }
    console.info("[WSSocial] post ok", { results: data.results });
    return data;
  }

  async function fetchBridgeHistory(config) {
    try {
      const res = await fetch(bridgeRoutes(config).history, { cache: "no-store" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.history || [];
    } catch {
      return [];
    }
  }

  const DEFAULT_ACCESS_NOTES = {
    facebook: {
      now: "Posts through Knight Logics Facebook Page (demo on this PC).",
      pending: "Whistle Stop Page authorization — then posts go to their Facebook Page.",
    },
    x: {
      now: "Posts through @KnightLogics (demo on this PC).",
      pending: "Whistle Stop X account API keys — then posts go to their profile.",
    },
    instagram: {
      now: "Cannot post from here yet.",
      pending: "Meta Business verification + Instagram linked to Whistle Stop Facebook Page.",
    },
    gbp: {
      now: "Text + post type saved to a manual queue; paste into Google Business Profile.",
      pending:
        "Google OAuth (business.manage) — updates, events & offers auto-publish with 1 still photo each. GIFs: static image only via API. Videos: dashboard only, not API.",
    },
    linkedin: {
      now: "Paused — not posting.",
      pending: "LinkedIn company page access for Whistle Stop.",
    },
    tiktok: { now: "Not connected.", pending: "TikTok Business API authorization." },
    youtube: { now: "Not connected.", pending: "YouTube channel + Community tab API access." },
    nextdoor: {
      now: "Not connected.",
      pending: "Nextdoor Business account link (may stay manual — limited API).",
    },
  };

  function accessState(connection) {
    const map = {
      demo_ready: { label: "Demo — works now", cls: "is-demo" },
      ready: { label: "Connected", cls: "is-live" },
      manual_queue: { label: "Manual queue", cls: "is-gbp" },
      needs_login: { label: "Needs login", cls: "is-warn" },
      paused: { label: "Paused", cls: "is-warn" },
      not_wired: { label: "Not available", cls: "is-off" },
    };
    return map[connection] || { label: connection || "Unknown", cls: "is-off" };
  }

  function renderAccessNoticeHtml(platforms, accessNotes) {
    const notes = { ...DEFAULT_ACCESS_NOTES, ...(accessNotes || {}) };
    if (!platforms?.length) {
      return `<p class="social-access-empty">Start the local bridge to see per-platform access status.</p>`;
    }
    return `<ul class="social-access-list">
      ${platforms
        .map((p) => {
          const note = notes[p.id] || {};
          const state = accessState(p.connection);
          const now = note.now || p.limitation || "Status unknown.";
          const pending = note.pending || "";
          return `<li class="social-access-item">
            <div class="social-access-item-head">
              <strong>${esc(p.label)}</strong>
              <span class="social-access-state ${state.cls}">${esc(state.label)}</span>
            </div>
            <p class="social-access-now"><span>Now:</span> ${esc(now)}</p>
            ${pending ? `<p class="social-access-pending"><span>Until authorized:</span> ${esc(pending)}</p>` : ""}
          </li>`;
        })
        .join("")}
    </ul>`;
  }

  function connectionBadge(connection) {
    const map = {
      demo_ready: { label: "Demo ready", cls: "is-demo" },
      ready: { label: "Connected", cls: "is-live" },
      needs_login: { label: "Needs login", cls: "is-warn" },
      paused: { label: "Paused", cls: "is-warn" },
      manual_queue: { label: "Manual queue", cls: "is-gbp" },
      not_wired: { label: "Not wired", cls: "is-off" },
    };
    const m = map[connection] || { label: connection || "Unknown", cls: "is-off" };
    return `<span class="social-platform-badge ${m.cls}">${esc(m.label)}</span>`;
  }

  function platformCard(p, checked) {
    const icon = PLATFORM_ICONS[p.id] || "•";
    const limit = p.charLimit ? `${p.charLimit.toLocaleString()} char max` : "";
    const note = p.limitation ? `<p class="social-platform-note">${esc(p.limitation)}</p>` : "";
    const muted = p.connection === "not_wired";
    return `
      <label class="social-platform-card${checked ? " is-selected" : ""}${muted ? " is-muted" : ""}">
        <input type="checkbox" name="social-platform" value="${esc(p.id)}" ${checked ? "checked" : ""} />
        <span class="social-platform-icon" aria-hidden="true">${icon}</span>
        <span class="social-platform-body">
          <strong>${esc(p.label)}</strong>
          ${connectionBadge(p.connection)}
          ${limit ? `<span class="social-platform-limit">${limit}</span>` : ""}
          ${note}
        </span>
      </label>`;
  }

  function previewMediaHtml(mediaUrl, mediaType) {
    if (!mediaUrl) return "";
    if (mediaType?.startsWith("video/")) {
      return `<div class="social-preview-media"><video src="${mediaUrl}" controls muted playsinline></video></div>`;
    }
    return `<div class="social-preview-media"><img src="${mediaUrl}" alt="" /></div>`;
  }

  function previewPlatformBody(panel, platformId, text, mediaUrl, businessName, mediaType) {
    const body = text.trim()
      ? esc(text).replace(/\n/g, "<br>")
      : '<span class="social-preview-placeholder">Your message will appear here…</span>';
    const img = previewMediaHtml(mediaUrl, mediaType);

    if (platformId === "x") {
      return `
        <div class="social-preview-x">
          <div class="social-preview-x-head">
            <span class="social-preview-avatar">WS</span>
            <div>
              <strong>${esc(businessName)}</strong>
              <span>@whistlestop_grill</span>
            </div>
          </div>
          <p class="social-preview-text">${body}</p>
          ${img}
        </div>`;
    }

    if (platformId === "instagram") {
      return `
        <div class="social-preview-ig">
          ${img || '<div class="social-preview-media social-preview-media--empty">Photo</div>'}
          <p class="social-preview-text">${body}</p>
        </div>`;
    }

    if (platformId === "gbp") {
      const cta = panel.querySelector("#social-gbp-cta")?.value;
      const ctaLabel =
        panel.querySelector("#social-gbp-cta option:checked")?.textContent?.trim() || "";
      const topic =
        panel.querySelector("#social-gbp-topic option:checked")?.textContent?.trim() ||
        "Update";
      return `
        <div class="social-preview-gbp">
          <div class="social-preview-gbp-brand">
            <span class="social-preview-avatar social-preview-avatar--gbp">G</span>
            <div>
              <strong>${esc(businessName)}</strong>
              <span>${esc(topic)}</span>
            </div>
          </div>
          ${img}
          <p class="social-preview-text">${body}</p>
          ${cta && ctaLabel && ctaLabel !== "None" ? `<span class="social-preview-cta">${esc(ctaLabel)}</span>` : ""}
        </div>`;
    }

    if (platformId === "linkedin") {
      return `
        <div class="social-preview-li">
          <div class="social-preview-li-head">
            <span class="social-preview-avatar">WS</span>
            <strong>${esc(businessName)}</strong>
          </div>
          <p class="social-preview-text">${body}</p>
          ${img}
        </div>`;
    }

    return `
      <div class="social-preview-fb">
        <div class="social-preview-fb-head">
          <span class="social-preview-avatar">WS</span>
          <div>
            <strong>${esc(businessName)}</strong>
            <span>Just now · 🌐</span>
          </div>
        </div>
        <p class="social-preview-text">${body}</p>
        ${img}
      </div>`;
  }

  function resultRow(r) {
    const status = r.status || "unknown";
    const cls =
      status === "ok"
        ? "is-ok"
        : status === "queued_manual"
          ? "is-gbp"
          : status === "skipped" || status === "not_wired"
            ? "is-warn"
            : "is-error";
    const detail = r.message || r.error || "";
    return `
      <li class="social-result-row ${cls}">
        <strong>${esc(r.label || r.platform)}</strong>
        <span>${esc(status.replace(/_/g, " "))}</span>
        ${detail ? `<p>${esc(detail)}</p>` : ""}
      </li>`;
  }

  function renderAdmin(panel, config, site) {
    config = normalizeCloudBridgeConfig(config);
    const links = { ...(site?.social || {}), ...(config?.socialLinks || {}) };
    let platforms = [];
    let bridgeOnline = false;
    let gbpLimits = null;
    let mediaDataUrl = "";
    let mediaFileType = "";

    panel.innerHTML = `
      <p class="admin-note">
        Compose once for <strong>Facebook, X, Google Business Profile, and more</strong>. Pick platforms on the right; expand <strong>Access &amp; limitations</strong> if you need platform authorization details.
        On GitHub Pages / any device: posts go through the <strong>cloud bridge</strong> on knightlogics.com after you log in. Local bridge is only for demos on this PC.
      </p>
      <div class="admin-social-bridge-status" id="social-bridge-status" aria-live="polite">Checking cloud bridge…</div>
      <details class="admin-details social-bridge-settings" id="social-bridge-settings">
        <summary><strong>Posting connection</strong> <span class="social-gbp-summary-hint">— optional; cloud works after admin login on any device</span></summary>
        <div class="admin-form-grid cols-2" style="margin-top:0.75rem">
          <div class="admin-field admin-field--full">
            <label>Bridge URL</label>
            <input type="url" id="social-bridge-url" value="${esc(bridgeUrl(config))}" placeholder="https://knightlogics.com/api/whistle-stop-social" />
            <p class="social-field-hint">GitHub Pages admin: use Vercel URL above. Local demo: <code>http://127.0.0.1:8787</code></p>
          </div>
          <div class="admin-field admin-field--full">
            <label>API key (Vercel only)</label>
            <input type="password" id="social-bridge-api-key" value="${esc(sanitizeBridgeApiKey(config.bridgeApiKey || ""))}" placeholder="Paste ws-whistlestop-… key only" autocomplete="off" />
            <p class="social-field-hint">Optional override. Cloud posting is automatic on GitHub Pages — leave blank on new devices.</p>
          </div>
        </div>
        <button type="button" class="btn btn-outline admin-btn-sm" id="social-bridge-save">Save connection</button>
      </details>
      <details class="admin-details social-access-notice" id="social-access-notice" aria-label="Platform access and limitations">
        <summary class="social-access-notice-head">
          <strong>Access &amp; limitations</strong>
          <span>What works now · what we need from each platform</span>
        </summary>
        <div id="social-access-list">${renderAccessNoticeHtml([], config.accessNotes)}</div>
      </details>
      <div class="admin-page-split admin-social-split">
        <div class="admin-editor-col">
          <div class="admin-card admin-social-compose-card">
            <h3>Compose post</h3>
            <div class="admin-social-compose-layout">
              <div class="social-compose-message admin-field">
                <label>Message</label>
                <textarea id="social-post-text" rows="6" placeholder="Tonight: live music on the patio from 6:30 PM…"></textarea>
              </div>
              <div class="social-compose-media admin-field">
                <label>Photo, GIF, or video (optional)</label>
                <input type="file" id="social-post-media" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,video/x-m4v" />
                <p class="social-field-hint" id="social-media-hint">JPG, PNG, WebP, GIF, MP4, MOV, WebM. Cloud bridge: keep under ~3.5 MB. Facebook &amp; X accept all types; Google queue saves stills only (no video via API).</p>
                <div class="social-media-thumb" id="social-media-thumb" hidden>
                  <img id="social-media-thumb-img" alt="Attached media preview" hidden />
                  <video id="social-media-thumb-video" controls muted playsinline hidden></video>
                  <button type="button" class="btn btn-outline admin-btn-sm" id="social-media-clear">Remove attachment</button>
                </div>
              </div>
              <details class="social-compose-gbp admin-details social-gbp-details" id="social-gbp-options">
                <summary><strong>Google Business Profile options</strong> <span class="social-gbp-summary-hint">— same “post,” different type on Google</span></summary>
                <div class="admin-form-grid cols-2" style="margin-top:0.75rem">
                  <div class="admin-field">
                    <label>Google post type</label>
                    <select id="social-gbp-topic">
                      <option value="STANDARD">Update (news / announcement)</option>
                      <option value="EVENT">Event (shows on Maps with date)</option>
                      <option value="OFFER">Offer (promo / special)</option>
                    </select>
                  </div>
                  <div class="admin-field">
                    <label>Button (optional)</label>
                    <select id="social-gbp-cta">
                      <option value="">None</option>
                      <option value="LEARN_MORE">Learn more</option>
                      <option value="BOOK">Book</option>
                      <option value="ORDER">Order online</option>
                      <option value="CALL">Call</option>
                    </select>
                  </div>
                  <div class="admin-field">
                    <label>Button URL</label>
                    <input type="url" id="social-gbp-cta-url" placeholder="https://www.whistlestopgrill.com/..." />
                  </div>
                </div>
                <p class="social-field-hint" id="social-gbp-limit-note"></p>
                <aside class="social-compose-pages social-compose-pages--nested" aria-label="Your social pages">
                  <h4 class="social-compose-pages-title">Your social pages</h4>
                  <ul class="social-links-list social-links-list--inline">
                    ${Object.entries(links)
                      .map(
                        ([k, url]) =>
                          `<li><strong>${esc(k)}</strong> <a href="${esc(url)}" target="_blank" rel="noopener" title="${esc(url)}">${esc(url)}</a></li>`
                      )
                      .join("")}
                  </ul>
                </aside>
              </details>
              <div class="social-compose-actions admin-social-actions">
                <button type="button" class="btn btn-primary" id="social-post-btn">Post now</button>
                <span class="social-char-count" id="social-char-count">0 characters</span>
              </div>
              <div id="social-post-results" class="social-post-results social-compose-results" hidden></div>
              <section class="social-compose-preview" aria-label="Post preview">
                <div class="social-compose-preview-head">
                  <h4>Post preview</h4>
                  <span class="social-compose-preview-hint">Updates as you type · one card per selected platform</span>
                </div>
                <div id="social-post-preview" class="social-post-preview-track"></div>
              </section>
            </div>
          </div>
        </div>
        <div class="admin-preview-col">
          <p class="admin-preview-label">Platforms</p>
          <p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 0.75rem">Select where this post should go. Status reflects the local posting bridge on your computer.</p>
          <div id="social-platform-grid" class="social-platform-grid">
            <p style="color:var(--text-muted)">Loading platforms…</p>
          </div>
          <div class="admin-card" style="margin-top:1rem">
            <h3>Recent posts</h3>
            <div id="social-history" class="social-history"><p style="color:var(--text-muted)">No posts yet.</p></div>
          </div>
        </div>
      </div>`;

    const textEl = panel.querySelector("#social-post-text");
    const countEl = panel.querySelector("#social-char-count");
    const gridEl = panel.querySelector("#social-platform-grid");
    const statusEl = panel.querySelector("#social-bridge-status");
    const historyEl = panel.querySelector("#social-history");
    const resultsEl = panel.querySelector("#social-post-results");
    const mediaInput = panel.querySelector("#social-post-media");
    const mediaHint = panel.querySelector("#social-media-hint");
    const mediaThumb = panel.querySelector("#social-media-thumb");
    const mediaThumbImg = panel.querySelector("#social-media-thumb-img");
    const mediaThumbVideo = panel.querySelector("#social-media-thumb-video");
    const gbpNote = panel.querySelector("#social-gbp-limit-note");
    const accessListEl = panel.querySelector("#social-access-list");
    const previewEl = panel.querySelector("#social-post-preview");
    const businessName = config.clientName || site?.business?.name || "Whistle Stop Grill & Bar";

    function getSelectedPlatforms() {
      return [...panel.querySelectorAll('input[name="social-platform"]:checked')].map((el) => el.value);
    }

    function updateCharCount() {
      const n = (textEl?.value || "").length;
      if (countEl) countEl.textContent = `${n.toLocaleString()} characters`;
    }

    function updatePreview() {
      if (!previewEl) return;
      const text = textEl?.value || "";
      const selected = getSelectedPlatforms();
      const ids = selected.length ? selected : ["facebook", "x", "gbp"];

      previewEl.innerHTML = ids
        .map((id) => {
          const plat = platforms.find((p) => p.id === id);
          const label = plat?.label || id;
          const icon = PLATFORM_ICONS[id] || "•";
          return `
            <article class="social-preview-card social-preview-card--${esc(id)}">
              <header class="social-preview-card-label">
                <span aria-hidden="true">${icon}</span>
                ${esc(label)}
              </header>
              ${previewPlatformBody(panel, id, text, mediaDataUrl, businessName, mediaFileType)}
            </article>`;
        })
        .join("");
    }

    function renderAccessNotice() {
      if (accessListEl) {
        accessListEl.innerHTML = renderAccessNoticeHtml(platforms, config.accessNotes);
      }
    }

    function renderPlatformGrid() {
      renderAccessNotice();
      if (!platforms.length) {
        gridEl.innerHTML = `<p class="social-offline-msg">Bridge offline — start <code>run_bridge.ps1</code> to see live platform status. You can still compose; posts will be simulated locally.</p>`;
        return;
      }
      const defaults = new Set(["facebook", "x", "gbp"]);
      gridEl.innerHTML = platforms.map((p) => platformCard(p, defaults.has(p.id))).join("");
      gridEl.querySelectorAll(".social-platform-card input").forEach((input) => {
        input.addEventListener("change", () => {
          input.closest(".social-platform-card")?.classList.toggle("is-selected", input.checked);
          updatePreview();
        });
      });
      updatePreview();
    }

    function renderHistory(items) {
      if (!items?.length) {
        historyEl.innerHTML = `<p style="color:var(--text-muted)">No posts yet.</p>`;
        return;
      }
      historyEl.innerHTML = items
        .slice(0, 12)
        .map(
          (h) => `
        <article class="social-history-item">
          <time>${esc(new Date(h.createdAt).toLocaleString())}</time>
          <p>${esc(h.text)}</p>
          <div class="social-history-tags">${(h.platforms || [])
            .map((p) => `<span>${esc(p)}</span>`)
            .join("")}</div>
        </article>`
        )
        .join("");
    }

    async function refreshBridge() {
      const health = await pingBridge(config);
      bridgeOnline = health.online;
      if (statusEl) {
        statusEl.className = `admin-social-bridge-status ${bridgeOnline ? "is-online" : "is-offline"}`;
        if (bridgeOnline) {
          const isCloud = !isLocalBridge(bridgeUrl(config));
          const canPost = bridgeAuthReady(config);
          const keyNote =
            isCloud && !canPost
              ? ` Log into admin to post from this device (or save an optional API key under Posting connection).`
              : "";
          statusEl.innerHTML = isCloud
            ? `<strong>Cloud bridge online.</strong> Facebook &amp; X via Graph/X API on Vercel (demo Knight Logics accounts).${keyNote}`
            : `<strong>Local bridge online.</strong> Facebook &amp; X post live (demo accounts). GBP saves to manual queue until Google is connected.`;
        } else if (health.blocked && health.reason === "mixed_content") {
          statusEl.innerHTML = `<strong>Local bridge blocked on HTTPS.</strong> GitHub Pages admin should use the Vercel cloud bridge (<code>bridgeUrl</code> in social settings). For Playwright demo, use <a href="${LOCAL_ADMIN_URL}" target="_blank" rel="noopener">${LOCAL_ADMIN_URL}</a> with <code>START-DEMO.ps1</code>.`;
        } else {
          const isCloud = !isLocalBridge(bridgeUrl(config));
          statusEl.innerHTML = isCloud
            ? `<strong>Cloud bridge offline.</strong> Deploy <code>/api/whistle-stop-social</code> on Vercel and set env vars (see MainSite <code>api/whistle-stop-social.env.example</code>).`
            : `<strong>Bridge offline.</strong> Run <code>START-DEMO.ps1</code> or <code>WhistleStop\\run_bridge.ps1</code> on this PC, or switch <code>bridgeUrl</code> to the Vercel API.`;
        }
      }

      if (bridgeOnline) {
        try {
          const data = await fetchPlatforms(config);
          platforms = data.platforms || [];
          gbpLimits = data.gbpLimitations;
          if (gbpNote && gbpLimits) {
            gbpNote.textContent = `Until Google OAuth: queue only. After authorization: event/update/offer posts can include 1 still photo (JPG/PNG/WebP URL). GIFs won’t animate via API. Videos and multi-photo posts: use the Google Business Profile dashboard — not supported on local-post API.`;
          }
          renderPlatformGrid();
          const hist = await fetchBridgeHistory(config);
          renderHistory(hist);
        } catch (e) {
          gridEl.innerHTML = `<p class="social-offline-msg">${esc(e.message)}</p>`;
        }
      } else {
        platforms = [
          { id: "facebook", label: "Facebook", connection: "demo_ready", charLimit: 63206 },
          { id: "instagram", label: "Instagram", connection: "not_wired", limitation: "Meta API not wired" },
          { id: "x", label: "X (Twitter)", connection: "demo_ready", charLimit: 280 },
          { id: "linkedin", label: "LinkedIn", connection: "paused", charLimit: 3000 },
          {
            id: "gbp",
            label: "Google Business Profile",
            connection: "manual_queue",
            gbp: true,
            charLimit: 1500,
            limitation: "Queued for Google — paste or auto-post when OAuth is connected.",
          },
          { id: "tiktok", label: "TikTok", connection: "not_wired" },
          { id: "youtube", label: "YouTube Community", connection: "not_wired" },
          { id: "nextdoor", label: "Nextdoor", connection: "not_wired" },
        ];
        renderPlatformGrid();
        renderHistory(config.postHistory || []);
      }
    }

    function mediaMaxBytes(config) {
      return isLocalBridge(bridgeUrl(config)) ? LOCAL_MEDIA_MAX_BYTES : CLOUD_MEDIA_MAX_BYTES;
    }

    function setMediaPreview(url, fileName, fileType) {
      mediaDataUrl = url || "";
      mediaFileType = fileType || "";
      const isVideo = fileType?.startsWith("video/");
      if (mediaThumbImg) {
        if (url && !isVideo) {
          mediaThumbImg.src = url;
          mediaThumbImg.hidden = false;
        } else {
          mediaThumbImg.removeAttribute("src");
          mediaThumbImg.hidden = true;
        }
      }
      if (mediaThumbVideo) {
        if (url && isVideo) {
          mediaThumbVideo.src = url;
          mediaThumbVideo.hidden = false;
        } else {
          mediaThumbVideo.removeAttribute("src");
          mediaThumbVideo.hidden = true;
        }
      }
      if (mediaThumb) mediaThumb.hidden = !url;
      if (mediaHint) {
        if (!url) {
          mediaHint.textContent =
            "JPG, PNG, WebP, GIF, MP4, MOV, WebM. Cloud bridge: keep under ~3.5 MB. Facebook & X accept all types; Google queue saves stills only (no video via API).";
          mediaHint.classList.remove("is-warn");
        } else if (fileType?.startsWith("video/")) {
          mediaHint.textContent = `${fileName || "Video"} attached — posts to Facebook/X. GBP: upload video manually in Google (API cannot).`;
          mediaHint.classList.add("is-warn");
        } else if (fileType === "image/gif") {
          mediaHint.textContent = `${fileName || "GIF"} attached — animates on Facebook/X; Google gets a still image only.`;
          mediaHint.classList.remove("is-warn");
        } else {
          mediaHint.textContent = `${fileName || "Photo"} attached — posts to Facebook/X; saved with GBP queue for Google.`;
          mediaHint.classList.remove("is-warn");
        }
      }
      updatePreview();
    }

    mediaInput?.addEventListener("change", () => {
      const file = mediaInput.files?.[0];
      if (!file) {
        setMediaPreview("");
        return;
      }
      const maxBytes = mediaMaxBytes(config);
      if (file.size > maxBytes) {
        const maxMb = (maxBytes / (1024 * 1024)).toFixed(1);
        alert(`File is too large for this bridge (${maxMb} MB max). Use a smaller clip or switch to the local bridge for bigger files.`);
        mediaInput.value = "";
        setMediaPreview("");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setMediaPreview(String(reader.result || ""), file.name, file.type);
      reader.readAsDataURL(file);
    });

    panel.querySelector("#social-media-clear")?.addEventListener("click", () => {
      if (mediaInput) mediaInput.value = "";
      setMediaPreview("");
    });

    ["#social-gbp-topic", "#social-gbp-cta", "#social-gbp-cta-url"].forEach((sel) => {
      panel.querySelector(sel)?.addEventListener("change", updatePreview);
      panel.querySelector(sel)?.addEventListener("input", updatePreview);
    });

    textEl?.addEventListener("input", () => {
      updateCharCount();
      updatePreview();
    });
    updateCharCount();
    updatePreview();

    panel.querySelector("#social-post-btn")?.addEventListener("click", async () => {
      const text = textEl?.value?.trim() || "";
      const selected = [...panel.querySelectorAll('input[name="social-platform"]:checked')].map(
        (el) => el.value
      );
      if (!text) {
        alert("Write a message first.");
        return;
      }
      if (!selected.length) {
        alert("Select at least one platform.");
        return;
      }
      if (bridgeOnline && !isLocalBridge(bridgeUrl(config)) && !bridgeAuthReady(config)) {
        alert("Log into Whistle Stop admin to post from this device (cloud bridge uses your admin login).");
        return;
      }

      const btn = panel.querySelector("#social-post-btn");
      btn.disabled = true;
      btn.textContent = "Posting…";
      resultsEl.hidden = false;
      resultsEl.innerHTML = `<p>Working…</p>`;

      const payload = {
        text,
        platforms: selected,
        mediaBase64: mediaDataUrl || "",
        gbp: {
          topicType: panel.querySelector("#social-gbp-topic")?.value || "STANDARD",
          callToAction: panel.querySelector("#social-gbp-cta")?.value || null,
          callToActionUrl: panel.querySelector("#social-gbp-cta-url")?.value?.trim() || null,
        },
      };

      try {
        let results;
        if (bridgeOnline) {
          const data = await postToBridge(config, payload);
          results = data.results || [];
          config.postHistory = [data.entry, ...(config.postHistory || [])].slice(0, 50);
          if (window.WSConfig) WSConfig.save("socialManager", config);
          renderHistory(await fetchBridgeHistory(config));
        } else {
          results = selected.map((pid) => {
            const p = platforms.find((x) => x.id === pid);
            if (pid === "gbp") {
              return {
                platform: pid,
                label: "Google Business Profile",
                status: "queued_manual",
                message: "Simulated — start bridge to save GBP queue file.",
              };
            }
            if (p?.connection === "not_wired") {
              return { platform: pid, label: p.label, status: "not_wired", error: "Not connected" };
            }
            return {
              platform: pid,
              label: p?.label || pid,
              status: "simulated",
              message: "Bridge offline — demo only",
            };
          });
          const entry = {
            id: `local_${Date.now()}`,
            createdAt: new Date().toISOString(),
            text: text.slice(0, 500),
            platforms: selected,
            results,
          };
          config.postHistory = [entry, ...(config.postHistory || [])].slice(0, 50);
          if (window.WSConfig) WSConfig.save("socialManager", config);
          renderHistory(config.postHistory);
        }

        resultsEl.innerHTML = `
          <h4>Results</h4>
          <ul class="social-results-list">${results.map(resultRow).join("")}</ul>`;
        textEl.value = "";
        if (mediaInput) mediaInput.value = "";
        setMediaPreview("");
        updateCharCount();
      } catch (err) {
        const isCloud = bridgeOnline && !isLocalBridge(bridgeUrl(config));
        const logHint = bridgeOnline
          ? isCloud
            ? `<p class="social-field-hint">Cloud bridge error — hard-refresh admin, confirm you are logged in, and try a smaller image if attached. Open browser DevTools (F12) → Console for <code>[WSSocial]</code> logs.</p>`
            : `<p class="social-field-hint">Check bridge log: <code>E:\\KnightLogics-Growth-System\\Social\\WhistleStop\\logs\\bridge.log</code></p>`
          : "";
        resultsEl.innerHTML = `<p class="social-error">${esc(err.message)}</p>${logHint}`;
      } finally {
        btn.disabled = false;
        btn.textContent = "Post now";
      }
    });

    panel.querySelector("#social-bridge-save")?.addEventListener("click", () => {
      const url = panel.querySelector("#social-bridge-url")?.value?.trim();
      const rawKey = panel.querySelector("#social-bridge-api-key")?.value || "";
      const key = sanitizeBridgeApiKey(rawKey);
      if (rawKey && key !== rawKey.trim()) {
        alert(
          "API key had invisible or special characters (often from copying the label line in the key file). Only the ws-whistlestop-… line was saved."
        );
        const keyInput = panel.querySelector("#social-bridge-api-key");
        if (keyInput) keyInput.value = key;
      }
      if (url) {
        if (isHttpsAdmin() && isLocalBridge(url)) {
          alert("On GitHub Pages admin, use the cloud bridge URL (knightlogics.com). Local 127.0.0.1 only works on this PC over http://localhost.");
          config.bridgeUrl = CLOUD_BRIDGE;
        } else {
          config.bridgeUrl = url;
        }
      }
      config.bridgeApiKey = key;
      if (window.WSConfig) WSConfig.save("socialManager", config);
      refreshBridge();
    });

    refreshBridge();
  }

  return {
    renderAdmin,
    pingBridge,
    bridgeUrl,
  };
})();
