'use strict';

const crypto = require('crypto');
let neonFactory = null;

const MODEL = process.env.WS_CAMPAIGN_OPENAI_MODEL || 'gpt-5.4-nano';
const PUBLIC_SITE = process.env.WS_CAMPAIGN_PUBLIC_SITE || 'https://knight-logics.github.io/Whistle-Stop/';
const CAMPAIGNS_URL = `${PUBLIC_SITE.replace(/\/$/, '')}/data/campaigns.json`;
const ADDRESS = 'Whistle Stop Grill & Bar · 915 Main Street · Safety Harbor, FL 34695';
const ALLOWED_ORIGINS = new Set([
  'https://knight-logics.github.io',
  'https://www.whistlestopgrill.com',
  'https://whistlestopgrill.com',
  'https://knightlogics.com',
  'https://www.knightlogics.com',
]);
const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
]);

function databaseUrl() {
  return process.env.KL_DATABASE_URL || process.env.DATABASE_URL || '';
}

function db() {
  const url = databaseUrl();
  if (!url) throw new Error('Private campaign database is not configured.');
  if (!neonFactory) neonFactory = require('@neondatabase/serverless').neon;
  return neonFactory(url);
}

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return /^http:\/\/(127\.0\.0\.1|localhost):\d+$/i.test(origin);
}

function getCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : 'https://knight-logics.github.io',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-WS-Admin-Hash, X-WS-Runner-Key, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function sendJson(res, status, body, cors) {
  res.writeHead(status, {
    ...cors,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const preloaded = req.rawBody ?? req.body;
  if (typeof preloaded === 'string' || Buffer.isBuffer(preloaded) || preloaded instanceof Uint8Array) {
    const text = Buffer.from(preloaded).toString('utf8');
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (_) {
      throw new Error('Invalid JSON request body.');
    }
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += part.length;
    if (size > 1024 * 1024) throw new Error('Request body is too large.');
    chunks.push(part);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (_) {
    throw new Error('Invalid JSON request body.');
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function authorizeAdmin(req, body = {}) {
  const expected = process.env.WS_ADMIN_PASSWORD_HASH || '';
  if (!expected) return { ok: false, error: 'Campaign admin auth is not configured.' };
  const headerHash = req.headers?.['x-ws-admin-hash'] || '';
  if (headerHash && safeEqual(headerHash, expected)) return { ok: true, method: 'session-hash' };
  const sessionHash = String(body.adminSessionHash || '');
  if (sessionHash && safeEqual(sessionHash, expected)) return { ok: true, method: 'session-hash' };
  const password = String(body.adminPassword || '');
  if (password && password.length <= 256 && safeEqual(sha256(password), expected)) {
    return { ok: true, method: 'password' };
  }
  return { ok: false, error: 'Sign in to Whistle Stop staff admin again.' };
}

function authorizeRunner(req) {
  const authorization = String(req.headers?.authorization || '');
  const bearer = authorization.replace(/^Bearer\s+/i, '');
  const cronSecret = process.env.CRON_SECRET || '';
  if (cronSecret && bearer && safeEqual(bearer, cronSecret)) return true;
  const supplied = String(req.headers?.['x-ws-runner-key'] || '');
  const expected = process.env.WS_CAMPAIGN_RUNNER_KEY || process.env.WS_SOCIAL_API_KEY || '';
  return Boolean(expected && supplied && safeEqual(supplied, expected));
}

async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS ws_campaign_signups (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'guest',
      preferred_night TEXT NOT NULL DEFAULT '',
      experience TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'web',
      notes TEXT NOT NULL DEFAULT '',
      consent_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(campaign_id, email)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS ws_campaign_leads (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      lead_type TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      organization TEXT NOT NULL DEFAULT '',
      locality TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new',
      source_url TEXT NOT NULL,
      provenance TEXT NOT NULL DEFAULT 'public_business_contact',
      discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_contacted_at TIMESTAMPTZ,
      UNIQUE(campaign_id, email)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS ws_campaign_email_log (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      lead_id TEXT NOT NULL,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL,
      provider_id TEXT,
      error TEXT,
      automated BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sent_at TIMESTAMPTZ
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS ws_campaign_suppression (
      email TEXT PRIMARY KEY,
      reason TEXT NOT NULL DEFAULT 'unsubscribe',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS ws_campaign_leads_next_idx ON ws_campaign_leads(campaign_id, status, discovered_at)`;
  await sql`CREATE INDEX IF NOT EXISTS ws_campaign_email_campaign_idx ON ws_campaign_email_log(campaign_id, sent_at DESC)`;
}

function cleanText(value, max = 500) {
  return String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max);
}

function cleanEmail(value) {
  const email = String(value || '').trim().toLowerCase().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
  return email;
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}`;
}

function signupRow(row) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    preferredNight: row.preferred_night,
    experience: row.experience,
    source: row.source,
    notes: row.notes,
    consentAt: row.consent_at,
    createdAt: row.created_at,
  };
}

function leadRow(row) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    leadType: row.lead_type,
    name: row.name,
    email: row.email,
    organization: row.organization,
    locality: row.locality,
    status: row.status,
    sourceUrl: row.source_url,
    provenance: row.provenance,
    discoveredAt: row.discovered_at,
    lastContactedAt: row.last_contacted_at,
  };
}

function emailRow(row) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    leadId: row.lead_id,
    to: row.to_email,
    subject: row.subject,
    status: row.status,
    providerId: row.provider_id,
    error: row.error,
    automated: row.automated,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  };
}

async function runtimePayload(req, body = {}) {
  const sql = db();
  await ensureSchema(sql);
  const counts = await sql`SELECT campaign_id, COUNT(*)::int AS count FROM ws_campaign_signups GROUP BY campaign_id`;
  const signupCounts = Object.fromEntries(counts.map((row) => [row.campaign_id, Number(row.count)]));
  const auth = authorizeAdmin(req, body);
  if (!auth.ok) {
    return {
      version: 2,
      updatedAt: new Date().toISOString(),
      privacy: 'aggregate-only',
      signupCounts,
      signups: [],
      outreachLeads: [],
      emailLog: [],
    };
  }
  const [signups, leads, emailLog] = await Promise.all([
    sql`SELECT * FROM ws_campaign_signups ORDER BY created_at DESC LIMIT 1000`,
    sql`SELECT * FROM ws_campaign_leads ORDER BY discovered_at DESC LIMIT 1000`,
    sql`SELECT * FROM ws_campaign_email_log ORDER BY created_at DESC LIMIT 1000`,
  ]);
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    privacy: 'private-admin',
    signupCounts,
    signups: signups.map(signupRow),
    outreachLeads: leads.map(leadRow),
    emailLog: emailLog.map(emailRow),
  };
}

async function fetchCampaigns() {
  const response = await fetch(`${CAMPAIGNS_URL}?_=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load campaigns (${response.status}).`);
  const payload = await response.json();
  return Array.isArray(payload.campaigns) ? payload.campaigns : [];
}

async function handleSignup(body) {
  const input = body.signup || {};
  const campaignId = cleanText(input.campaignId, 80);
  const name = cleanText(input.name, 120);
  const email = cleanEmail(input.email);
  const consentAt = cleanText(input.consentAt, 60);
  if (!campaignId || !name || !email) throw new Error('Campaign, name, and email are required.');
  if (!input.marketingConsent || !consentAt || Number.isNaN(Date.parse(consentAt))) {
    throw new Error('Signup consent is required.');
  }
  const campaigns = await fetchCampaigns();
  const campaign = campaigns.find((item) => item.id === campaignId || item.slug === campaignId);
  if (!campaign) throw new Error('Campaign is not active.');
  if (campaign.endAt && Date.parse(campaign.endAt) <= Date.now()) throw new Error('This campaign has ended.');

  const sql = db();
  await ensureSchema(sql);
  const id = cleanText(input.id, 90) || uid('su');
  const rows = await sql`
    INSERT INTO ws_campaign_signups (
      id, campaign_id, name, email, phone, role, preferred_night, experience, source, notes, consent_at
    ) VALUES (
      ${id}, ${campaign.id}, ${name}, ${email}, ${cleanText(input.phone, 40)}, ${cleanText(input.role, 40) || 'guest'},
      ${cleanText(input.preferredNight, 100)}, ${cleanText(input.experience, 80)}, ${cleanText(input.source, 80) || 'web'},
      ${cleanText(input.notes, 1000)}, ${new Date(consentAt).toISOString()}
    )
    ON CONFLICT (campaign_id, email) DO UPDATE SET
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      role = EXCLUDED.role,
      preferred_night = EXCLUDED.preferred_night,
      experience = EXCLUDED.experience,
      source = EXCLUDED.source,
      notes = EXCLUDED.notes,
      consent_at = EXCLUDED.consent_at
    RETURNING *
  `;
  return signupRow(rows[0]);
}

function rulesAudience(campaign) {
  const text = `${campaign.title || ''} ${campaign.headline || ''} ${campaign.description || ''}`.toLowerCase();
  const tabletop = /d&d|dnd|dungeons|tabletop|rpg|game night/.test(text);
  const segments = tabletop
    ? [
        { id: 'game_stores', label: 'Local game and hobby shops', searchQueries: ['tabletop game store Safety Harbor Clearwater contact'] },
        { id: 'meetup_adjacent', label: 'Tabletop organizers', searchQueries: ['Dungeons Dragons organizer Tampa Bay contact'] },
        { id: 'community_boards', label: 'Community calendars', searchQueries: ['Safety Harbor community events calendar contact'] },
      ]
    : [
        { id: 'community_boards', label: 'Community calendars', searchQueries: [`${campaign.title} Safety Harbor organization contact`] },
        { id: 'local_press', label: 'Local event publications', searchQueries: [`${campaign.title} Tampa Bay events contact`] },
      ];
  return { source: 'rules', summary: `Localized organizational audiences for ${campaign.title}.`, segments };
}

function responseText(payload) {
  if (typeof payload.output_text === 'string') return payload.output_text;
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === 'string') return content.text;
    }
  }
  return '';
}

async function openAiAudienceAndLeads(campaign) {
  if (!process.env.OPENAI_API_KEY) return { audience: rulesAudience(campaign), leads: [], source: 'rules' };
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'segments', 'leads'],
    properties: {
      summary: { type: 'string' },
      segments: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'label', 'rationale', 'searchQueries'],
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            rationale: { type: 'string' },
            searchQueries: { type: 'array', maxItems: 4, items: { type: 'string' } },
          },
        },
      },
      leads: {
        type: 'array',
        maxItems: 10,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['leadType', 'name', 'organization', 'email', 'locality', 'sourceUrl'],
          properties: {
            leadType: { type: 'string' },
            name: { type: 'string' },
            organization: { type: 'string' },
            email: { type: 'string' },
            locality: { type: 'string' },
            sourceUrl: { type: 'string' },
          },
        },
      },
    },
  };
  const prompt = [
    'Build a local outreach audience for this Whistle Stop Grill & Bar campaign in Safety Harbor, Florida.',
    'Use web search. Return only organizations or public business contacts relevant to the topic.',
    'Every lead must have an exact public business email and the exact HTTPS page where that email is visibly published.',
    'Do not return personal emails, guessed emails, scraped consumer data, or a lead without evidence.',
    `Campaign JSON: ${JSON.stringify({ title: campaign.title, headline: campaign.headline, description: campaign.description, type: campaign.type })}`,
  ].join('\n');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      reasoning: { effort: 'low' },
      tools: [{ type: 'web_search' }],
      input: prompt,
      text: { format: { type: 'json_schema', name: 'whistle_stop_campaign_audience', strict: true, schema } },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `OpenAI request failed (${response.status}).`);
  const parsed = JSON.parse(responseText(payload));
  return {
    audience: { source: `openai:${MODEL}`, summary: cleanText(parsed.summary, 1000), segments: parsed.segments || [] },
    leads: parsed.leads || [],
    source: `openai:${MODEL}+web_search`,
  };
}

async function verifyPublicLead(candidate) {
  const email = cleanEmail(candidate.email);
  if (!email || PERSONAL_EMAIL_DOMAINS.has(email.split('@')[1])) return null;
  let url;
  try {
    url = new URL(candidate.sourceUrl);
  } catch (_) {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  try {
    const response = await fetch(url.href, {
      redirect: 'follow',
      headers: { 'User-Agent': 'KnightLogics-WhistleStopCampaignVerifier/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const text = (await response.text()).slice(0, 1500000).toLowerCase();
    if (!text.includes(email)) return null;
    return {
      leadType: cleanText(candidate.leadType, 80) || 'local_organization',
      name: cleanText(candidate.name, 160) || cleanText(candidate.organization, 160),
      organization: cleanText(candidate.organization, 200),
      email,
      locality: cleanText(candidate.locality, 160),
      sourceUrl: url.href.slice(0, 1000),
    };
  } catch (_) {
    return null;
  }
}

async function handleFindLeads(campaignId, campaign) {
  const sql = db();
  await ensureSchema(sql);
  let planned;
  try {
    planned = await openAiAudienceAndLeads(campaign);
  } catch (err) {
    planned = { audience: rulesAudience(campaign), leads: [], source: 'rules', warning: err.message };
  }
  const verified = (await Promise.all((planned.leads || []).slice(0, 10).map(verifyPublicLead))).filter(Boolean);
  const added = [];
  for (const lead of verified) {
    const rows = await sql`
      INSERT INTO ws_campaign_leads (
        id, campaign_id, lead_type, name, email, organization, locality, source_url, provenance
      ) VALUES (
        ${uid('lead')}, ${campaignId}, ${lead.leadType}, ${lead.name}, ${lead.email}, ${lead.organization},
        ${lead.locality}, ${lead.sourceUrl}, 'verified_public_business_contact'
      )
      ON CONFLICT (campaign_id, email) DO NOTHING
      RETURNING *
    `;
    if (rows[0]) added.push(leadRow(rows[0]));
  }
  return { ok: true, audience: planned.audience, added, source: planned.source, warning: planned.warning || null };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTemplate(template, values) {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '');
}

function signingSecret() {
  return process.env.WS_CAMPAIGN_UNSUBSCRIBE_SECRET || process.env.WS_SOCIAL_API_KEY || process.env.WS_ADMIN_PASSWORD_HASH || '';
}

function unsubscribeToken(email) {
  const payload = Buffer.from(JSON.stringify({ email, issuedAt: Date.now() }), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', signingSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyUnsubscribeToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature || !signingSecret()) return '';
  const expected = crypto.createHmac('sha256', signingSecret()).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return '';
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded.issuedAt || Date.now() - Number(decoded.issuedAt) > 180 * 24 * 60 * 60 * 1000) return '';
    return cleanEmail(decoded.email);
  } catch (_) {
    return '';
  }
}

function buildCompliantEmail(campaign, lead, subjectInput, bodyInput) {
  const signupLink = `${PUBLIC_SITE}campaign.html?campaign=${encodeURIComponent(campaign.slug || campaign.id)}`;
  const vars = {
    name: lead.name || 'there',
    organization: lead.organization || lead.name || 'your organization',
    signup_link: signupLink,
    goal: campaign.signupGoal || 12,
  };
  const subject = cleanText(subjectInput || campaign.emailSubject || `${campaign.title} at Whistle Stop`, 180);
  const textBody = renderTemplate(bodyInput || campaign.emailBody || campaign.description, vars);
  const unsubscribeUrl = `${PUBLIC_SITE}unsubscribe.html?token=${encodeURIComponent(unsubscribeToken(lead.email))}`;
  const htmlBody = escapeHtml(textBody).replace(/\n/g, '<br>');
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
    <div style="max-width:640px;margin:auto;padding:24px">
      <p style="font-size:12px;color:#666">Advertisement from Whistle Stop Grill &amp; Bar</p>
      <p>${htmlBody}</p>
      <hr style="border:0;border-top:1px solid #ddd;margin:28px 0">
      <p style="font-size:12px;color:#666">${escapeHtml(ADDRESS)}<br>
      <a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from Whistle Stop marketing email</a></p>
    </div></body></html>`;
  return { subject, html, text: `${textBody}\n\nAdvertisement\n${ADDRESS}\nUnsubscribe: ${unsubscribeUrl}` };
}

let zohoAccountCache = null;
async function zohoSession() {
  const clientId = process.env.EMAIL_AGENT_ZOHO_CLIENT_ID;
  const clientSecret = process.env.EMAIL_AGENT_ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.EMAIL_AGENT_ZOHO_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) throw new Error('Zoho outreach email is not configured.');
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', { method: 'POST', body: params });
  const tokenPayload = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new Error(tokenPayload.error || `Zoho token refresh failed (${tokenResponse.status}).`);
  }
  const accessToken = tokenPayload.access_token;
  if (zohoAccountCache?.accountId && zohoAccountCache?.fromAddress) return { accessToken, ...zohoAccountCache };
  const accountResponse = await fetch('https://mail.zoho.com/api/accounts', {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  const accountPayload = await accountResponse.json().catch(() => ({}));
  if (!accountResponse.ok) throw new Error(`Zoho account lookup failed (${accountResponse.status}).`);
  const accounts = accountPayload.data || [];
  const preferred = cleanEmail(process.env.WS_OUTREACH_FROM_EMAIL);
  const account = accounts.find((row) => cleanEmail(row.emailAddress) === preferred) || accounts[0];
  if (!account?.accountId || !account?.emailAddress) throw new Error('No Zoho sender account is available.');
  zohoAccountCache = { accountId: String(account.accountId), fromAddress: String(account.emailAddress) };
  return { accessToken, ...zohoAccountCache };
}

async function sendZoho(mail, to) {
  const session = await zohoSession();
  const response = await fetch(`https://mail.zoho.com/api/accounts/${session.accountId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${session.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromAddress: session.fromAddress,
      toAddress: to,
      subject: mail.subject,
      content: mail.html,
      mailFormat: 'html',
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.status?.code === 400) {
    throw new Error(payload.data?.moreInfo || payload.status?.description || `Zoho send failed (${response.status}).`);
  }
  return { providerId: String(payload.data?.messageId || payload.data?.messageURI || '') };
}

async function sendLeads({ campaign, leads, subject, body, automated = false }) {
  const sql = db();
  await ensureSchema(sql);
  const sent = [];
  const failed = [];
  for (const lead of leads.slice(0, automated ? 1 : 20)) {
    const suppressed = await sql`SELECT email FROM ws_campaign_suppression WHERE email = ${lead.email} LIMIT 1`;
    if (suppressed.length) {
      failed.push({ leadId: lead.id, email: lead.email, error: 'suppressed' });
      continue;
    }
    const mail = buildCompliantEmail(campaign, lead, subject, body);
    const logId = uid('em');
    try {
      const provider = await sendZoho(mail, lead.email);
      const rows = await sql`
        INSERT INTO ws_campaign_email_log (
          id, campaign_id, lead_id, to_email, subject, status, provider_id, automated, sent_at
        ) VALUES (
          ${logId}, ${campaign.id}, ${lead.id}, ${lead.email}, ${mail.subject}, 'sent', ${provider.providerId}, ${automated}, NOW()
        ) RETURNING *
      `;
      await sql`UPDATE ws_campaign_leads SET status = 'contacted', last_contacted_at = NOW() WHERE id = ${lead.id}`;
      sent.push(emailRow(rows[0]));
    } catch (err) {
      await sql`
        INSERT INTO ws_campaign_email_log (
          id, campaign_id, lead_id, to_email, subject, status, error, automated
        ) VALUES (
          ${logId}, ${campaign.id}, ${lead.id}, ${lead.email}, ${mail.subject}, 'error', ${cleanText(err.message, 1000)}, ${automated}
        )
      `;
      failed.push({ leadId: lead.id, email: lead.email, error: err.message });
    }
  }
  return { ok: failed.length === 0, sent, failed };
}

async function campaignsFromBodyOrLive(body) {
  if (body.campaign && body.campaign.id) return [body.campaign];
  return fetchCampaigns();
}

async function handleOutreachSend(body) {
  const campaignId = cleanText(body.campaignId, 80);
  const leadIds = [...new Set((body.leadIds || []).map((id) => cleanText(id, 100)).filter(Boolean))].slice(0, 20);
  if (!campaignId || !leadIds.length) throw new Error('Campaign and selected leads are required.');
  const campaigns = await campaignsFromBodyOrLive(body);
  const campaign = campaigns.find((item) => item.id === campaignId);
  if (!campaign) throw new Error('Campaign was not found.');
  const sql = db();
  await ensureSchema(sql);
  const rows = await sql`SELECT * FROM ws_campaign_leads WHERE campaign_id = ${campaignId} AND status IN ('new', 'queued') ORDER BY discovered_at ASC LIMIT 1000`;
  const selected = rows.filter((row) => leadIds.includes(row.id)).map(leadRow);
  if (!selected.length) throw new Error('No eligible selected leads remain.');
  return sendLeads({ campaign, leads: selected, subject: body.subject, body: body.body, automated: false });
}

async function handleDemoSend(body) {
  const campaign = body.campaign;
  const to = cleanEmail(body.demoTo);
  if (!campaign?.id || !to) throw new Error('Campaign and demo recipient are required.');
  const lead = { id: 'demo-test', name: cleanText(body.demoName, 120) || 'there', organization: 'Whistle Stop demo', email: to };
  const mail = buildCompliantEmail(campaign, lead, campaign.emailSubject, campaign.emailBody);
  const provider = await sendZoho(mail, to);
  return { ok: true, via: 'zoho', mail: { to, subject: mail.subject, html: mail.html }, providerId: provider.providerId };
}

function easternMinuteOfDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0) % 24;
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  return hour * 60 + minute;
}

function parseClock(value, fallback) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  return Math.min(1439, Math.max(0, Number(match[1]) * 60 + Number(match[2])));
}

async function handleHourlyRun() {
  const campaigns = await fetchCampaigns();
  const now = Date.now();
  const currentMinute = easternMinuteOfDay();
  const sql = db();
  await ensureSchema(sql);
  const results = [];
  for (const campaign of campaigns) {
    const automation = campaign.automation || {};
    if (!automation.enabled) continue;
    if (!campaign.endAt || Date.parse(campaign.endAt) <= now) continue;
    const start = parseClock(automation.sendWindow?.start, 600);
    const end = parseClock(automation.sendWindow?.end, 1140);
    if (currentMinute < start || currentMinute > end) continue;
    const recent = await sql`
      SELECT sent_at FROM ws_campaign_email_log
      WHERE campaign_id = ${campaign.id} AND status = 'sent'
      ORDER BY sent_at DESC NULLS LAST LIMIT 1
    `;
    const cadenceMs = Math.max(60, Number(automation.cadenceMinutes) || 60) * 60 * 1000;
    if (recent[0]?.sent_at && now - new Date(recent[0].sent_at).getTime() < cadenceMs) continue;
    const candidates = await sql`
      SELECT l.* FROM ws_campaign_leads l
      LEFT JOIN ws_campaign_suppression s ON s.email = l.email
      WHERE l.campaign_id = ${campaign.id} AND l.status IN ('new', 'queued') AND s.email IS NULL
      ORDER BY RANDOM() LIMIT 1
    `;
    if (!candidates.length) {
      results.push({ campaignId: campaign.id, ok: true, sent: 0, reason: 'no-eligible-leads' });
      continue;
    }
    const result = await sendLeads({ campaign, leads: candidates.map(leadRow), automated: true });
    results.push({ campaignId: campaign.id, ...result });
  }
  return { ok: true, ranAt: new Date().toISOString(), results };
}

async function handleUnsubscribe(body) {
  const email = verifyUnsubscribeToken(body.token);
  if (!email) throw new Error('Unsubscribe link is invalid or expired.');
  const sql = db();
  await ensureSchema(sql);
  await sql`
    INSERT INTO ws_campaign_suppression (email, reason) VALUES (${email}, 'unsubscribe')
    ON CONFLICT (email) DO UPDATE SET reason = 'unsubscribe', created_at = NOW()
  `;
  return { ok: true, message: 'You have been unsubscribed from Whistle Stop marketing email.' };
}

function healthPayload() {
  return {
    ok: true,
    service: 'whistle-stop-campaigns',
    database: Boolean(databaseUrl()),
    email: Boolean(
      process.env.EMAIL_AGENT_ZOHO_CLIENT_ID &&
        process.env.EMAIL_AGENT_ZOHO_CLIENT_SECRET &&
        process.env.EMAIL_AGENT_ZOHO_REFRESH_TOKEN &&
        process.env.WS_OUTREACH_FROM_EMAIL
    ),
    ai: Boolean(process.env.OPENAI_API_KEY),
    model: MODEL,
    aiStatus: process.env.OPENAI_API_KEY ? 'configured-not-probed' : 'not-configured',
    runnerAuthConfigured: Boolean(process.env.CRON_SECRET || process.env.WS_CAMPAIGN_RUNNER_KEY || process.env.WS_SOCIAL_API_KEY),
    scheduler: process.env.WS_CAMPAIGN_SCHEDULE_ACTIVE === '1',
    privacy: 'private-neon-with-public-aggregate-counts',
    compliance: ['verified-source-leads', 'suppression-before-send', 'unsubscribe-link', 'postal-address', 'delivery-error-logging'],
  };
}

async function handle(req, res, route, contentLib) {
  const cors = getCorsHeaders(req.headers?.origin || '');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    return res.end();
  }
  try {
    if (route === 'health' || !route) {
      return sendJson(res, 200, healthPayload(), cors);
    }
    if (route === 'runtime' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, runtime: await runtimePayload(req) }, cors);
    }
    if (route === 'signup' && req.method === 'POST') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, { ok: true, signup: await handleSignup(body) }, cors);
    }
    if (route === 'unsubscribe' && req.method === 'POST') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await handleUnsubscribe(body), cors);
    }
    if (route === 'run-hourly' && req.method === 'GET') {
      if (!authorizeRunner(req)) return sendJson(res, 401, { ok: false, error: 'Runner authorization failed.' }, cors);
      return sendJson(res, 200, await handleHourlyRun(), cors);
    }

    const body = req.method === 'POST' ? await readJsonBody(req) : {};
    const auth = authorizeAdmin(req, body);
    if (!auth.ok) return sendJson(res, 401, { ok: false, error: auth.error }, cors);

    if (route === 'find-leads' && req.method === 'POST') {
      const campaign = body.campaign || {};
      const campaignId = cleanText(body.campaignId || campaign.id, 80);
      if (!campaignId || !campaign.title) throw new Error('Campaign details are required.');
      return sendJson(res, 200, await handleFindLeads(campaignId, campaign), cors);
    }
    if (route === 'outreach-send' && req.method === 'POST') {
      return sendJson(res, 200, await handleOutreachSend(body), cors);
    }
    if (route === 'outreach-demo' && req.method === 'POST') {
      return sendJson(res, 200, await handleDemoSend(body), cors);
    }
    if (route === 'publish' && req.method === 'POST') {
      const campaigns = Array.isArray(body.campaigns) ? body.campaigns : [];
      if (!campaigns.length) throw new Error('No campaigns were provided.');
      if (!contentLib?.publishFilesToGitHub) throw new Error('Campaign publishing bridge is unavailable.');
      const file = {
        path: 'site/data/campaigns.json',
        content: `${JSON.stringify({ campaigns }, null, 2)}\n`,
        encoding: 'utf-8',
      };
      const git = await contentLib.publishFilesToGitHub([file], `Publish Whistle Stop campaigns (${new Date().toISOString()})`);
      return sendJson(res, 200, { ok: true, count: campaigns.length, commitSha: git.commitSha }, cors);
    }
    return sendJson(res, 404, { ok: false, error: 'Not found' }, cors);
  } catch (err) {
    console.error('[whistle-stop-campaigns] request failed', { route, method: req.method, message: err.message });
    return sendJson(res, 400, { ok: false, error: err.message || 'Campaign request failed.' }, cors);
  }
}

module.exports = {
  handle,
  healthPayload,
  authorizeAdmin,
  verifyUnsubscribeToken,
  unsubscribeToken,
  buildCompliantEmail,
  rulesAudience,
  cleanEmail,
};
