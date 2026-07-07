/* Whistle Stop — campaign audience inference (rules + optional LLM on server) */
(function (global) {
  const SEGMENT_CATALOG = {
    game_stores: {
      id: "game_stores",
      label: "Local game & hobby shops",
      description: "Tabletop retailers, comic shops, game cafes — Clearwater, Safety Harbor, Tampa Bay",
      keywords: ["dnd", "d&d", "dungeons", "tabletop", "board game", "rpg", "game night", "comic"],
      searchQueries: ["game store Safety Harbor FL", "comic shop Clearwater tabletop", "hobby shop Tampa Bay RPG"],
    },
    meetup_adjacent: {
      id: "meetup_adjacent",
      label: "Meetup & tabletop groups",
      description: "D&D leagues, board game meetups, RPG organizers near Safety Harbor",
      keywords: ["dnd", "meetup", "tabletop", "league", "organizer", "rpg"],
      searchQueries: ["D&D meetup Tampa Bay", "tabletop gaming group Clearwater"],
    },
    community_boards: {
      id: "community_boards",
      label: "Community & library boards",
      description: "Safety Harbor library, marina, rec center bulletin boards",
      keywords: ["community", "library", "local", "marina", "bulletin", "gift", "seasonal"],
      searchQueries: ["Safety Harbor library events", "Safety Harbor marina community board"],
    },
    trivia_regulars: {
      id: "trivia_regulars",
      label: "Trivia & game-night regulars",
      description: "Guests who already come for bingo, trivia, cornhole, patio events",
      keywords: ["trivia", "bingo", "cornhole", "league", "patio", "regular", "music bingo"],
      searchQueries: ["bar trivia Safety Harbor", "cornhole league Tampa Bay bars"],
    },
    vip_list: {
      id: "vip_list",
      label: "VIP & email list",
      description: "Past guests and email subscribers — best for promos and gift pushes",
      keywords: ["gift", "father", "mother", "holiday", "promo", "vip", "email"],
      searchQueries: ["restaurant email list Safety Harbor"],
    },
    local_press: {
      id: "local_press",
      label: "Local press & event calendars",
      description: "Safety Harbor event calendars, local blogs, Main Street partners",
      keywords: ["event", "finals", "festival", "calendar", "press", "main street"],
      searchQueries: ["Safety Harbor events calendar", "Main Street Safety Harbor businesses"],
    },
  };

  const LOCALIZED_LEAD_POOL = {
    game_stores: [
      { name: "Critical Hit Games", organization: "Clearwater · tabletop & RPG", locality: "Clearwater" },
      { name: "Emerald City Comics", organization: "Largo / Clearwater comics & games", locality: "Clearwater" },
      { name: "Gamers Asylum", organization: "Pinellas Park hobby shop", locality: "Pinellas Park" },
    ],
    meetup_adjacent: [
      { name: "Tampa Bay Tabletop Meetup", organization: "Meetup.com organizer", locality: "Tampa Bay" },
      { name: "Adventurers League Tampa", organization: "Organized play coordinator", locality: "Tampa" },
    ],
    community_boards: [
      { name: "Safety Harbor Public Library", organization: "Library events & bulletin board", locality: "Safety Harbor" },
      { name: "Safety Harbor Marina", organization: "Marina office bulletin board", locality: "Safety Harbor" },
      { name: "Safety Harbor Community Center", organization: "Rec center events desk", locality: "Safety Harbor" },
    ],
    trivia_regulars: [
      { name: "Music Bingo regular (patio)", organization: "Whistle Stop guest segment", locality: "Safety Harbor" },
      { name: "Cornhole league contact", organization: "Patio league organizer", locality: "Safety Harbor" },
    ],
    vip_list: [
      { name: "Whistle Stop email list", organization: "Past event guests", locality: "Safety Harbor" },
    ],
    local_press: [
      { name: "Safety Harbor Chamber", organization: "Main Street business network", locality: "Safety Harbor" },
      { name: "Old City Hall events", organization: "Downtown Safety Harbor calendar", locality: "Safety Harbor" },
    ],
  };

  const DEMO_TEST_EMAIL = "nickknight488@gmail.com";

  function scoreSegment(segment, text) {
    let score = 0;
    segment.keywords.forEach((kw) => {
      if (text.includes(kw)) score += 2;
    });
    return score;
  }

  function inferAudience(campaign) {
    const text = `${campaign.title || ""} ${campaign.headline || ""} ${campaign.description || ""} ${campaign.type || ""}`.toLowerCase();
    const type = campaign.type || "interest_check";

    const scored = Object.values(SEGMENT_CATALOG)
      .map((seg) => ({ seg, score: scoreSegment(seg, text) }))
      .sort((a, b) => b.score - a.score);

    let picks = scored.filter((s) => s.score > 0).slice(0, 4).map((s) => s.seg);

    if (!picks.length) {
      if (type === "interest_check") {
        picks = [
          SEGMENT_CATALOG.game_stores,
          SEGMENT_CATALOG.meetup_adjacent,
          SEGMENT_CATALOG.community_boards,
          SEGMENT_CATALOG.trivia_regulars,
        ];
      } else if (type === "event_promo") {
        picks = [SEGMENT_CATALOG.trivia_regulars, SEGMENT_CATALOG.local_press, SEGMENT_CATALOG.community_boards];
      } else {
        picks = [SEGMENT_CATALOG.vip_list, SEGMENT_CATALOG.community_boards];
      }
    }

    const segments = picks.map((seg) => ({
      id: seg.id,
      label: seg.label,
      description: seg.description,
      searchQueries: seg.searchQueries,
      rationale: `Matched for ${campaign.title || "this campaign"} near Safety Harbor / Tampa Bay.`,
    }));

    return {
      source: "rules",
      locality: "Safety Harbor, FL · Tampa Bay area",
      summary: `Target ${segments.length} local segments for “${campaign.title || campaign.slug}”.`,
      segments,
    };
  }

  function leadsForSegment(segmentId, demoEmail) {
    const pool = LOCALIZED_LEAD_POOL[segmentId] || [];
    return pool.map((row) => ({
      ...row,
      email: demoEmail || DEMO_TEST_EMAIL,
      leadType: segmentId,
    }));
  }

  function buildOutreachEmail(campaign, lead, vars) {
    const name = lead.name || "there";
    const org = lead.organization || lead.name || "your organization";
    const link = vars.signup_link || "";
    const goal = vars.goal || campaign.signupGoal || 12;
    const headline = campaign.headline || campaign.title;
    const subject = campaign.emailSubject || `${campaign.title} — Whistle Stop, Safety Harbor`;

    const text = `Hi ${name},

Whistle Stop Grill & Bar on Main Street in Safety Harbor is running a local campaign: ${headline}.

${campaign.description || ""}

${campaign.type === "interest_check" ? `We're collecting interest first — goal is ${goal} signups before we schedule anything.` : ""}

Learn more or share with your crowd:
${link}

Thanks,
Whistle Stop team
915 Main Street · Safety Harbor, FL
(727) 726-1956`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#141414;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#141414;padding:24px 12px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1f1f1f;border-radius:12px;border:1px solid #2a2a2a;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#2a2418,#141414);padding:20px 24px;border-bottom:2px solid #b8e04a;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#b8e04a;">Whistle Stop · Safety Harbor</p>
          <h1 style="margin:0;font-size:22px;line-height:1.25;color:#f4efe4;font-weight:700;">${escapeHtml(headline)}</h1>
        </td></tr>
        <tr><td style="padding:24px;color:#d9d2c4;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
          <p style="margin:0 0 16px;">We're reaching out to <strong style="color:#f4efe4;">${escapeHtml(org)}</strong> because you're a great fit for this local push on Main Street.</p>
          <p style="margin:0 0 16px;">${escapeHtml(campaign.description || "")}</p>
          ${campaign.type === "interest_check" ? `<p style="margin:0 0 16px;color:#a8a095;">Interest-check only — we'll schedule if we hit <strong style="color:#b8e04a;">${goal}</strong> signups.</p>` : ""}
          <p style="margin:24px 0;text-align:center;">
            <a href="${escapeHtml(link)}" style="display:inline-block;background:#b8e04a;color:#141414;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;">View campaign page</a>
          </p>
          <p style="margin:0;font-size:13px;color:#a8a095;">Whistle Stop Grill &amp; Bar · 915 Main Street · Safety Harbor, FL · (727) 726-1956</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    return { subject, text, html };
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  global.WSCampaignAudience = {
    SEGMENT_CATALOG,
    LOCALIZED_LEAD_POOL,
    DEMO_TEST_EMAIL,
    inferAudience,
    leadsForSegment,
    buildOutreachEmail,
  };
})(typeof window !== "undefined" ? window : globalThis);
