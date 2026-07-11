/* Whistle Stop — Social Media Manager (admin composer + bridge client) */
window.WSSocial = (function () {
  const LOCAL_BRIDGE = "http://127.0.0.1:8787";
  const CLOUD_BRIDGE = "https://knightlogics.com/api/whistle-stop-social";
  /** Main PC tunnel — browser reaches this directly when PC is on */
  const TUNNEL_BRIDGE = "https://ws-social.knightlogics.com";
  const LIVE_ADMIN_URL = "https://knight-logics.github.io/Whistle-Stop/admin.html";
  /** Fallback only when cloud cannot host attachment (no blob / no tunnel) */
  const GBP_DEMO_PHOTO_URL = "https://knightlogics.com/images/whistle-stop-pitch.jpg";
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

  /** When set, GitHub Pages admin talks directly to main-PC tunnel (full Playwright). */
  let activeBridgeOverride = "";

  function isTunnelBridge(base) {
    return String(base || "").replace(/\/$/, "") === TUNNEL_BRIDGE;
  }

  function bridgeUrl(config) {
    if (activeBridgeOverride) return activeBridgeOverride;
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

  function bridgeRoutes(config, { forPost = false } = {}) {
    const base = forPost && isHttpsAdmin() ? CLOUD_BRIDGE : bridgeUrl(config);
    if (isLocalBridge(base) || isTunnelBridge(base)) {
      return {
        health: `${base}/health`,
        platforms: `${base}/api/platforms`,
        preflight: `${base}/api/preflight`,
        logs: `${base}/api/logs`,
        post: `${base}/api/post`,
        history: `${base}/api/history`,
      };
    }
    return {
      health: `${base}/health`,
      platforms: `${base}/platforms`,
      preflight: `${base}/preflight`,
      logs: `${base}/logs`,
      post: `${base}/post`,
      history: `${base}/history`,
    };
  }

  function sanitizeBridgeApiKey(value) {
    return String(value ?? "")
      .replace(/^\uFEFF/, "")
      .replace(/[^\x20-\x7E]/g, "")
      .trim();
  }

  function resolveBridgeApiKey(config) {
    return sanitizeBridgeApiKey(config?.bridgeApiKey);
  }

  function bridgeAuthReady(config) {
    if (resolveBridgeApiKey(config)) return true;
    if (window.WSConfig?.getAdminAuthPayload?.()) return true;
    return false;
  }

  function bridgeAuthKind(config) {
    if (resolveBridgeApiKey(config)) return "api-key";
    const auth = window.WSConfig?.getAdminAuthPayload?.();
    if (auth?.adminPassword) return "admin-password";
    if (auth?.adminSessionHash) return "admin-session";
    return "none";
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
    const auth = window.WSConfig?.getAdminAuthPayload?.();
    if (auth) return { ...out, ...auth };
    return out;
  }

  function isHttpsAdmin() {
    return window.location.protocol === "https:";
  }

  const LOCAL_ADMIN_URL = "http://127.0.0.1:8080/admin.html";

  async function pingTunnelBridge() {
    try {
      const res = await fetch(`${TUNNEL_BRIDGE}/health`, { cache: "no-store" });
      if (!res.ok) return { online: false };
      const data = await res.json();
      return { online: true, via: "tunnel", remoteBridge: true, ...data };
    } catch {
      return { online: false };
    }
  }

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

  async function fetchPreflight(config) {
    try {
      const res = await fetch(bridgeRoutes(config).preflight, { cache: "no-store" });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  async function fetchBridgeLogs(config, tail = 60) {
    try {
      const res = await fetch(`${bridgeRoutes(config).logs}?tail=${tail}`, { cache: "no-store" });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  function renderPreflightHtml(preflight) {
    if (!preflight) {
      return `<p class="social-field-hint">Preflight unavailable — check bridge connection.</p>`;
    }
    const scopeOk = preflight.demoScope === "knight_logics_only";
    const fbMode = preflight.facebookMode || "unknown";
    const checks = preflight.checks || [];
    const targets = preflight.targets || [];
    const ready = preflight.readyForFullLiveTest ?? preflight.readyForLiveTest;
    return `
      <div class="social-preflight ${ready ? "is-ready" : "is-warn"}">
        <p class="social-preflight-head">
          <strong>${ready ? "Ready for live test" : "Not ready for full live test"}</strong>
          <span class="social-access-state ${scopeOk ? "is-demo" : "is-warn"}">${scopeOk ? "Knight Logics only" : "Scope error"}</span>
        </p>
        <p class="social-field-hint">Facebook mode: <code>${esc(fbMode)}</code>${fbMode === "browser_groups" ? " — page + community groups via Playwright" : ""}</p>
        <ul class="social-preflight-checks">
          ${checks
            .map(
              (c) =>
                `<li class="${c.ok ? "is-ok" : "is-warn"}"><span>${c.ok ? "✓" : "○"}</span> <strong>${esc(c.label)}</strong> — ${esc(c.detail || "")}</li>`
            )
            .join("")}
        </ul>
        ${
          targets.length
            ? `<p class="social-field-hint"><strong>Will post to:</strong> ${targets.map((t) => esc(t.label)).join(" · ")}</p>`
            : ""
        }
        ${preflight.logPath ? `<p class="social-field-hint">Bridge log: <code>${esc(preflight.logPath)}</code></p>` : ""}
      </div>`;
  }

  function confirmLivePost(selected, preflight) {
    const names = (preflight?.targets || [])
      .filter((t) => selected.includes(t.platform))
      .map((t) => t.label);
    const fbMode = preflight?.facebookMode || "";
    const fbNote =
      selected.includes("facebook") && String(fbMode).includes("browser_groups")
        ? "\n\nFacebook will use Playwright to share to Knight Logics community groups (same as Knight Command Social Poster)."
        : selected.includes("facebook")
          ? "\n\nFacebook will post to the Knight Logics Page only (Graph API — no groups)."
          : "";
    const list = names.length ? names.join("\n• ", "• ") : selected.join(", ");
    return window.confirm(
      `LIVE POST — Knight Logics accounts ONLY:\n\n• ${list}${fbNote}\n\nNo Knight Group, Screen Team, or Faith Works accounts.\n\nContinue?`
    );
  }

  function platformNeedsTunnel(platformId, preflight) {
    if (platformId === "linkedin" || platformId === "nextdoor") return true;
    const fbMode = String(preflight?.facebookMode || "").toLowerCase();
    if (platformId === "facebook" && fbMode === "browser_groups") return true;
    return false;
  }

  async function fetchPostUrl(url, config, payload) {
    const authPayload = withBridgeAuth(config, payload);
    const body = JSON.stringify(authPayload);
    const debug = {
      url,
      textLen: String(payload.text || "").length,
      platforms: payload.platforms || [],
      mediaChars: payload.mediaBase64 ? String(payload.mediaBase64).length : 0,
      bodyBytes: body.length,
      auth: bridgeAuthKind(config),
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

  async function postToBridge(config, payload, { tunnelOnline = false, preflight = null, platformCatalog = [], cloudRemoteBridge = false } = {}) {
    const selected = payload.platforms || [];
    const tunnelPlatforms = selected.filter((pid) => platformNeedsTunnel(pid, preflight));
    const cloudPlatforms = selected.filter((pid) => !platformNeedsTunnel(pid, preflight));
    const hostGuideUrl = "downloads/social-host.html";
    const tunnelOfflineMsg =
      `Playwright host offline. Graph platforms (Facebook Page / X / GBP) still work via cloud. For LinkedIn, Nextdoor, and Facebook groups: run the Social Host on any PC — see ${hostGuideUrl} (or START-HOST.ps1).`;

    // When Vercel can reach the host, send everything through cloud (best for guest WiFi).
    if (isHttpsAdmin() && cloudRemoteBridge) {
      const data = await fetchPostUrl(`${CLOUD_BRIDGE}/post`, config, payload);
      return {
        ok: true,
        entry:
          data.entry || {
            id: `post_${Date.now()}`,
            createdAt: new Date().toISOString(),
            text: String(payload.text || "").slice(0, 500),
            platforms: selected,
            results: data.results || [],
          },
        results: data.results || [],
      };
    }

    // Graph-only via cloud when no Playwright platforms selected
    if (isHttpsAdmin() && !tunnelPlatforms.length) {
      const data = await fetchPostUrl(`${CLOUD_BRIDGE}/post`, config, payload);
      return {
        ok: true,
        entry:
          data.entry || {
            id: `post_${Date.now()}`,
            createdAt: new Date().toISOString(),
            text: String(payload.text || "").slice(0, 500),
            platforms: selected,
            results: data.results || [],
          },
        results: data.results || [],
      };
    }

    const allResults = [];
    let entry = null;

    if (cloudPlatforms.length) {
      const data = await fetchPostUrl(`${CLOUD_BRIDGE}/post`, config, { ...payload, platforms: cloudPlatforms });
      allResults.push(...(data.results || []));
      entry = data.entry;
    }

    if (tunnelPlatforms.length) {
      if (!tunnelOnline) {
        tunnelPlatforms.forEach((pid) => {
          const plat = platformCatalog.find((x) => x.id === pid);
          allResults.push({
            platform: pid,
            label: plat?.label || pid,
            status: "error",
            error: tunnelOfflineMsg,
          });
        });
      } else {
        const data = await fetchPostUrl(`${TUNNEL_BRIDGE}/api/post`, config, {
          ...payload,
          platforms: tunnelPlatforms,
        });
        allResults.push(...(data.results || []));
        if (!entry) entry = data.entry;
      }
    }

    return {
      ok: true,
      entry:
        entry || {
          id: `post_${Date.now()}`,
          createdAt: new Date().toISOString(),
          text: String(payload.text || "").slice(0, 500),
          platforms: selected,
          results: allResults,
        },
      results: allResults,
    };
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
      now: "Live demo — posts to the Knight Logics Facebook Page only.",
      pending: "Whistle Stop Page authorization — then posts go to their Facebook Page.",
    },
    x: {
      now: "Live demo — posts to @KnightLogics only.",
      pending: "Whistle Stop X account API keys — then posts go to their profile.",
    },
    instagram: {
      now: "Cannot post from here yet.",
      pending: "Meta Business verification + Instagram linked to Whistle Stop Facebook Page.",
    },
    gbp: {
      now: "Live demo — Knight Logics Google listing. Your attached photo is hosted publicly for Google's API.",
      pending:
        "Whistle Stop Google OAuth — updates auto-publish to their Google listing.",
    },
    linkedin: {
      now: "Playwright — Knight Logics company page when START-PRESENTATION.ps1 is running (same Social Poster engine).",
      pending: "LinkedIn company page access for Whistle Stop.",
    },
    tiktok: { now: "Not connected.", pending: "TikTok Business API authorization." },
    youtube: { now: "Not connected.", pending: "YouTube channel + Community tab API access." },
    nextdoor: {
      now: "Playwright — Knight Logics Nextdoor page when START-PRESENTATION.ps1 is running.",
      pending: "Nextdoor Business account link for Whistle Stop.",
    },
  };

  function accessState(connection, platformId) {
    const playwright = platformId === "linkedin" || platformId === "nextdoor";
    const map = {
      demo_ready: { label: "Demo — works now", cls: "is-demo" },
      ready: { label: "Connected", cls: "is-live" },
      manual_queue: { label: "Manual queue", cls: "is-gbp" },
      needs_login: {
        label: playwright ? "Needs Playwright session" : "Needs login",
        cls: "is-warn",
      },
      paused: { label: "Paused", cls: "is-warn" },
      partial: { label: "Partially ready", cls: "is-warn" },
      needs_bridge: { label: "Needs presentation bridge", cls: "is-warn" },
      not_wired: { label: "Not available", cls: "is-off" },
    };
    return map[connection] || { label: connection || "Unknown", cls: "is-off" };
  }

  function renderAccessNoticeHtml(platforms, accessNotes) {
    const notes = { ...DEFAULT_ACCESS_NOTES, ...(accessNotes || {}) };
    if (!platforms?.length) {
      return `<p class="social-access-empty">Log into admin — platform status loads from the cloud bridge.</p>`;
    }
    return `<ul class="social-access-list">
      ${platforms
        .map((p) => {
          const note = notes[p.id] || {};
          const state = accessState(p.connection, p.id);
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

  function connectionBadge(connection, platformId) {
    const playwright = platformId === "linkedin" || platformId === "nextdoor";
    const map = {
      demo_ready: { label: "Demo ready", cls: "is-demo" },
      ready: { label: "Connected", cls: "is-live" },
      needs_login: {
        label: playwright ? "Playwright session" : "Needs login",
        cls: "is-warn",
      },
      paused: { label: "Paused", cls: "is-warn" },
      manual_queue: { label: "Manual queue", cls: "is-gbp" },
      partial: { label: "Partial", cls: "is-warn" },
      needs_bridge: { label: "Needs bridge", cls: "is-warn" },
      not_wired: { label: "Not wired", cls: "is-off" },
    };
    const m = map[connection] || { label: connection || "Unknown", cls: "is-off" };
    return `<span class="social-platform-badge ${m.cls}">${esc(m.label)}</span>`;
  }

  function platformCard(p, checked) {
    const icon = PLATFORM_ICONS[p.id] || "•";
    const limit = p.charLimit ? `${p.charLimit.toLocaleString()} char max` : "";
    const note = p.limitation ? `<p class="social-platform-note">${esc(p.limitation)}</p>` : "";
    const accountCount =
      p.demoAccountCount > 1
        ? `<span class="social-platform-limit">${p.demoAccountsReady ?? 0}/${p.demoAccountCount} accounts ready</span>`
        : "";
    const muted = p.connection === "not_wired";
    return `
      <label class="social-platform-card${checked ? " is-selected" : ""}${muted ? " is-muted" : ""}">
        <input type="checkbox" name="social-platform" value="${esc(p.id)}" ${checked ? "checked" : ""} ${muted ? "disabled" : ""} />
        <span class="social-platform-icon" aria-hidden="true">${icon}</span>
        <span class="social-platform-body">
          <strong>${esc(p.label)}</strong>
          ${connectionBadge(p.connection, p.id)}
          ${limit ? `<span class="social-platform-limit">${limit}</span>` : ""}
          ${accountCount}
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
    const detail = [r.message || r.error, r.method ? `method: ${r.method}` : "", r.runId ? `run: ${r.runId}` : "", r.sharedGroups ? `groups: ${r.sharedGroups}` : ""]
      .filter(Boolean)
      .join(" · ");
    const title = r.accountId && r.label ? r.label : r.label || r.platform;
    const sub =
      r.accountId && r.label && r.platform
        ? `<span class="social-result-account">${esc(r.platform)} · ${esc(r.accountId)}</span>`
        : "";
    return `
      <li class="social-result-row ${cls}">
        <strong>${esc(title)}</strong>${sub}
        <span>${esc(status.replace(/_/g, " "))}</span>
        ${detail ? `<p>${esc(detail)}</p>` : ""}
      </li>`;
  }

  function renderAdmin(panel, config, site) {
    config = normalizeCloudBridgeConfig(config);
    const links = { ...(site?.social || {}), ...(config?.socialLinks || {}) };
    let platforms = [];
    let bridgeOnline = false;
    let tunnelOnline = false;
    let cloudRemoteBridge = false;
    let gbpLimits = null;
    let mediaDataUrl = "";
    let mediaFileType = "";
    let preflightData = null;

    const HOST_MODAL_KEY = "ws-social-host-modal-dismissed";

    function maybeShowHostModal(force = false) {
      showSocialHostPackageModal({
        force,
        onRefresh: async () => {
          await refreshBridge();
        },
      });
    }

    if (!window.WSConfig?.canSocialPost?.()) {
      panel.innerHTML = `
        <p class="admin-note">Your account (<strong>${esc(window.WSConfig?.getSessionUser?.()?.username || "staff")}</strong>) can edit site content but cannot post to social. Ask an owner or editor.</p>`;
      return;
    }

    panel.innerHTML = `
      <p class="admin-note">
        Compose once for <strong>Facebook, X, LinkedIn, Nextdoor, and Google Business Profile</strong>.
        <strong>Live admin:</strong> <a href="${LIVE_ADMIN_URL}" target="_blank" rel="noopener">${LIVE_ADMIN_URL}</a>
        — Facebook Page / X / GBP work from any WiFi via cloud.
        LinkedIn / Nextdoor need a <a href="downloads/social-host.html" target="_blank" rel="noopener">Social Host</a>
        running on any PC (main PC or this laptop). Bookmark: <code>…/Whistle-Stop/admin.html</code> (not <code>/admin/</code>).
      </p>
      <div class="admin-social-bridge-status" id="social-bridge-status" aria-live="polite">Checking cloud bridge…</div>
      <details class="admin-details social-preflight-panel" id="social-preflight-panel" open>
        <summary><strong>Live test preflight</strong> <span class="social-gbp-summary-hint">— run before posting</span></summary>
        <div id="social-preflight-body" style="margin-top:0.75rem"><p class="social-field-hint">Loading…</p></div>
        <div class="social-compose-actions" style="margin-top:0.5rem">
          <button type="button" class="btn btn-outline admin-btn-sm" id="social-preflight-refresh">Re-run preflight</button>
          <button type="button" class="btn btn-outline admin-btn-sm" id="social-view-logs">View bridge logs</button>
        </div>
        <pre id="social-bridge-logs" class="social-bridge-logs" hidden></pre>
      </details>
      <details class="admin-details social-bridge-settings" id="social-bridge-settings">
        <summary><strong>Posting connection</strong> <span class="social-gbp-summary-hint">— optional; cloud works after admin login on any device</span></summary>
        <div class="admin-form-grid cols-2" style="margin-top:0.75rem">
          <div class="admin-field admin-field--full">
            <label>Bridge URL</label>
            <input type="url" id="social-bridge-url" value="${esc(bridgeUrl(config))}" placeholder="https://knightlogics.com/api/whistle-stop-social" />
            <p class="social-field-hint">Live site uses <code>knightlogics.com/api/whistle-stop-social</code> automatically. Local-only: <code>http://127.0.0.1:8787</code></p>
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
                <p class="social-field-hint" id="social-media-hint">JPG, PNG, WebP, GIF, MP4, MOV, WebM. Facebook, X, LinkedIn &amp; Nextdoor use your attachment. <strong>Google Business Profile</strong> uses a public JPG on knightlogics.com (Google cannot fetch local uploads).</p>
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
                <button type="button" class="btn btn-outline admin-btn-sm" id="social-load-demo">Load pitch demo</button>
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
          <p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 0.75rem">Demo mode posts to <strong>Knight Logics only</strong> (one account per platform).</p>
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
    const preflightEl = panel.querySelector("#social-preflight-body");
    const logsEl = panel.querySelector("#social-bridge-logs");
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

    function defaultSelectedPlatforms() {
      const ready = platforms.filter((p) =>
        ["demo_ready", "ready", "partial"].includes(p.connection)
      );
      return new Set((ready.length ? ready : platforms.filter((p) => p.connection !== "not_wired")).map((p) => p.id));
    }

    function renderPlatformGrid() {
      renderAccessNotice();
      if (!platforms.length) {
        gridEl.innerHTML = `<p class="social-offline-msg">Bridge offline — run <code>START-DEMO.ps1</code> or <code>WhistleStop\\run_bridge.ps1</code> to see live platform status.</p>`;
        return;
      }
      const defaults = defaultSelectedPlatforms();
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

    async function refreshPreflight() {
      if (preflightEl) {
        preflightEl.innerHTML = `<p class="social-field-hint">Running preflight…</p>`;
        preflightData = await fetchPreflight(config);
        preflightEl.innerHTML = renderPreflightHtml(preflightData);
      }
    }

    panel.querySelector("#social-preflight-refresh")?.addEventListener("click", () => refreshPreflight());
    panel.querySelector("#social-view-logs")?.addEventListener("click", async () => {
      if (!logsEl) return;
      logsEl.hidden = false;
      logsEl.textContent = "Loading logs…";
      const data = await fetchBridgeLogs(config, 80);
      if (!data?.lines?.length) {
        logsEl.textContent =
          data?.note ||
          "No log lines. Run START-PRESENTATION.ps1 — logs: E:\\KnightLogics-Growth-System\\Social\\WhistleStop\\logs\\bridge.log";
      } else {
        logsEl.textContent = data.lines.join("\n");
      }
    });

    async function refreshBridge() {
      activeBridgeOverride = "";
      tunnelOnline = false;
      cloudRemoteBridge = false;
      let health = { online: false };
      let browserTunnel = { online: false };

      if (isHttpsAdmin()) {
        health = await pingBridge(config);
        cloudRemoteBridge = Boolean(health.remoteBridge);
        browserTunnel = await pingTunnelBridge();
        tunnelOnline = cloudRemoteBridge || browserTunnel.online;
        bridgeOnline = health.online;
        if (browserTunnel.online && !cloudRemoteBridge) {
          // Browser can reach host even when Vercel cannot — use for Playwright posts.
          activeBridgeOverride = "";
        }
      } else {
        browserTunnel = await pingTunnelBridge();
        if (browserTunnel.online) {
          activeBridgeOverride = TUNNEL_BRIDGE;
          tunnelOnline = true;
          health = { ...browserTunnel, online: true };
        }
        if (!health.online) {
          health = await pingBridge(config);
        }
        bridgeOnline = health.online;
        cloudRemoteBridge = Boolean(health.remoteBridge);
      }

      const viaTunnel = isTunnelBridge(activeBridgeOverride);
      const remoteBridge = tunnelOnline || cloudRemoteBridge;
      const fullBridge = remoteBridge || health.service === "whistle-stop-social-proxy";
      if (statusEl) {
        statusEl.className = `admin-social-bridge-status ${bridgeOnline ? "is-online" : "is-offline"}`;
        if (bridgeOnline) {
          const isCloud = !isLocalBridge(bridgeUrl(config)) && !viaTunnel;
          const canPost = bridgeAuthReady(config);
          const keyNote =
            (isCloud || viaTunnel) && !canPost
              ? ` Log into admin to post from this device.`
              : "";
          const graphNote = " Facebook Page, X, and GBP work from any WiFi via cloud.";
          if (viaTunnel) {
            statusEl.innerHTML = `<strong>Playwright host online (direct tunnel).</strong> LinkedIn/Nextdoor use this PC's tunnel.${graphNote}${keyNote}`;
          } else if (isCloud && cloudRemoteBridge) {
            statusEl.innerHTML = `<strong>Cloud bridge online — full poster active.</strong> Main PC reachable via Vercel (guest WiFi OK).${keyNote}`;
          } else if (isCloud && browserTunnel.online) {
            statusEl.innerHTML = `<strong>Cloud + Playwright host online.</strong> Graph via cloud; LinkedIn/Nextdoor via tunnel from this browser.${keyNote}`;
          } else if (isCloud) {
            statusEl.innerHTML = `<strong>Cloud bridge online — Graph ready.</strong>${graphNote} LinkedIn/Nextdoor need a Social Host — <a href="downloads/social-host.html" target="_blank" rel="noopener">download &amp; run</a> or start the main PC host.${keyNote}`;
            maybeShowHostModal();
          } else {
            statusEl.innerHTML = `<strong>Local bridge online.</strong> Full Knight Logics poster on this PC.${keyNote}`;
          }
        } else if (health.blocked && health.reason === "mixed_content") {
          statusEl.innerHTML = `<strong>Local bridge blocked on HTTPS.</strong> Use the live admin at <a href="${LIVE_ADMIN_URL}" target="_blank" rel="noopener">${LIVE_ADMIN_URL}</a> — cloud bridge handles posting.`;
        } else {
          const isCloud = !isLocalBridge(bridgeUrl(config));
          statusEl.innerHTML = isCloud
            ? `<strong>Cloud bridge offline.</strong> Check Vercel, then <a href="downloads/social-host.html" target="_blank" rel="noopener">Social Host guide</a>.`
            : `<strong>Bridge offline.</strong> Run <code>START-HOST.ps1</code> or <code>START-DEMO.ps1</code> on this PC.`;
        }
      }

      if (bridgeOnline) {
        try {
          const data = await fetchPlatforms(config);
          platforms = data.platforms || [];
          gbpLimits = data.gbpLimitations;
          if (gbpNote && gbpLimits) {
            gbpNote.textContent = `Google posts via OAuth API. Your attached photo is auto-hosted (tunnel or cloud) so GBP gets the same image as Facebook/X.`;
          }
          renderPlatformGrid();
          const hist = await fetchBridgeHistory(config);
          renderHistory(hist);
          await refreshPreflight();
        } catch (e) {
          gridEl.innerHTML = `<p class="social-offline-msg">${esc(e.message)}</p>`;
        }
      } else {
        platforms = [
          { id: "facebook", label: "Facebook", connection: "demo_ready", charLimit: 63206, demoAccountCount: 1 },
          { id: "instagram", label: "Instagram", connection: "not_wired", limitation: "Meta API not wired" },
          { id: "x", label: "X (Twitter)", connection: "demo_ready", charLimit: 280, demoAccountCount: 1 },
          {
            id: "linkedin",
            label: "LinkedIn",
            connection: "needs_bridge",
            charLimit: 3000,
            demoAccountCount: 1,
            postingMethod: "playwright",
            limitation: "Playwright — run START-PRESENTATION.ps1",
          },
          {
            id: "gbp",
            label: "Google Business Profile",
            connection: "demo_ready",
            charLimit: 1500,
            demoAccountCount: 1,
            limitation: "Knight Logics Google listing via GBP API.",
          },
          { id: "tiktok", label: "TikTok", connection: "not_wired" },
          { id: "youtube", label: "YouTube Community", connection: "not_wired" },
          {
            id: "nextdoor",
            label: "Nextdoor",
            connection: "needs_bridge",
            charLimit: 1000,
            demoAccountCount: 1,
            postingMethod: "playwright",
            limitation: "Playwright — run START-PRESENTATION.ps1",
          },
        ];
        renderPlatformGrid();
        renderHistory(config.postHistory || []);
        await refreshPreflight();
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
      if (mediaThumb) {
        mediaThumb.hidden = !url;
        if (url) mediaThumb.removeAttribute("hidden");
        else mediaThumb.setAttribute("hidden", "");
      }
      if (mediaHint) {
        if (!url) {
          mediaHint.textContent =
            "JPG, PNG, WebP, GIF, MP4, MOV, WebM. Facebook/X/LinkedIn/Nextdoor use your file. Google auto-hosts your photo for the API.";
          mediaHint.classList.remove("is-warn");
        } else if (fileType?.startsWith("video/")) {
          mediaHint.textContent = `${fileName || "Video"} attached — Facebook/X/LinkedIn/Nextdoor. Google: text only (no video via API).`;
          mediaHint.classList.add("is-warn");
        } else if (fileType === "image/gif") {
          mediaHint.textContent = `${fileName || "GIF"} attached — animates on Facebook/X. Google gets a hosted JPG version.`;
          mediaHint.classList.remove("is-warn");
        } else {
          mediaHint.textContent = `${fileName || "Photo"} attached — all platforms use this image (Google hosts it publicly for the API).`;
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

    async function loadPitchDemo() {
      const demo = config.demo || {};
      if (demo.pitchText && textEl) textEl.value = demo.pitchText;
      updateCharCount();
      updatePreview();
      const demoImgUrl = demo.gbpMediaUrl || "";
      if (demoImgUrl && !mediaDataUrl) {
        try {
          const res = await fetch(demoImgUrl, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          const reader = new FileReader();
          reader.onload = () =>
            setMediaPreview(String(reader.result || ""), "WSGoodTimes.webp", blob.type || "image/webp");
          reader.readAsDataURL(blob);
        } catch (err) {
          console.warn("[WSSocial] demo image load failed", err);
        }
      }
    }

    panel.querySelector("#social-load-demo")?.addEventListener("click", () => {
      loadPitchDemo();
    });

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
      if (!confirmLivePost(selected, preflightData)) return;
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
        gbpSourceUrl: "",
        gbp: {
          topicType: panel.querySelector("#social-gbp-topic")?.value || "STANDARD",
          callToAction: panel.querySelector("#social-gbp-cta")?.value || null,
          callToActionUrl: panel.querySelector("#social-gbp-cta-url")?.value?.trim() || null,
        },
      };

      try {
        let results;
        if (bridgeOnline) {
          const data = await postToBridge(config, payload, {
            tunnelOnline,
            cloudRemoteBridge,
            preflight: preflightData,
            platformCatalog: platforms,
          });
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
                status: "simulated",
                message: "Simulated — start bridge for live GBP API posts.",
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

    setMediaPreview("");
    refreshBridge().then(() => {
      if (config.demoMode !== false && !(textEl?.value || "").trim()) {
        loadPitchDemo();
      }
    });
  }

  const HOST_PACKAGE_URL = "downloads/whistle-stop-social-host.zip";
  const HOST_GUIDE_URL = "downloads/social-host.html";
  const HOST_MODAL_KEY = "ws-social-host-modal-dismissed";
  const HOST_DOWNLOADED_KEY = "ws-social-host-package-downloaded";

  function showSocialHostPackageModal({ force = false, onRefresh = null } = {}) {
    if (!window.WSConfig?.canSocialPost?.()) return false;
    if (!force) {
      try {
        if (sessionStorage.getItem(HOST_MODAL_KEY) === "1") return false;
      } catch (_) {}
    }
    if (document.getElementById("ws-social-host-modal")) return true;

    const overlay = document.createElement("div");
    overlay.id = "ws-social-host-modal";
    overlay.className = "admin-modal-backdrop";
    overlay.setAttribute("data-admin-modal-backdrop", "");
    overlay.innerHTML = `
      <div class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="ws-host-modal-title">
        <div class="admin-modal__header">
          <div>
            <h3 id="ws-host-modal-title">Download Social Host package</h3>
            <p class="admin-modal__subtitle">Required for LinkedIn / Nextdoor / Facebook groups</p>
          </div>
          <button type="button" class="admin-modal__close" data-host-dismiss aria-label="Close">&times;</button>
        </div>
        <div class="admin-modal__body">
          <p>Your account can post to social, but a <strong>Playwright host</strong> is not running right now.</p>
          <p><strong>Works now without the package:</strong> Facebook Page, X, Google Business Profile (cloud).</p>
          <p><strong>This package unlocks:</strong> LinkedIn, Nextdoor, Facebook community groups.</p>
          <ol style="margin:0.75rem 0 0;padding-left:1.25rem;line-height:1.5">
            <li>Download the zip (included for owner/editor accounts)</li>
            <li>Unzip on any Windows PC that stays awake</li>
            <li>Run <code>START-HOST.ps1</code> and keep the windows open</li>
            <li>Return here and click Refresh — then post from any device</li>
          </ol>
          <p style="font-size:0.85rem;color:var(--text-muted);margin-top:0.75rem">Browsers cannot install software for you. This download is the host starter package for your role.</p>
        </div>
        <div class="admin-modal__footer">
          <button type="button" class="btn btn-outline admin-btn-sm" data-host-dismiss>Not now — Graph only</button>
          <button type="button" class="btn btn-outline admin-btn-sm" data-host-refresh>Already running? Refresh</button>
          <a class="btn btn-outline admin-btn-sm" href="${HOST_GUIDE_URL}" target="_blank" rel="noopener">Guide</a>
          <a class="btn btn-primary admin-btn-sm" id="ws-host-download-pkg" href="${HOST_PACKAGE_URL}" download="whistle-stop-social-host.zip">Download package (.zip)</a>
        </div>
      </div>`;
    document.body.classList.add("admin-modal-open");
    document.body.appendChild(overlay);

    const dismiss = () => {
      try {
        sessionStorage.setItem(HOST_MODAL_KEY, "1");
      } catch (_) {}
      document.body.classList.remove("admin-modal-open");
      overlay.remove();
    };
    overlay.querySelectorAll("[data-host-dismiss]").forEach((el) => el.addEventListener("click", dismiss));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) dismiss();
    });
    overlay.querySelector("#ws-host-download-pkg")?.addEventListener("click", () => {
      try {
        sessionStorage.setItem(HOST_DOWNLOADED_KEY, "1");
      } catch (_) {}
    });
    overlay.querySelector("[data-host-refresh]")?.addEventListener("click", async () => {
      document.body.classList.remove("admin-modal-open");
      overlay.remove();
      if (typeof onRefresh === "function") await onRefresh();
      else await checkHostAndPrompt({ forceModal: true });
    });
    return true;
  }

  async function checkHostAndPrompt({ forceModal = false } = {}) {
    if (!window.WSConfig?.canSocialPost?.()) {
      return { tunnelOnline: false, cloudRemoteBridge: false, needsPackage: false };
    }
    let cloudRemoteBridge = false;
    let tunnelOnline = false;
    try {
      const cloud = await pingBridge({ bridgeUrl: CLOUD_BRIDGE });
      cloudRemoteBridge = Boolean(cloud.remoteBridge);
    } catch (_) {}
    try {
      const tunnel = await pingTunnelBridge();
      tunnelOnline = tunnel.online;
    } catch (_) {}

    const hostUp = cloudRemoteBridge || tunnelOnline;
    const needsPackage = !hostUp;

    if (needsPackage) {
      showSocialHostPackageModal({ force: forceModal });
      try {
        document.dispatchEvent(
          new CustomEvent("ws-social-host-needed", {
            detail: { cloudRemoteBridge, tunnelOnline, needsPackage: true },
          })
        );
      } catch (_) {}
    }

    return {
      tunnelOnline: hostUp,
      cloudRemoteBridge,
      needsPackage,
    };
  }

  return {
    renderAdmin,
    pingBridge,
    pingTunnelBridge,
    checkHostAndPrompt,
    showSocialHostPackageModal,
    bridgeUrl,
    HOST_PACKAGE_URL,
    HOST_GUIDE_URL,
  };
})();
