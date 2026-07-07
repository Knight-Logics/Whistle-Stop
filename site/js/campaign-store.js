/* Whistle Stop — campaign definitions + runtime (signups, outreach, email log) */
(function (global) {
  const CAMPAIGNS_FILE = "data/campaigns.json";
  const RUNTIME_FILE = "data/campaign-runtime.json";
  const LOCAL_RUNTIME_KEY = "ws_campaign_runtime_v1";
  const API_BASE = "https://knightlogics.com/api/whistle-stop-campaigns";
  const LIVE_RUNTIME_URL =
    "https://knight-logics.github.io/Whistle-Stop/data/campaign-runtime.json";

  let campaignsCache = null;
  let runtimeCache = null;
  let listeners = new Set();

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
      const seen = new Set((out[key] || []).map((r) => r.id));
      (overlay[key] || []).forEach((row) => {
        if (!row?.id || seen.has(row.id)) return;
        out[key].push(row);
        seen.add(row.id);
      });
    };
    ["signups", "outreachLeads", "emailLog"].forEach(mergeList);
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
    campaignsCache = data;
    return structuredClone(data);
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

  function getLeadsForCampaign(runtime, campaignId, leadType) {
    let rows = (runtime.outreachLeads || []).filter((l) => l.campaignId === campaignId);
    if (leadType) rows = rows.filter((l) => l.leadType === leadType);
    return rows;
  }

  function getEmailLogForCampaign(runtime, campaignId) {
    return (runtime.emailLog || []).filter((e) => e.campaignId === campaignId);
  }

  function signupUrl(campaign, baseOverride) {
    const base =
      baseOverride ||
      (typeof location !== "undefined" ? location.origin + location.pathname.replace(/[^/]+$/, "") : "");
    const file = campaign.landingPath || "campaign.html";
    const url = new URL(file, base.endsWith("/") ? base : base + "/");
    url.searchParams.set("campaign", campaign.slug || campaign.id);
    return url.href;
  }

  function renderTemplate(tpl, vars) {
    return String(tpl || "").replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
  }

  async function apiRequest(route, options = {}) {
    const url = `${API_BASE}/${route}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `API ${res.status}`);
    }
    return data;
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
      const runtime = await getRuntime();
      runtime.signups = runtime.signups || [];
      runtime.signups.push(signup);
      runtime.updatedAt = new Date().toISOString();
      writeLocalRuntime(runtime);
      return { signup, localOnly: true, apiError: err.message };
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

  async function sendOutreachEmail({ campaignId, leadIds, subject, body, adminPassword }) {
    const payload = { campaignId, leadIds, subject, body, adminPassword };
    try {
      const campaign = (await getCampaigns()).campaigns.find((c) => c.id === campaignId);
      payload.signupLink = campaign ? signupUrl(campaign) : "";
      payload.goal = campaign?.signupGoal || 12;
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
      const runtime = await getRuntime();
      const campaign = (await getCampaigns()).campaigns.find((c) => c.id === campaignId);
      const leads = (runtime.outreachLeads || []).filter((l) => leadIds.includes(l.id));
      const sent = [];
      const signupLink = campaign ? signupUrl(campaign) : "";
      leads.forEach((lead) => {
        const personalized = renderTemplate(body, {
          name: lead.name,
          organization: lead.organization || lead.name,
          signup_link: signupLink,
          goal: campaign?.signupGoal || 12,
        });
        const entry = {
          id: uid("em"),
          campaignId,
          leadId: lead.id,
          to: lead.email,
          subject,
          bodyPreview: personalized.slice(0, 280),
          status: "sent",
          sentAt: new Date().toISOString(),
          via: "local-demo",
          localOnly: true,
        };
        runtime.emailLog = runtime.emailLog || [];
        runtime.emailLog.push(entry);
        lead.status = "contacted";
        sent.push(entry);
      });
      runtime.updatedAt = new Date().toISOString();
      writeLocalRuntime(runtime);
      return { ok: true, sent, localOnly: true, apiError: err.message };
    }
  }

  const DISCOVER_LEADS = {
    game_stores: [
      { name: "Critical Hit Games", organization: "Clearwater hobby shop", email: "support@knightlogics.com" },
      { name: "Emerald City Comics", organization: "Largo / Clearwater", email: "nknig@knightlogics.com" },
      { name: "Gamers Cave (demo)", organization: "Safety Harbor area", email: "support@knightlogics.com" },
    ],
    community_boards: [
      { name: "Safety Harbor Public Library", organization: "Events bulletin", email: "support@knightlogics.com" },
      { name: "Marina bulletin board", organization: "Safety Harbor Marina", email: "nknig@knightlogics.com" },
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
      { name: "Knight Logics VIP test", organization: "Demo segment", email: "support@knightlogics.com" },
      { name: "Email list sample", organization: "Past event guests", email: "nknig@knightlogics.com" },
    ],
  };

  async function discoverLeads(campaignId, leadType) {
    const pool = DISCOVER_LEADS[leadType] || [];
    const runtime = await getRuntime();
    const existing = new Set(
      (runtime.outreachLeads || [])
        .filter((l) => l.campaignId === campaignId && l.leadType === leadType)
        .map((l) => `${l.email}|${l.name}`)
    );
    const added = [];
    pool.forEach((row) => {
      const key = `${row.email}|${row.name}`;
      if (existing.has(key)) return;
      const lead = {
        id: uid("lead"),
        campaignId,
        leadType,
        name: row.name,
        email: row.email,
        organization: row.organization,
        status: "new",
        discoveredAt: new Date().toISOString(),
      };
      runtime.outreachLeads = runtime.outreachLeads || [];
      runtime.outreachLeads.push(lead);
      added.push(lead);
      existing.add(key);
    });
    runtime.updatedAt = new Date().toISOString();
    writeLocalRuntime(runtime);
    return added;
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

  global.WSCampaignStore = {
    getCampaigns,
    getCampaignBySlug,
    getRuntime,
    getSignupsForCampaign,
    getLeadsForCampaign,
    getEmailLogForCampaign,
    signupUrl,
    renderTemplate,
    submitSignup,
    syncRuntimeFromCloud,
    sendOutreachEmail,
    discoverLeads,
    onRuntimeChange,
    promoteToEventDraft,
    API_BASE,
  };
})(typeof window !== "undefined" ? window : globalThis);
