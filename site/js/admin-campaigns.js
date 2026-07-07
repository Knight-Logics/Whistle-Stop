/* Whistle Stop — Campaign Calendar + Outreach CRM */
window.WSAdminCampaigns = (function () {
  const store = () => window.WSCampaignStore;
  const config = () => window.WSConfig;

  let panelEl = null;
  let selectedId = null;
  let refreshTimer = null;
  let showingCreateModal = false;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function statusPill(status) {
    const labels = {
      interest_check: "Interest check",
      scheduled: "Scheduled",
      promoted: "On events calendar",
      draft: "Draft",
      new: "New",
      contacted: "Contacted",
      interested: "Interested",
      queued: "Queued",
      sent: "Sent",
    };
    return `<span class="ws-campaign-pill ws-campaign-pill--${esc(status)}">${esc(labels[status] || status)}</span>`;
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return iso;
    }
  }

  async function getAdminPassword() {
    if (config()?.getSessionPassword) {
      const p = config().getSessionPassword();
      if (p) return p;
    }
    const entered = prompt("Admin password (for outreach email send):");
    if (!entered) {
      showToast("Admin password required to send outreach email.");
      return "";
    }
    return entered;
  }

  function showToast(msg) {
    let el = document.getElementById("admin-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "admin-toast";
      el.className = "admin-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => el.classList.remove("is-visible"), 4200);
  }

  function audienceStatusKey(campaignId) {
    return `ws_campaign_audience_status_${campaignId}`;
  }

  function readAudienceStatus(campaignId) {
    try {
      const raw = sessionStorage.getItem(audienceStatusKey(campaignId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeAudienceStatus(campaignId, text, className = "ws-send-status") {
    sessionStorage.setItem(
      audienceStatusKey(campaignId),
      JSON.stringify({ text, className, at: Date.now() })
    );
  }

  function openEmailPreviewModal({ subject, to, html, localOnly, apiError }) {
    const existing = document.getElementById("ws-outreach-email-preview");
    existing?.remove();
    const note = localOnly
      ? `<p class="ws-email-preview-note">Logged on this device — inbox delivery needs the campaigns API on Vercel (with Resend). ${esc(apiError || "")}</p>`
      : `<p class="ws-email-preview-note is-ok">Sent to ${esc(to)} — check your inbox (and spam).</p>`;
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div class="ws-campaign-modal-backdrop" id="ws-outreach-email-preview">
        <div class="ws-campaign-modal ws-email-preview-modal" role="dialog" aria-labelledby="ws-email-preview-title">
          <header class="ws-campaign-modal-head">
            <h2 id="ws-email-preview-title">Outreach email preview</h2>
            <button type="button" class="ws-campaign-modal-close" id="ws-email-preview-close" aria-label="Close">×</button>
          </header>
          <p class="ws-email-preview-subject"><strong>Subject:</strong> ${esc(subject)}</p>
          ${note}
          <iframe class="ws-email-preview-frame" title="Email HTML preview" sandbox=""></iframe>
        </div>
      </div>`
    );
    const modal = document.getElementById("ws-outreach-email-preview");
    const frame = modal.querySelector(".ws-email-preview-frame");
    frame.srcdoc = html;
    const close = () => modal.remove();
    modal.querySelector("#ws-email-preview-close")?.addEventListener("click", close);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
  }

  function openTab(tabId) {
    document.querySelector(`.admin-nav button[data-tab="${tabId}"]`)?.click();
  }

  function campaignQrDeepLink(campaign) {
    sessionStorage.setItem(
      "ws_qr_prefill",
      JSON.stringify({
        mode: "campaign",
        label: `${campaign.title} signup`,
        placement: "campaign-flyer",
        campaign: campaign.slug,
      })
    );
    openTab("qr-codes");
  }

  async function renderList() {
    const { campaigns } = await store().getCampaigns();
    const runtime = await store().getRuntime();
    const unpublished = store().hasUnpublishedCampaigns();
    const rows = campaigns
      .map((c) => {
        const signups = store().getSignupsForCampaign(runtime, c.id);
        const isInterest = (c.type || "interest_check") === "interest_check";
        const goal = c.signupGoal || 12;
        const pct = isInterest ? Math.min(100, Math.round((signups.length / goal) * 100)) : 0;
        const stats = isInterest
          ? `<span><strong>${signups.length}</strong> / ${goal} signups</span>
             <span class="ws-campaign-mini-bar"><i style="width:${pct}%"></i></span>`
          : `<span><strong>${signups.length}</strong> signups · ${esc(c.type || "campaign")}</span>`;
        const draftTag = c.staffCreated ? `<span class="ws-campaign-draft-tag">Draft</span>` : "";
        return `
          <article class="ws-campaign-card ${selectedId === c.id ? "is-selected" : ""}" data-campaign-id="${esc(c.id)}">
            <div class="ws-campaign-card-head">
              <h3>${esc(c.title)}${draftTag}</h3>
              ${statusPill(c.status)}
            </div>
            <p class="ws-campaign-card-desc">${esc((c.description || "").slice(0, 140))}${(c.description || "").length > 140 ? "…" : ""}</p>
            <div class="ws-campaign-card-stats">${stats}</div>
            <div class="ws-campaign-card-channels">
              ${(c.channels || []).map((ch) => `<span>${esc(ch)}</span>`).join("")}
            </div>
          </article>`;
      })
      .join("");

    return `
      <div class="ws-campaign-list-col">
        <div class="ws-campaign-list-header">
          <h3>Active campaigns</h3>
          <div class="ws-campaign-list-actions">
            <button type="button" class="btn btn-primary btn-sm" id="ws-campaign-add">+ New campaign</button>
            ${unpublished ? `<button type="button" class="btn btn-outline btn-sm" id="ws-campaign-publish">Publish campaigns live</button>` : ""}
            <button type="button" class="btn btn-secondary btn-sm" id="ws-campaign-sync">Sync signups</button>
          </div>
        </div>
        <div class="ws-campaign-cards">${rows || "<p>No campaigns yet — click <strong>+ New campaign</strong>.</p>"}</div>
        ${unpublished ? `<p class="ws-campaign-unpublished-note" role="status"><strong>Unpublished drafts</strong> — visible here until you publish. Guest links on other devices need <em>Publish campaigns live</em>.</p>` : ""}
        <aside class="ws-campaign-compare-note" role="note">
          <strong>No website edits needed</strong>
          <p>Each campaign gets its own page at <code>campaign.html?campaign=your-slug</code> — interest signup, info + image, or event promo.</p>
        </aside>
      </div>`;
  }

  async function renderDetail(campaign) {
    const runtime = await store().getRuntime();
    const signups = store().getSignupsForCampaign(runtime, campaign.id);
    const emailLog = store().getEmailLogForCampaign(runtime, campaign.id);
    const signupLink = store().shareableCampaignUrl(campaign);
    const goal = campaign.signupGoal || 12;
    const goalMet = signups.length >= goal;
    let audiencePlan = null;
    try {
      const raw = sessionStorage.getItem(`ws_campaign_audience_${campaign.id}`);
      if (raw) audiencePlan = JSON.parse(raw);
    } catch (_) {}
    const audienceStatus = readAudienceStatus(campaign.id);

    const signupRows = signups
      .slice()
      .reverse()
      .map(
        (s) => `
        <tr>
          <td>${esc(s.name)}</td>
          <td><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></td>
          <td>${esc(s.role)}</td>
          <td>${esc(s.preferredNight || "—")}</td>
          <td>${esc(s.source)}</td>
          <td>${fmtDate(s.createdAt)}</td>
        </tr>`
      )
      .join("");

    const leadTypeSections = (campaign.leadTypes || [])
      .map((lt) => {
        const leads = store().getLeadsForCampaign(runtime, campaign.id, lt.id);
        const leadRows = leads
          .map(
            (l) => `
          <tr data-lead-id="${esc(l.id)}">
            <td><input type="checkbox" class="ws-outreach-lead-cb" value="${esc(l.id)}" ${l.status === "new" || l.status === "queued" ? "checked" : ""} /></td>
            <td>${esc(l.name)}</td>
            <td>${esc(l.organization || "—")}</td>
            <td>${esc(l.email)}</td>
            <td>${statusPill(l.status)}</td>
          </tr>`
          )
          .join("");
        return `
          <section class="ws-outreach-segment" data-lead-type="${esc(lt.id)}">
            <header class="ws-outreach-segment-head">
              <div>
                <h4>${esc(lt.label)}</h4>
                <p>${esc(lt.description)}</p>
              </div>
              <button type="button" class="btn btn-secondary btn-sm ws-discover-leads" data-lead-type="${esc(lt.id)}">Find leads</button>
            </header>
            <table class="ws-outreach-table">
              <thead><tr><th></th><th>Name</th><th>Organization</th><th>Email</th><th>Status</th></tr></thead>
              <tbody>${leadRows || `<tr><td colspan="5" class="ws-empty">No leads yet — click Find leads</td></tr>`}</tbody>
            </table>
          </section>`;
      })
      .join("");

    const emailRows = emailLog
      .slice()
      .reverse()
      .map(
        (e) => `
        <tr>
          <td>${esc(e.to)}</td>
          <td>${esc(e.subject)}</td>
          <td>${statusPill(e.status)}</td>
          <td>${esc(e.via || "—")}</td>
          <td>${fmtDate(e.sentAt)}</td>
        </tr>`
      )
      .join("");

    const defaultSubject = campaign.emailSubject || `Interest check: ${campaign.title}`;
    const defaultBody =
      campaign.emailBody ||
      "Hi {{name}},\n\nWe're gauging interest for an event at Whistle Stop.\n\nSign up: {{signup_link}}\n";

    return `
      <div class="ws-campaign-detail-col">
        <header class="ws-campaign-detail-head">
          <div>
            <p class="ws-campaign-eyebrow">Campaign detail</p>
            <h2>${esc(campaign.title)}</h2>
            ${statusPill(campaign.status)}
          </div>
          <div class="ws-campaign-detail-actions">
            <a href="${esc(signupLink)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">Open campaign page</a>
            <button type="button" class="btn btn-secondary btn-sm" id="ws-campaign-copy-link">Copy link</button>
            <button type="button" class="btn btn-secondary btn-sm" id="ws-campaign-qr">Create QR</button>
            ${goalMet ? `<button type="button" class="btn btn-primary btn-sm" id="ws-campaign-promote">Promote to Events</button>` : ""}
          </div>
        </header>

        <div class="ws-campaign-kpi-row">
          <div class="ws-campaign-kpi"><strong>${signups.length}</strong><span>Signups</span></div>
          <div class="ws-campaign-kpi"><strong>${goal}</strong><span>Goal</span></div>
          <div class="ws-campaign-kpi"><strong>${store().getLeadsForCampaign(runtime, campaign.id).length}</strong><span>Outreach leads</span></div>
          <div class="ws-campaign-kpi"><strong>${emailLog.length}</strong><span>Emails sent</span></div>
        </div>

        <section class="ws-campaign-section">
          <h3>Campaign link</h3>
          <code class="ws-campaign-link-code">${esc(signupLink)}</code>
        </section>

        ${(campaign.type || "interest_check") === "interest_check" ? `
        <section class="ws-campaign-section">
          <h3>Interest signups <span class="ws-count">${signups.length}</span></h3>
          <div class="ws-table-wrap">
            <table class="ws-outreach-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Night</th><th>Source</th><th>When</th></tr></thead>
              <tbody>${signupRows || `<tr><td colspan="6" class="ws-empty">No signups yet — share the link or QR</td></tr>`}</tbody>
            </table>
          </div>
        </section>` : ""}

        <section class="ws-campaign-section ws-audience-plan">
          <header class="ws-outreach-crm-head">
            <div>
              <h3>Target audience &amp; lead search</h3>
              <p>Infers the best <strong>localized</strong> segments for this campaign (Safety Harbor / Tampa Bay), then searches for matching leads — like Knight Command outreach.</p>
            </div>
            <div class="ws-campaign-audience-actions">
              <button type="button" class="btn btn-primary btn-sm" id="ws-campaign-find-leads">Find best local leads</button>
              <button type="button" class="btn btn-secondary btn-sm" id="ws-campaign-demo-email">Send demo email (nickknight488@gmail.com)</button>
            </div>
          </header>
          <div id="ws-audience-plan-body" class="ws-audience-plan-body">
            ${
              audiencePlan
                ? `<p class="ws-audience-summary"><strong>${esc(audiencePlan.summary)}</strong> <span class="ws-audience-source">via ${esc(audiencePlan.source || "rules")}</span></p>
                   <ul class="ws-audience-segment-list">${(audiencePlan.segments || [])
                     .map(
                       (s) =>
                         `<li><strong>${esc(s.label)}</strong> — ${esc(s.description)}<br /><em class="ws-audience-query">Search: ${esc((s.searchQueries || []).join(" · "))}</em></li>`
                     )
                     .join("")}</ul>`
                : `<p class="ws-empty">Click <strong>Find best local leads</strong> to analyze this campaign and populate outreach segments below.</p>`
            }
          </div>
          <p id="ws-audience-status" class="${esc(audienceStatus?.className || "ws-send-status")}" role="status">${esc(audienceStatus?.text || "")}</p>
        </section>

        <section class="ws-campaign-section ws-outreach-crm">
          <h3>Outreach leads by segment</h3>
          ${leadTypeSections}
          <div class="ws-outreach-compose">
            <h4>Compose outreach</h4>
            <label>Subject <input type="text" id="ws-outreach-subject" value="${esc(defaultSubject)}" /></label>
            <label>Body <textarea id="ws-outreach-body" rows="8">${esc(defaultBody)}</textarea></label>
            <p class="ws-field-hint">Tokens: <code>{{name}}</code> <code>{{organization}}</code> <code>{{signup_link}}</code> <code>{{goal}}</code></p>
            <div class="ws-outreach-compose-actions">
              <button type="button" class="btn btn-primary" id="ws-outreach-send">Send to selected leads</button>
              <span id="ws-outreach-send-status" class="ws-send-status" role="status"></span>
            </div>
          </div>
        </section>

        <section class="ws-campaign-section">
          <h3>Email send log</h3>
          <div class="ws-table-wrap">
            <table class="ws-outreach-table">
              <thead><tr><th>To</th><th>Subject</th><th>Status</th><th>Via</th><th>Sent</th></tr></thead>
              <tbody id="ws-email-log-body">${emailRows || `<tr><td colspan="5" class="ws-empty">No emails sent yet</td></tr>`}</tbody>
            </table>
          </div>
        </section>
      </div>`;
  }

  function renderCreateModal() {
    return `
      <div class="ws-campaign-modal-backdrop" id="ws-campaign-modal">
        <div class="ws-campaign-modal" role="dialog" aria-labelledby="ws-campaign-modal-title">
          <header class="ws-campaign-modal-head">
            <h2 id="ws-campaign-modal-title">New campaign</h2>
            <button type="button" class="ws-campaign-modal-close" id="ws-campaign-modal-close" aria-label="Close">×</button>
          </header>
          <form id="ws-campaign-create-form" class="ws-campaign-create-form">
            <div class="admin-form-grid cols-2">
              <div class="admin-field" style="grid-column:1/-1">
                <label for="ws-new-title">Campaign name</label>
                <input id="ws-new-title" type="text" required placeholder="Father's Day gift cards" />
              </div>
              <div class="admin-field">
                <label for="ws-new-slug">URL slug</label>
                <input id="ws-new-slug" type="text" placeholder="auto-from-name" />
                <p class="ws-field-hint">→ campaign.html?campaign=<em>slug</em></p>
              </div>
              <div class="admin-field">
                <label for="ws-new-type">Campaign type</label>
                <select id="ws-new-type">
                  <option value="interest_check">Interest check (signup form)</option>
                  <option value="info">Info + image + link (no signup)</option>
                  <option value="event_promo">Event promo (date/time + flyer)</option>
                </select>
              </div>
              <div class="admin-field" style="grid-column:1/-1">
                <label for="ws-new-headline">Headline on page</label>
                <input id="ws-new-headline" type="text" placeholder="Same as name or a guest-facing hook" />
              </div>
              <div class="admin-field" style="grid-column:1/-1">
                <label for="ws-new-description">Description</label>
                <textarea id="ws-new-description" rows="3" required placeholder="What guests should know"></textarea>
              </div>
            </div>

            <div id="ws-new-fields-interest" class="ws-campaign-type-fields">
              <div class="admin-field">
                <label for="ws-new-goal">Signup goal</label>
                <input id="ws-new-goal" type="number" min="1" value="12" />
              </div>
            </div>

            <div id="ws-new-fields-info" class="ws-campaign-type-fields" hidden>
              <div class="admin-form-grid cols-2">
                <div class="admin-field">
                  <label for="ws-new-cta-label">Button label</label>
                  <input id="ws-new-cta-label" type="text" placeholder="Buy gift cards" />
                </div>
                <div class="admin-field">
                  <label for="ws-new-cta-url">Button link</label>
                  <input id="ws-new-cta-url" type="text" placeholder="https://… or menu.html" />
                </div>
                <div class="admin-field" style="grid-column:1/-1">
                  <label for="ws-new-hero">Hero image path (optional)</label>
                  <input id="ws-new-hero" type="text" placeholder="assets/gallery/WSGoodTimes-768.webp" />
                </div>
                <div class="admin-field">
                  <label class="admin-field--checkbox"><input type="checkbox" id="ws-new-info-signup" /> Also show signup form</label>
                </div>
              </div>
            </div>

            <div id="ws-new-fields-event" class="ws-campaign-type-fields" hidden>
              <div class="admin-form-grid cols-2">
                <div class="admin-field">
                  <label for="ws-new-event-date">Date</label>
                  <input id="ws-new-event-date" type="text" placeholder="Saturday, June 14" />
                </div>
                <div class="admin-field">
                  <label for="ws-new-event-time">Time</label>
                  <input id="ws-new-event-time" type="text" placeholder="6:00 PM" />
                </div>
                <div class="admin-field" style="grid-column:1/-1">
                  <label for="ws-new-location">Location</label>
                  <input id="ws-new-location" type="text" value="Patio · Whistle Stop Grill &amp; Bar" />
                </div>
                <div class="admin-field" style="grid-column:1/-1">
                  <label for="ws-new-event-hero">Flyer / hero image (optional)</label>
                  <input id="ws-new-event-hero" type="text" placeholder="assets/gallery/WSSunset-768.webp" />
                </div>
              </div>
            </div>

            <p id="ws-campaign-create-status" class="ws-send-status" role="status"></p>
            <footer class="ws-campaign-modal-foot">
              <button type="button" class="btn btn-secondary" id="ws-campaign-modal-cancel">Cancel</button>
              <button type="submit" class="btn btn-primary">Create campaign</button>
            </footer>
          </form>
        </div>
      </div>`;
  }

  function setCreateTypeFields(type) {
    const panel = document.getElementById("ws-campaign-modal");
    if (!panel) return;
    panel.querySelector("#ws-new-fields-interest").hidden = type !== "interest_check";
    panel.querySelector("#ws-new-fields-info").hidden = type !== "info";
    panel.querySelector("#ws-new-fields-event").hidden = type !== "event_promo";
  }

  function wireCreateModal() {
    const modal = document.getElementById("ws-campaign-modal");
    if (!modal) return;

    const close = () => {
      showingCreateModal = false;
      modal.remove();
      startAutoRefresh();
    };

    modal.querySelector("#ws-campaign-modal-close")?.addEventListener("click", close);
    modal.querySelector("#ws-campaign-modal-cancel")?.addEventListener("click", close);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });

    const titleInput = modal.querySelector("#ws-new-title");
    const slugInput = modal.querySelector("#ws-new-slug");
    titleInput?.addEventListener("input", () => {
      if (!slugInput.dataset.touched) {
        slugInput.value = store().slugify(titleInput.value);
      }
    });
    slugInput?.addEventListener("input", () => {
      slugInput.dataset.touched = slugInput.value ? "1" : "";
    });

    modal.querySelector("#ws-new-type")?.addEventListener("change", (e) => {
      setCreateTypeFields(e.target.value);
    });

    modal.querySelector("#ws-campaign-create-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = modal.querySelector("#ws-campaign-create-status");
      const type = modal.querySelector("#ws-new-type").value;
      const form = {
        type,
        title: titleInput.value,
        slug: slugInput.value,
        headline: modal.querySelector("#ws-new-headline").value,
        description: modal.querySelector("#ws-new-description").value,
        signupGoal: modal.querySelector("#ws-new-goal")?.value,
        ctaLabel: modal.querySelector("#ws-new-cta-label")?.value,
        ctaUrl: modal.querySelector("#ws-new-cta-url")?.value,
        heroImage: modal.querySelector("#ws-new-hero")?.value || modal.querySelector("#ws-new-event-hero")?.value,
        showSignup: modal.querySelector("#ws-new-info-signup")?.checked,
        eventDate: modal.querySelector("#ws-new-event-date")?.value,
        eventTime: modal.querySelector("#ws-new-event-time")?.value,
        location: modal.querySelector("#ws-new-location")?.value,
      };

      try {
        const created = await store().saveCampaign(form);
        selectedId = created.id;
        status.className = "ws-send-status is-ok";
        status.textContent = "Campaign created — click Publish campaigns live so guests on other devices can open it.";
        setTimeout(() => close(), 800);
        store().invalidateCampaignsCache();
        paint();
      } catch (err) {
        status.className = "ws-send-status is-error";
        status.textContent = err.message || "Could not create campaign.";
      }
    });

    setCreateTypeFields(modal.querySelector("#ws-new-type").value);
  }

  function openCreateModal() {
    showingCreateModal = true;
    stopAutoRefresh();
    document.body.insertAdjacentHTML("beforeend", renderCreateModal());
    wireCreateModal();
  }

  async function paint() {
    if (!panelEl) return;
    const { campaigns } = await store().getCampaigns();
    if (!selectedId && campaigns.length) selectedId = campaigns[0].id;
    const campaign = campaigns.find((c) => c.id === selectedId);

    panelEl.innerHTML = `
      <div class="admin-note">
        <strong>Campaign Calendar + Outreach</strong> — Plan interest-check campaigns, collect signups, run outreach like Knight Command Center, then promote to Events when ready.
      </div>
      <div class="ws-campaign-layout">
        ${await renderList()}
        ${campaign ? await renderDetail(campaign) : "<p>Select a campaign</p>"}
      </div>`;

    wireEvents(campaign);
  }

  function wireEvents(campaign) {
    panelEl.querySelectorAll("[data-campaign-id]").forEach((card) => {
      card.addEventListener("click", () => {
        selectedId = card.dataset.campaignId;
        paint();
      });
    });

    document.getElementById("ws-campaign-add")?.addEventListener("click", () => openCreateModal());

    document.getElementById("ws-campaign-publish")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const adminPassword = await getAdminPassword();
      if (!adminPassword) return;
      btn.disabled = true;
      btn.textContent = "Publishing…";
      const result = await store().publishCampaigns(adminPassword);
      if (result.ok) {
        alert(`Published ${result.count} campaign(s) to GitHub Pages. Guest links should work everywhere in 1–3 minutes.`);
      } else {
        alert(result.error || "Publish failed. Campaigns are saved on this device — try again when the API is online.");
      }
      btn.disabled = false;
      btn.textContent = "Publish campaigns live";
      paint();
    });

    document.getElementById("ws-campaign-sync")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = "Syncing…";
      const result = await store().syncRuntimeFromCloud();
      btn.textContent = result.ok ? `Synced (${result.source})` : "Sync failed";
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = "Sync signups";
      }, 2000);
      paint();
    });

    if (!campaign) return;

    document.getElementById("ws-campaign-find-leads")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const status = document.getElementById("ws-audience-status");
      btn.disabled = true;
      if (status) {
        status.className = "ws-send-status";
        status.textContent = "Analyzing audience & searching local leads…";
      }
      writeAudienceStatus(campaign.id, "Analyzing audience & searching local leads…", "ws-send-status");

      try {
        const result = await store().findBestLeads(campaign.id, campaign, { useLlm: true });
        sessionStorage.setItem(`ws_campaign_audience_${campaign.id}`, JSON.stringify(result.plan));
        const msg = `Found ${result.added.length} new lead(s) across ${result.plan.segments?.length || 0} segments (${result.source}).`;
        writeAudienceStatus(campaign.id, msg, "ws-send-status is-ok");
        showToast(msg);
        paint();
      } catch (err) {
        const msg = err.message || "Lead search failed.";
        writeAudienceStatus(campaign.id, msg, "ws-send-status is-error");
        if (status) {
          status.className = "ws-send-status is-error";
          status.textContent = msg;
        }
        showToast(msg);
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById("ws-campaign-demo-email")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const status = document.getElementById("ws-audience-status");
      const adminPassword = await getAdminPassword();
      if (!adminPassword) return;
      btn.disabled = true;
      const sendingMsg = "Sending formatted demo email…";
      if (status) status.textContent = sendingMsg;
      writeAudienceStatus(campaign.id, sendingMsg, "ws-send-status");

      try {
        const result = await store().sendDemoOutreachEmail({
          campaignId: campaign.id,
          campaign,
          adminPassword,
        });
        const msg = result.localOnly
          ? `Logged HTML outreach to nickknight488@gmail.com (API offline — ${result.apiError || "demo mode"})`
          : `Sent HTML outreach to ${result.mail?.to || "nickknight488@gmail.com"}`;
        writeAudienceStatus(campaign.id, msg, "ws-send-status is-ok");
        showToast(result.localOnly ? "Demo email logged — opening preview" : `Email sent to ${result.mail?.to || "nickknight488@gmail.com"}`);
        let previewHtml = result.mail?.html;
        let previewSubject = result.mail?.subject;
        if (!previewHtml && window.WSCampaignAudience?.buildOutreachEmail) {
          const built = window.WSCampaignAudience.buildOutreachEmail(
            campaign,
            { name: "Nicholas", email: result.mail?.to || "nickknight488@gmail.com", organization: "Demo test" },
            { signup_link: store().shareableCampaignUrl(campaign), goal: campaign.signupGoal || 12 }
          );
          previewHtml = built.html;
          previewSubject = previewSubject || built.subject;
        }
        if (previewHtml) {
          openEmailPreviewModal({
            subject: previewSubject || "Campaign outreach",
            to: result.mail?.to || "nickknight488@gmail.com",
            html: previewHtml,
            localOnly: result.localOnly,
            apiError: result.apiError,
          });
        }
        paint();
      } catch (err) {
        const msg = err.message || "Demo send failed.";
        writeAudienceStatus(campaign.id, msg, "ws-send-status is-error");
        if (status) {
          status.className = "ws-send-status is-error";
          status.textContent = msg;
        }
        showToast(msg);
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById("ws-campaign-copy-link")?.addEventListener("click", () => {
      const link = store().shareableCampaignUrl(campaign);
      navigator.clipboard?.writeText(link);
      const btn = document.getElementById("ws-campaign-copy-link");
      if (btn) btn.textContent = "Copied!";
      setTimeout(() => {
        if (btn) btn.textContent = "Copy link";
      }, 1500);
    });

    document.getElementById("ws-campaign-qr")?.addEventListener("click", () => campaignQrDeepLink(campaign));

    document.getElementById("ws-campaign-promote")?.addEventListener("click", async () => {
      const runtime = await store().getRuntime();
      const signups = store().getSignupsForCampaign(runtime, campaign.id);
      const draft = store().promoteToEventDraft(campaign, signups);
      sessionStorage.setItem("ws_event_draft_from_campaign", JSON.stringify(draft));
      alert(`Draft event saved (${signups.length} signups). Opening Events tab — add a date and save.`);
      openTab("events");
    });

    panelEl.querySelectorAll(".ws-discover-leads").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        const added = await store().discoverLeads(campaign.id, btn.dataset.leadType);
        btn.textContent = added.length ? `+${added.length} found` : "No new leads";
        setTimeout(() => paint(), 600);
      });
    });

    document.getElementById("ws-outreach-send")?.addEventListener("click", async () => {
      const leadIds = [...panelEl.querySelectorAll(".ws-outreach-lead-cb:checked")].map((cb) => cb.value);
      const statusEl = document.getElementById("ws-outreach-send-status");
      if (!leadIds.length) {
        statusEl.textContent = "Select at least one lead.";
        statusEl.className = "ws-send-status is-error";
        return;
      }
      const subject = document.getElementById("ws-outreach-subject")?.value || "";
      const body = document.getElementById("ws-outreach-body")?.value || "";
      const adminPassword = await getAdminPassword();
      const sendBtn = document.getElementById("ws-outreach-send");
      sendBtn.disabled = true;
      statusEl.className = "ws-send-status";
      statusEl.textContent = "Sending…";

      try {
        const result = await store().sendOutreachEmail({
          campaignId: campaign.id,
          leadIds,
          subject,
          body,
          adminPassword,
        });
        const count = result.sent?.length || leadIds.length;
        statusEl.textContent = result.localOnly
          ? `Logged ${count} send(s) locally (API offline — demo mode)`
          : `Sent ${count} email(s) via Knight Logics`;
        statusEl.className = "ws-send-status is-ok";
        paint();
      } catch (err) {
        statusEl.textContent = err.message || "Send failed";
        statusEl.className = "ws-send-status is-error";
      } finally {
        sendBtn.disabled = false;
      }
    });
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(() => {
      if (!showingCreateModal) paint();
    }, 8000);
    store().onRuntimeChange(() => {
      if (!showingCreateModal) paint();
    });
  }

  function stopAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
  }

  async function render(panel) {
    panelEl = panel;
    await store().syncRuntimeFromCloud().catch(() => {});
    await paint();
    startAutoRefresh();
  }

  function destroy() {
    stopAutoRefresh();
    panelEl = null;
  }

  return { render, destroy };
})();
