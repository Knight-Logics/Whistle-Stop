/* Whistle Stop — campaign definitions + runtime (signups, outreach, email log) */
(function (global) {
  const CAMPAIGNS_FILE = "data/campaigns.json";
  const RUNTIME_FILE = "data/campaign-runtime.json";
  const LOCAL_RUNTIME_KEY = "ws_campaign_runtime_v1";
  const LOCAL_CAMPAIGNS_KEY = "ws_campaign_custom_v1";
  const API_BASE = "https://knightlogics.com/api/whistle-stop-campaigns";
  const LIVE_RUNTIME_URL =
    "https://knight-logics.github.io/Whistle-Stop/data/campaign-runtime.json";
  const PUBLIC_SHARE_BASE = "https://knight-logics.github.io/Whistle-Stop/";

  let campaignsCache = null;
  let runtimeCache = null;
  let listeners = new Set();

  function slugify(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
  }

  function readLocalCampaigns() {
    try {
      const raw = localStorage.getItem(LOCAL_CAMPAIGNS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function writeLocalCampaigns(list) {
    localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(list));
    campaignsCache = null;
  }

  function mergeCampaignLists(baseList, customList) {
    const byId = new Map();
    (baseList || []).forEach((c) => byId.set(c.id, c));
    (customList || []).forEach((c) => byId.set(c.id, c));
    return [...byId.values()].sort((a, b) => {
      const ta = a.createdAt || "";
      const tb = b.createdAt || "";
      return tb.localeCompare(ta);
    });
  }

  function invalidateCampaignsCache() {
    campaignsCache = null;
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function readLocalRuntime() {
    try {
      const raw = localStorage.getItem(LOCAL_RUNTIME_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeLocalRuntime(data) {
    localStorage.setItem(LOCAL_RUNTIME_KEY, JSON.stringify(data));
    runtimeCache = structuredClone(data);
    listeners.forEach((fn) => {
      try {
        fn(runtimeCache);
      } catch (_) {}
    });
  }

  function mergeRuntime(base, overlay) {
    if (!overlay) return structuredClone(base);
    const out = structuredClone(base);
    const mergeList = (key) => {
      out[key] = out[key] || [];
      const seen = new Set((out[key] || []).map((r) => r.id));
      (overlay[key] || []).forEach((row) => {
        if (!row?.id || seen.has(row.id)) return;
        out[key].push(row);
        seen.add(row.id);
      });
    };
    ["signups", "outreachLeads", "emailLog"].forEach(mergeList);
    out.signupCounts = { ...(out.signupCounts || {}), ...(overlay.signupCounts || {}) };
    if (overlay.updatedAt && overlay.updatedAt > (out.updatedAt || "")) {
      out.updatedAt = overlay.updatedAt;
    }
    return out;
  }

  function notify() {
    listeners.forEach((fn) => {
      try {
        fn(runtimeCache);
      } catch (_) {}
    });
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${url}`);
    return res.json();
  }

  async function getCampaigns() {
    if (campaignsCache) return structuredClone(campaignsCache);
    const data = await fetchJson(CAMPAIGNS_FILE);
    const merged = mergeCampaignLists(data.campaigns, readLocalCampaigns());
    campaignsCache = { campaigns: merged };
    return structuredClone(campaignsCache);
  }

  async function getCampaignBySlug(slug) {
    const { campaigns } = await getCampaigns();
    return campaigns.find((c) => c.slug === slug || c.id === slug) || null;
  }

  async function getRuntime(force = false) {
    if (runtimeCache && !force) return structuredClone(runtimeCache);
    let base;
    try {
      base = await fetchJson(RUNTIME_FILE);
    } catch {
      base = { version: 1, signups: [], outreachLeads: [], emailLog: [] };
    }
    const local = readLocalRuntime();
    runtimeCache = mergeRuntime(base, local);
    return structuredClone(runtimeCache);
  }

  function getSignupsForCampaign(runtime, campaignId) {
    return (runtime.signups || []).filter((s) => s.campaignId === campaignId);
  }

  function getSignupCount(runtime, campaignId) {
    const detailed = getSignupsForCampaign(runtime, campaignId);
    if (detailed.length) return detailed.length;
    return Math.max(0, Number(runtime.signupCounts?.[campaignId]) || 0);
  }

  function getLeadsForCampaign(runtime, campaignId, leadType) {
    let rows = (runtime.outreachLeads || []).filter((l) => l.campaignId === campaignId);
    if (leadType) rows = rows.filter((l) => l.leadType === leadType);
    return rows;
  }

  function getEmailLogForCampaign(runtime, campaignId) {
    return (runtime.emailLog || []).filter((e) => e.campaignId === campaignId);
  }

  function signupUrl(campaign, baseOverride) {
    const host = typeof location !== "undefined" ? location.hostname : "";
    const base =
      baseOverride ||
      (host === "127.0.0.1" || host === "localhost"
        ? PUBLIC_SHARE_BASE
        : typeof location !== "undefined"
          ? location.origin + location.pathname.replace(/[^/]+$/, "")
          : PUBLIC_SHARE_BASE);
    const file = campaign.landingPath || "campaign.html";
    const url = new URL(file, base.endsWith("/") ? base : base + "/");
    url.searchParams.set("campaign", campaign.slug || campaign.id);
    return url.href;
  }

  function shareableCampaignUrl(campaign) {
    return signupUrl(campaign, PUBLIC_SHARE_BASE);
  }

  function renderTemplate(tpl, vars) {
    return String(tpl || "").replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
  }

  function campaignApiUrls(route) {
    return [
      `${API_BASE}/${route}`,
      `https://knightlogics.com/api/whistle-stop-social?service=campaigns&route=${encodeURIComponent(route)}`,
    ];
  }

  async function apiRequest(route, options = {}) {
    const sessionHash = global.WSConfig?.isAuthed?.() ? global.WSConfig?.getAdminAuthHash?.() : "";
    const fetchOpts = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(sessionHash ? { "X-WS-Admin-Hash": sessionHash } : {}),
        ...(options.headers || {}),
      },
    };
    let lastError = null;
    for (const url of campaignApiUrls(route)) {
      try {
        const res = await fetch(url, fetchOpts);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
          lastError = new Error(data.error || `API ${res.status}`);
          if (res.status === 404) continue;
          throw lastError;
        }
        return data;
      } catch (err) {
        lastError = err;
        if (String(err.message || "").includes("404")) continue;
      }
    }
    throw lastError || new Error("Campaign API unreachable.");
  }

  async function submitSignup(campaignId, payload) {
    const signup = {
      id: uid("su"),
      campaignId,
      name: String(payload.name || "").trim(),
      email: String(payload.email || "").trim().toLowerCase(),
      phone: String(payload.phone || "").trim(),
      role: payload.role || "player",
      preferredNight: payload.preferredNight || "",
      experience: payload.experience || "",
      source: payload.source || "web",
      notes: String(payload.notes || "").trim(),
      marketingConsent: Boolean(payload.marketingConsent),
      consentAt: payload.consentAt || new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    if (!signup.name || !signup.email) throw new Error("Name and email are required.");

    try {
      const result = await apiRequest("signup", {
        method: "POST",
        body: JSON.stringify({ signup }),
      });
      if (result.runtime) {
        runtimeCache = result.runtime;
        writeLocalRuntime(result.runtime);
      }
      return result.signup || signup;
    } catch (err) {
      throw new Error(
        `Signup service is temporarily unavailable; nothing was submitted. Please try again or call (727) 726-1956. (${err.message})`
      );
    }
  }

  async function syncRuntimeFromCloud() {
    try {
      const data = await apiRequest("runtime", { method: "GET" });
      if (data.runtime) {
        runtimeCache = data.runtime;
        writeLocalRuntime(data.runtime);
        return { ok: true, source: "api" };
      }
    } catch (_) {}
    try {
      const remote = await fetchJson(`${LIVE_RUNTIME_URL}?_=${Date.now()}`);
      const local = readLocalRuntime();
      runtimeCache = mergeRuntime(remote, local);
      writeLocalRuntime(runtimeCache);
      return { ok: true, source: "github-pages" };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function sendOutreachEmail({ campaignId, leadIds, subject, body, adminPassword, adminSessionHash }) {
    const payload = { campaignId, leadIds, subject, body, adminPassword, adminSessionHash };
    try {
      const campaign = (await getCampaigns()).campaigns.find((c) => c.id === campaignId);
      payload.signupLink = campaign ? shareableCampaignUrl(campaign) : "";
      payload.goal = campaign?.signupGoal || 12;
      payload.campaign = campaign;
      const result = await apiRequest("outreach-send", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (result.runtime) {
        runtimeCache = result.runtime;
        writeLocalRuntime(result.runtime);
      }
      return result;
    } catch (err) {
      return {
        ok: false,
        sent: [],
        failedLeadIds: leadIds,
        localOnly: true,
        error: `Campaign API offline; no email was sent. ${err.message}`,
      };
    }
  }

  const DISCOVER_LEADS = {
    game_stores: [
      { name: "Critical Hit Games", organization: "Clearwater · tabletop & RPG", email: "support@knightlogics.com" },
      { name: "Emerald City Comics", organization: "Largo / Clearwater", email: "support@knightlogics.com" },
      { name: "Gamers Asylum", organization: "Pinellas Park hobby shop", email: "support@knightlogics.com" },
    ],
    community_boards: [
      { name: "Safety Harbor Public Library", organization: "Library events board", email: "support@knightlogics.com" },
      { name: "Safety Harbor Marina", organization: "Marina bulletin board", email: "nknig@knightlogics.com" },
      { name: "Safety Harbor Community Center", organization: "Rec center events", email: "support@knightlogics.com" },
    ],
    trivia_regulars: [
      { name: "Music Bingo regular", organization: "Whistle Stop guest", email: "nknig@knightlogics.com" },
      { name: "Cornhole league player", organization: "Patio regular", email: "support@knightlogics.com" },
    ],
    meetup_adjacent: [
      { name: "Tampa Bay Tabletop Meetup", organization: "Meetup organizer", email: "support@knightlogics.com" },
      { name: "D&D Adventurers League (demo)", organization: "Organizer contact", email: "nknig@knightlogics.com" },
    ],
    vip_list: [
      { name: "Knight Logics VIP test", organization: "Demo VIP segment", email: "support@knightlogics.com" },
      { name: "Email list sample", organization: "Past event guests", email: "nknig@knightlogics.com" },
    ],
    local_press: [
      { name: "Safety Harbor Chamber", organization: "Main Street network", email: "support@knightlogics.com" },
      { name: "Old City Hall events", organization: "Downtown calendar", email: "nknig@knightlogics.com" },
    ],
  };

  async function findBestLeads(campaignId, campaign, options = {}) {
    const audienceFn = () => window.WSCampaignAudience;
    let plan;
    let added = [];
    let runtime;

    try {
      const result = await apiRequest("find-leads", {
        method: "POST",
        body: JSON.stringify({
          campaignId,
          campaign,
          useLlm: Boolean(options.useLlm),
        }),
      });
      plan = result.audience;
      added = result.added || [];
      if (result.runtime) {
        runtimeCache = result.runtime;
        writeLocalRuntime(result.runtime);
      }
      return { ok: true, plan, added, source: plan?.source || "api" };
    } catch (err) {
      plan = audienceFn()?.inferAudience(campaign) || { segments: [], summary: "" };
      plan.campaignId = campaignId;
      plan.campaignTitle = campaign.title;
      return {
        ok: false,
        plan,
        added: [],
        source: "rules-preview",
        offline: true,
        error: `Audience preview created, but no leads were added because the campaign API is offline. ${err.message}`,
      };
    }
  }

  async function sendDemoOutreachEmail({ campaignId, campaign, adminPassword, adminSessionHash }) {
    const signupLink = shareableCampaignUrl(campaign);
    const demoTo = window.WSCampaignAudience?.DEMO_TEST_EMAIL || "nickknight488@gmail.com";
    const payload = {
      campaignId,
      campaign,
      signupLink,
      demoTo,
      demoName: "Nicholas",
      adminPassword,
      adminSessionHash,
    };

    try {
      const data = await apiRequest("outreach-demo", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const via = data.delivery?.via || data.sent?.[0]?.via || "api";
      const localOnly = data.localOnly !== false && !data.delivered;
      return { ...data, localOnly, via };
    } catch (err) {
      const buildMail = window.WSCampaignAudience?.buildOutreachEmail;
      if (!buildMail) throw new Error("Campaign audience module failed to load. Hard refresh and try again.");
      const mail = buildMail(
        campaign,
        { name: "Nicholas", email: demoTo, organization: "Demo test" },
        { signup_link: signupLink, goal: campaign.signupGoal || 12 }
      );
      const runtime = await getRuntime();
      runtime.emailLog = runtime.emailLog || [];
      runtime.emailLog.push({
        id: uid("em"),
        campaignId,
        leadId: "demo-test",
        to: demoTo,
        subject: mail.subject,
        bodyPreview: mail.text.slice(0, 280),
        status: "previewed",
        previewedAt: new Date().toISOString(),
        via: "local-demo-html",
        demo: true,
        html: true,
        localOnly: true,
      });
      writeLocalRuntime(runtime);
      return {
        ok: true,
        localOnly: true,
        mail: { to: demoTo, subject: mail.subject, html: mail.html, text: mail.text },
        apiError: err.message,
      };
    }
  }

  async function discoverLeads(campaignId, leadType) {
    try {
      const campaign = (await getCampaigns()).campaigns.find((c) => c.id === campaignId);
      const result = await findBestLeads(campaignId, campaign, { useLlm: true, leadType });
      return result.added || [];
    } catch (_) {
      return [];
    }
  }

  function onRuntimeChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function promoteToEventDraft(campaign, signups) {
    const nights = [...new Set(signups.map((s) => s.preferredNight).filter(Boolean))];
    const nightHint = nights.length ? nights.join(" / ") : "TBD";
    return {
      title: campaign.title,
      date: "",
      time: "6:00 PM",
      location: "Patio",
      description: `${campaign.description}\n\nInterest check reached ${signups.length} signups (goal: ${campaign.signupGoal}). Preferred windows: ${nightHint}. Promoted from Campaign Calendar.`,
      category: "special",
      promotedFromCampaign: campaign.id,
    };
  }

  const DEFAULT_LEAD_TYPES = [
    {
      id: "vip_list",
      label: "Email list & regulars",
      description: "Past guests and locals on the email list",
    },
    {
      id: "community_boards",
      label: "Community boards",
      description: "Library, marina, and local bulletin boards",
    },
    {
      id: "trivia_regulars",
      label: "Event regulars",
      description: "Guests who already come for trivia, bingo, cornhole, etc.",
    },
  ];

  function buildCampaignFromForm(form) {
    const type = form.type || "interest_check";
    const title = String(form.title || "").trim();
    const slug = slugify(form.slug || title);
    if (!title) throw new Error("Campaign title is required.");
    if (!slug) throw new Error("Campaign slug is required.");

    const draftForAudience = {
      id: slug,
      slug,
      type,
      title,
      headline: String(form.headline || title).trim(),
      description: String(form.description || "").trim(),
    };
    const inferred =
      global.WSCampaignAudience?.inferAudience
        ? global.WSCampaignAudience.inferAudience(draftForAudience)
        : null;

    const campaign = {
      id: slug,
      slug,
      type,
      status: type === "interest_check" ? "interest_check" : "active",
      title,
      headline: draftForAudience.headline,
      description: draftForAudience.description,
      channels: form.channels?.length ? form.channels : ["email", "social"],
      endAt: String(form.endAt || "").trim() || null,
      automation: {
        enabled: Boolean(form.automationEnabled),
        cadenceMinutes: 60,
        maxPerRun: 1,
        randomDelayMinutes: { min: 5, max: 50 },
        timezone: "America/New_York",
        sendWindow: { start: "10:00", end: "19:00" },
        continueAfterGoal: true,
      },
      landingPath: "campaign.html",
      leadTypes: (inferred?.segments || DEFAULT_LEAD_TYPES).map((seg) => ({
        id: seg.id,
        label: seg.label,
        description: seg.description,
      })),
      emailSubject: String(form.emailSubject || `${title} — Whistle Stop`).trim(),
      emailBody:
        String(form.emailBody || "").trim() ||
        `Hi {{name}},\n\nWe're sharing something new at Whistle Stop.\n\nDetails & link:\n{{signup_link}}\n\n— Whistle Stop team`,
      socialDraft: String(form.socialDraft || "").trim() || `${title} at Whistle Stop — details:`,
      createdAt: new Date().toISOString(),
      staffCreated: true,
    };

    if (type === "interest_check") {
      campaign.signupGoal = Math.max(1, Number(form.signupGoal) || 12);
      campaign.preferredWindows = [];
    }

    if (type === "info") {
      campaign.showSignup = Boolean(form.showSignup);
      campaign.eyebrow = String(form.eyebrow || "Special offer").trim();
      const ctaLabel = String(form.ctaLabel || "").trim();
      const ctaUrl = String(form.ctaUrl || "").trim();
      if (ctaLabel && ctaUrl) {
        campaign.ctas = [{ label: ctaLabel, url: ctaUrl, external: /^https?:\/\//i.test(ctaUrl) }];
      }
      if (form.heroImage) campaign.heroImage = form.heroImage.trim();
    }

    if (type === "event_promo") {
      campaign.showSignup = Boolean(form.showSignup);
      campaign.eyebrow = String(form.eyebrow || "Save the date").trim();
      campaign.eventDate = String(form.eventDate || "").trim();
      campaign.eventTime = String(form.eventTime || "").trim();
      campaign.location = String(form.location || "Patio · Whistle Stop Grill & Bar").trim();
      if (form.heroImage) campaign.heroImage = form.heroImage.trim();
      campaign.ctas = [{ label: "Full events calendar", url: "events.html" }];
    }

    return campaign;
  }

  async function saveCampaign(form) {
    const campaign = buildCampaignFromForm(form);
    const custom = readLocalCampaigns();
    const idx = custom.findIndex((c) => c.id === campaign.id);
    if (idx >= 0) custom[idx] = campaign;
    else custom.unshift(campaign);
    writeLocalCampaigns(custom);
    invalidateCampaignsCache();
    return campaign;
  }

  async function patchCampaign(campaignId, patch) {
    const { campaigns } = await getCampaigns();
    const existing = campaigns.find((c) => c.id === campaignId);
    if (!existing) throw new Error("Campaign not found.");
    const custom = readLocalCampaigns();
    const idx = custom.findIndex((c) => c.id === campaignId);
    const merged = { ...existing, ...patch, id: campaignId, slug: existing.slug || campaignId };
    if (idx >= 0) custom[idx] = { ...custom[idx], ...patch };
    else custom.push({ ...merged, staffCreated: Boolean(existing.staffCreated) });
    writeLocalCampaigns(custom);
    invalidateCampaignsCache();
    return merged;
  }

  function outreachImagePreviewSrc(campaign) {
    return global.WSCampaignAudience?.resolveOutreachImageSrc?.(campaign) || campaign.outreachImageData || campaign.outreachImage || "";
  }

  async function publishCampaigns(auth = {}) {
    const { campaigns } = await getCampaigns();
    try {
      const result = await apiRequest("publish", {
        method: "POST",
        body: JSON.stringify({ campaigns, ...auth }),
      });
      writeLocalCampaigns([]);
      invalidateCampaignsCache();
      return result;
    } catch (err) {
      return { ok: false, error: err.message, localOnly: true, campaigns };
    }
  }

  async function getServiceHealth() {
    try {
      return await apiRequest("health", { method: "GET" });
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  function hasUnpublishedCampaigns() {
    return readLocalCampaigns().length > 0;
  }

  global.WSCampaignStore = {
    getCampaigns,
    getCampaignBySlug,
    getRuntime,
    getSignupsForCampaign,
    getSignupCount,
    getLeadsForCampaign,
    getEmailLogForCampaign,
    signupUrl,
    shareableCampaignUrl,
    renderTemplate,
    submitSignup,
    syncRuntimeFromCloud,
    sendOutreachEmail,
    discoverLeads,
    findBestLeads,
    sendDemoOutreachEmail,
    onRuntimeChange,
    promoteToEventDraft,
    saveCampaign,
    patchCampaign,
    outreachImagePreviewSrc,
    publishCampaigns,
    getServiceHealth,
    hasUnpublishedCampaigns,
    slugify,
    invalidateCampaignsCache,
    API_BASE,
  };
})(typeof window !== "undefined" ? window : globalThis);
