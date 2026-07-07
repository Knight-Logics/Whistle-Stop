/* Whistle Stop — Campaign Calendar + Outreach CRM */
window.WSAdminCampaigns = (function () {
  const store = () => window.WSCampaignStore;
  const config = () => window.WSConfig;

  let panelEl = null;
  let selectedId = null;
  let refreshTimer = null;

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
    return prompt("Admin password (for outreach email send):") || "";
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
    const rows = campaigns
      .map((c) => {
        const signups = store().getSignupsForCampaign(runtime, c.id);
        const goal = c.signupGoal || 12;
        const pct = Math.min(100, Math.round((signups.length / goal) * 100));
        return `
          <article class="ws-campaign-card ${selectedId === c.id ? "is-selected" : ""}" data-campaign-id="${esc(c.id)}">
            <div class="ws-campaign-card-head">
              <h3>${esc(c.title)}</h3>
              ${statusPill(c.status)}
            </div>
            <p class="ws-campaign-card-desc">${esc(c.description).slice(0, 140)}…</p>
            <div class="ws-campaign-card-stats">
              <span><strong>${signups.length}</strong> / ${goal} signups</span>
              <span class="ws-campaign-mini-bar"><i style="width:${pct}%"></i></span>
            </div>
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
          <button type="button" class="btn btn-secondary btn-sm" id="ws-campaign-sync">Sync signups</button>
        </div>
        <div class="ws-campaign-cards">${rows || "<p>No campaigns yet.</p>"}</div>
        <aside class="ws-campaign-compare-note" role="note">
          <strong>Interest check vs. Events</strong>
          <p>Campaigns like D&amp;D night collect signups <em>before</em> a date goes on the public calendar. Hit your goal → promote to Events.</p>
        </aside>
      </div>`;
  }

  async function renderDetail(campaign) {
    const runtime = await store().getRuntime();
    const signups = store().getSignupsForCampaign(runtime, campaign.id);
    const emailLog = store().getEmailLogForCampaign(runtime, campaign.id);
    const signupLink = store().signupUrl(campaign);
    const goal = campaign.signupGoal || 12;
    const goalMet = signups.length >= goal;

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
            <a href="${esc(signupLink)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">Open signup page</a>
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
          <h3>Signup link</h3>
          <code class="ws-campaign-link-code">${esc(signupLink)}</code>
        </section>

        <section class="ws-campaign-section">
          <h3>Interest signups <span class="ws-count">${signups.length}</span></h3>
          <div class="ws-table-wrap">
            <table class="ws-outreach-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Night</th><th>Source</th><th>When</th></tr></thead>
              <tbody>${signupRows || `<tr><td colspan="6" class="ws-empty">No signups yet — share the link or QR</td></tr>`}</tbody>
            </table>
          </div>
        </section>

        <section class="ws-campaign-section ws-outreach-crm">
          <header class="ws-outreach-crm-head">
            <div>
              <h3>Outreach CRM</h3>
              <p>Find leads by segment, compose outreach, and send — demo uses Knight Logics test inboxes.</p>
            </div>
          </header>
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

    document.getElementById("ws-campaign-copy-link")?.addEventListener("click", () => {
      const link = store().signupUrl(campaign);
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
    refreshTimer = setInterval(() => paint(), 8000);
    store().onRuntimeChange(() => paint());
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
