/* Whistle Stop — Marketing / Revenue demo mockups (preview only, no backend) */
window.WSAdminMockups = (function () {
  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function previewBanner(title, blurb) {
    return `
      <div class="admin-mock-banner">
        <span class="admin-mock-badge">Preview</span>
        <div>
          <strong>${esc(title)}</strong>
          <p>${esc(blurb)}</p>
        </div>
      </div>`;
  }

  function statCard(label, value, sub) {
    return `
      <div class="admin-mock-stat">
        <span class="admin-mock-stat-label">${esc(label)}</span>
        <strong>${esc(value)}</strong>
        ${sub ? `<span class="admin-mock-stat-sub">${esc(sub)}</span>` : ""}
      </div>`;
  }

  function statusPill(status) {
    const map = {
      published: "is-ok",
      queued: "is-warn",
      approval: "is-pending",
      new: "is-new",
      contacted: "is-warn",
      booked: "is-ok",
      lost: "is-muted",
      available: "is-ok",
      low: "is-warn",
      soldout: "is-rust",
      live: "is-ok",
      paused: "is-muted",
    };
    return `<span class="admin-mock-pill ${map[status] || ""}">${esc(status)}</span>`;
  }

  function renderGbp(panel) {
    panel.innerHTML = `
      ${previewBanner(
        "Google Business Profile Manager",
        "Advanced GBP work — event start/end times, offer details, and your pending queue. Quick cross-posts (same text + photo to Facebook, X, and Google) start in Social Poster; open here when you need full event scheduling or to review queued Google posts."
      )}
      <div class="social-access-notice social-access-notice--compact" role="note">
        <header class="social-access-notice-head">
          <strong>GBP access (preview)</strong>
          <span>Limitations until Google authorization</span>
        </header>
        <ul class="social-access-list">
          <li class="social-access-item">
            <div class="social-access-item-head">
              <strong>Now</strong>
              <span class="social-access-state is-gbp">Manual queue</span>
            </div>
            <p class="social-access-now"><span>Now:</span> Posts from Social Poster save here for copy/paste into business.google.com. Photos must be uploaded in Google until OAuth is wired.</p>
            <p class="social-access-pending"><span>Until authorized:</span> Google OAuth with <code>business.manage</code> scope — then updates, <strong>events</strong>, and offers publish automatically, each with <strong>one still photo</strong>. Animated GIFs and videos are not supported on the event-post API; add those in the Google dashboard. The dashboard may allow more photos than the API (API max: 1).</p>
          </li>
        </ul>
      </div>
      <div class="admin-mock-layout">
        <section class="admin-mock-card">
          <h3>Schedule or refine a Google post</h3>
          <p class="admin-mock-subnote">Updates, events, and offers are all GBP “posts” — events add date/time on Maps; offers add promo terms. Photos attach here; Social Poster can send the same image to Facebook/X at the same time.</p>
          <div class="admin-mock-form-grid">
            <label class="admin-mock-field"><span>Post type</span>
              <select disabled><option>News update</option><option selected>Event</option><option>Offer</option></select>
            </label>
            <label class="admin-mock-field"><span>Title</span>
              <input type="text" value="Martini Monday — $8 martinis all night" disabled />
            </label>
            <label class="admin-mock-field admin-mock-field--full"><span>Description</span>
              <textarea rows="3" disabled>Join us every Monday for classic martinis, live acoustic sets, and late-night bites on the patio.</textarea>
            </label>
            <label class="admin-mock-field"><span>CTA button</span>
              <select disabled><option>Call</option><option>Directions</option><option selected>Order</option><option>Learn more</option></select>
            </label>
            <label class="admin-mock-field"><span>Event date</span>
              <input type="text" value="Mon, Jun 16 · 5 PM – 11 PM" disabled />
            </label>
            <label class="admin-mock-field admin-mock-field--full admin-mock-media-field">
              <span>Event photo (optional)</span>
              <input type="file" id="gbp-mock-photo-input" accept="image/jpeg,image/png,image/webp,image/gif" />
              <p class="admin-mock-media-hint" id="gbp-mock-media-hint">1 still photo per GBP event via API (JPG, PNG, WebP). GIF uploads as a static image. Videos: use the Google dashboard.</p>
            </label>
          </div>
          <div class="admin-mock-actions">
            <button type="button" class="btn btn-primary" disabled>Queue for Google</button>
            <button type="button" class="btn btn-outline" disabled>Save draft</button>
          </div>
        </section>
        <aside class="admin-mock-card admin-gbp-preview">
          <h3>Google preview</h3>
          <div class="admin-gbp-mock">
            <div class="admin-gbp-mock-header">
              <strong>Whistle Stop Grill &amp; Bar</strong>
              <span>★ 4.6 · Bar &amp; grill · Safety Harbor</span>
            </div>
            <div class="admin-gbp-mock-post">
              <div class="admin-gbp-mock-media" id="gbp-mock-live-image-wrap" hidden>
                <img id="gbp-mock-live-image" alt="Event photo preview" />
              </div>
              <span class="admin-gbp-mock-tag">Event</span>
              <strong>Martini Monday — $8 martinis all night</strong>
              <p>Join us every Monday for classic martinis, live acoustic sets, and late-night bites on the patio.</p>
              <button type="button" class="admin-gbp-mock-cta" disabled>Order</button>
            </div>
          </div>
          <ul class="admin-mock-queue">
            <li><span>Martini Monday</span>${statusPill("queued")}</li>
            <li><span>Live music — The Back Porch Band</span>${statusPill("approval")}</li>
            <li><span>Summer cocktail feature</span>${statusPill("published")}</li>
          </ul>
        </aside>
      </div>`;

    const photoInput = panel.querySelector("#gbp-mock-photo-input");
    const mediaHint = panel.querySelector("#gbp-mock-media-hint");
    const liveWrap = panel.querySelector("#gbp-mock-live-image-wrap");
    const liveImg = panel.querySelector("#gbp-mock-live-image");

    photoInput?.addEventListener("change", () => {
      const file = photoInput.files?.[0];
      if (!file) {
        if (liveWrap) liveWrap.hidden = true;
        if (liveImg) liveImg.removeAttribute("src");
        if (mediaHint) {
          mediaHint.textContent =
            "1 still photo per GBP event via API (JPG, PNG, WebP). GIF uploads as a static image. Videos: use the Google dashboard.";
          mediaHint.classList.remove("is-warn");
        }
        return;
      }
      if (file.type.startsWith("video/")) {
        if (mediaHint) {
          mediaHint.textContent = "Videos cannot be attached to GBP event posts via API — upload in business.google.com.";
          mediaHint.classList.add("is-warn");
        }
        photoInput.value = "";
        return;
      }
      if (mediaHint) {
        mediaHint.classList.remove("is-warn");
        mediaHint.textContent =
          file.type === "image/gif"
            ? "GIF selected — will publish as a still image on Google (no animation via API)."
            : `Photo ready: ${file.name} — will attach to this event when Google is authorized.`;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result || "");
        if (liveImg) liveImg.src = url;
        if (liveWrap) liveWrap.hidden = !url;
      };
      reader.readAsDataURL(file);
    });
  }

  const REVIEW_PLATFORMS = {
    google: {
      label: "Google",
      stats: [
        ["Current rating", "4.4 ★", "2,036 Google reviews"],
        ["New this week", "12", "3 need response"],
        ["Response time", "4.2 hrs", "avg last 30 days"],
      ],
      reviews: [
        {
          stars: "★★★★★",
          when: "2 days ago",
          text: '"Best grouper sandwich on the bay. Patio vibe was perfect for our anniversary."',
          positive: "Positive template",
          action: "Post reply",
        },
        {
          stars: "★★★☆☆",
          when: "Yesterday",
          text: '"Food was great but wait was long on Saturday."',
          positive: "Recovery template",
          action: "Draft reply",
        },
      ],
      qrTitle: "Ask for a Google review",
      qrBlurb: "QR opens your Google review form — for guests who have not reviewed yet.",
      qrUse: "Table tent · receipt · check presenter",
    },
    tripadvisor: {
      label: "TripAdvisor",
      stats: [
        ["Current rating", "4.0 ★", "416 TripAdvisor reviews"],
        ["New this week", "4", "1 needs response"],
        ["Response time", "1.2 days", "avg last 30 days"],
      ],
      reviews: [
        {
          stars: "★★★★★",
          when: "5 days ago",
          text: '"Classic Safety Harbor spot — live music, cold beer, and friendly staff."',
          positive: "Thank-you template",
          action: "Post reply",
        },
        {
          stars: "★★☆☆☆",
          when: "3 days ago",
          text: '"Loud on Friday night and hard to get a table without a wait."',
          positive: "Recovery template",
          action: "Draft reply",
        },
      ],
      qrTitle: "Ask for a TripAdvisor review",
      qrBlurb: "QR goes to your TripAdvisor review page — for visitors after a great meal.",
      qrUse: "Host stand · tourist table tents",
    },
    facebook: {
      label: "Facebook",
      stats: [
        ["Recommendations", "4.6 ★", "541 Facebook reviews"],
        ["New this week", "6", "2 need response"],
        ["Response time", "6.1 hrs", "avg last 30 days"],
      ],
      reviews: [
        {
          stars: "★★★★★",
          when: "1 week ago",
          text: '"Neal our server was great. Music bingo nights are a blast!"',
          positive: "Positive template",
          action: "Reply on Page",
        },
        {
          stars: "★★★☆☆",
          when: "4 days ago",
          text: '"Love the food — wish the patio heaters were on last night."',
          positive: "Recovery template",
          action: "Draft reply",
        },
      ],
      qrTitle: "Ask for a Facebook recommendation",
      qrBlurb: "QR opens your Page’s recommend/review flow — not a feed post.",
      qrUse: "Bar coasters · event signage",
    },
  };

  function reviewItemsHtml(platformKey) {
    const plat = REVIEW_PLATFORMS[platformKey];
    const label = plat?.label || platformKey;
    return (plat?.reviews || [])
      .map(
        (r) => `
      <article class="admin-review-item">
        <header><strong>${r.stars}</strong> <span>${esc(r.when)} · ${esc(label)}</span></header>
        <p>${esc(r.text)}</p>
        <div class="admin-mock-template-row">
          <button type="button" class="btn btn-outline admin-btn-sm" disabled>${esc(r.positive)}</button>
          <button type="button" class="btn btn-primary admin-btn-sm" disabled>${esc(r.action)}</button>
        </div>
      </article>`
      )
      .join("");
  }

  function reviewStatsHtml(platformKey) {
    const plat = REVIEW_PLATFORMS[platformKey];
    return (plat?.stats || [])
      .map(([label, value, sub]) => statCard(label, value, sub))
      .join("");
  }

  function reviewQrHtml(platformKey) {
    const plat = REVIEW_PLATFORMS[platformKey];
    return `
      <h3>${esc(plat?.qrTitle || "Ask for review QR")}</h3>
      <p class="admin-mock-subnote">${esc(plat?.qrBlurb || "")}</p>
      <div class="admin-qr-preview">
        <div class="admin-qr-box" aria-hidden="true"></div>
        <p>${esc(plat?.qrUse || "Table tent · Review QR")}</p>
        <button type="button" class="btn btn-outline" disabled>Download PNG</button>
      </div>
      <div class="admin-review-qr-callout" role="note">
        <strong>QR codes = different purpose than replies</strong>
        <p>Use these for guests who have <strong>not</strong> reviewed yet — table tents, receipts, bar coasters, host-stand signage — so happy customers can leave their <em>first</em> review on ${esc(plat?.label || "this platform")}.</p>
        <p><strong>When to use:</strong> great visit, no review on file yet → print or display this QR.</p>
        <p><strong>When not to use:</strong> guest already reviewed (even days ago) → go to <em>Needs response</em> and post a public reply instead. Never hand a review QR to someone in that list.</p>
      </div>`;
  }

  function renderReviews(panel) {
    let activePlatform = "google";

    panel.innerHTML = `
      ${previewBanner(
        "Review Manager",
        "Inbound reviews guests left about you — read, reply, and ask happy customers for new reviews. This is not Social Poster (outbound posts you write)."
      )}
      <p class="admin-mock-compare">
        <span><strong>Social Poster</strong> = you publish to Facebook, X, Google posts.</span>
        <span><strong>Review Manager</strong> = guests review you on Google, TripAdvisor, or Facebook Page recommendations — you respond here.</span>
      </p>
      <div class="admin-mock-stats-row" id="reviews-stats-row">${reviewStatsHtml(activePlatform)}</div>
      <div class="admin-mock-tabs-demo" id="reviews-platform-tabs" role="tablist" aria-label="Review platforms">
        ${Object.entries(REVIEW_PLATFORMS)
          .map(
            ([id, p]) =>
              `<button type="button" role="tab" data-platform="${id}" class="${id === activePlatform ? "is-active" : ""}" aria-selected="${id === activePlatform}">${esc(p.label)}</button>`
          )
          .join("")}
      </div>
      <div class="admin-mock-layout admin-mock-layout--reviews">
        <div class="admin-mock-reviews-main">
          <section class="admin-mock-card admin-mock-card--reviews-inbox">
            <h3>Needs response</h3>
            <p class="admin-mock-subnote">Each guest below already left a review — reply publicly under their comment. Thank 5★ reviews; use recovery templates on 3★ complaints.</p>
            <div id="reviews-list">${reviewItemsHtml(activePlatform)}</div>
          </section>
          <div class="admin-review-inbox-footnote" role="note">
            <strong>Why replying here matters</strong>
            <p class="admin-review-inbox-footnote-lead">Everyone in <em>Needs response</em> already reviewed you. Your public reply is what future guests read when they compare restaurants — not the QR column on the right (that is only for people who have <em>not</em> reviewed yet).</p>
            <ul class="admin-review-inbox-why">
              <li><strong>Trust &amp; first impressions</strong> — A thanked 5★ looks engaged and welcoming; an ignored 3★ looks like you do not care.</li>
              <li><strong>Recovery</strong> — A thoughtful reply to a complaint (e.g. “Sorry about Saturday’s wait — we added patio seating”) can win a guest back and shows you act on feedback.</li>
              <li><strong>Local SEO</strong> — Google weighs owner responses as a signal that the business is active and trustworthy.</li>
              <li><strong>Protect what you have</strong> — QR codes grow review volume; replies here protect the reputation you already earned.</li>
            </ul>
          </div>
        </div>
        <aside class="admin-mock-card" id="reviews-qr-aside">${reviewQrHtml(activePlatform)}</aside>
      </div>`;

    function setPlatform(platformKey) {
      if (!REVIEW_PLATFORMS[platformKey]) return;
      activePlatform = platformKey;
      panel.querySelectorAll("#reviews-platform-tabs [data-platform]").forEach((btn) => {
        const on = btn.dataset.platform === platformKey;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
      const statsRow = panel.querySelector("#reviews-stats-row");
      const list = panel.querySelector("#reviews-list");
      const qrAside = panel.querySelector("#reviews-qr-aside");
      if (statsRow) statsRow.innerHTML = reviewStatsHtml(platformKey);
      if (list) list.innerHTML = reviewItemsHtml(platformKey);
      if (qrAside) qrAside.innerHTML = reviewQrHtml(platformKey);
    }

    panel.querySelectorAll("#reviews-platform-tabs [data-platform]").forEach((btn) => {
      btn.addEventListener("click", () => setPlatform(btn.dataset.platform));
    });
  }

  function renderCampaignCalendar(panel) {
    panel.innerHTML = `
      ${previewBanner(
        "Campaign Calendar",
        "Staff-only marketing planner — decide when to promote something and on which channels. Guests never see this screen."
      )}
      <div class="admin-campaign-compare-grid">
        <article class="admin-campaign-compare-card">
          <h4>Events <span class="admin-campaign-compare-where">Website Manager</span></h4>
          <p><strong>What it is:</strong> The public calendar on your website — date, time, title, description.</p>
          <p><strong>Who sees it:</strong> Guests browsing events.html.</p>
          <p><strong>Example:</strong> “Cornhole League Finals — Sat Jun 14, 6 PM, patio.”</p>
        </article>
        <article class="admin-campaign-compare-card">
          <h4>Events Promos <span class="admin-campaign-compare-where">Website Manager</span></h4>
          <p><strong>What it is:</strong> Photo highlight cards on the site (recurring favorites, weekly happenings).</p>
          <p><strong>Who sees it:</strong> Guests on homepage or events page tiles.</p>
          <p><strong>Example:</strong> Martini Monday tile with a photo and short blurb.</p>
        </article>
        <article class="admin-campaign-compare-card is-highlight">
          <h4>Campaign Calendar <span class="admin-campaign-compare-where">Marketing Manager</span></h4>
          <p><strong>What it is:</strong> Your internal checklist — <em>when</em> to push a promo and <em>where</em> (site, social, Google, email).</p>
          <p><strong>Who sees it:</strong> Staff only. Not on the public website.</p>
          <p><strong>Example:</strong> “Promote Martini Monday this week → update site card, draft Facebook post, queue GBP offer.”</p>
        </article>
      </div>
      <div class="admin-campaign-workflow" role="note">
        <strong>What “auto-create social &amp; GBP drafts” means</strong>
        <p>It does <strong>not</strong> post for you or publish to the website automatically. When you plan a row like “Martini Monday,” the system would <em>suggest</em> pre-filled drafts — opening Social Poster with caption text and GBP with post type filled in. Staff reviews, edits, and clicks Post/Save. Think of it as a head start, not autopilot.</p>
        <ol class="admin-campaign-workflow-steps">
          <li><strong>Plan</strong> the promo here (what + when + channels).</li>
          <li><strong>Generate drafts</strong> → suggested text lands in Social Poster &amp; Google Business Profile tabs.</li>
          <li><strong>Publish separately</strong> → Events / Events Promos update the site; Social Poster &amp; GBP go live on social/Google.</li>
        </ol>
      </div>
      <div class="admin-mock-stats-row">
        ${statCard("This week", "6 campaigns", "staff marketing plan")}
        ${statCard("Drafts ready", "4 suggested", "awaiting staff review")}
        ${statCard("Channels", "Site · Social · GBP", "per campaign row")}
      </div>
      <div class="admin-mock-card">
        <h3>June marketing plan</h3>
        <p class="admin-mock-subnote">Each row is a promo you intend to push. Tags show where content still needs to go — not guest-facing booking status.</p>
        <div class="admin-campaign-list">
          <div class="admin-campaign-row">
            <div>
              <strong>Martini Monday</strong>
              <span>Promote every Mon · recurring bar promo</span>
              <span class="admin-campaign-row-note">→ Events Promos tile + Social draft + GBP offer draft</span>
            </div>
            <div class="admin-campaign-channels" title="Channels still to update">
              <span>Site card</span><span>Social draft</span><span>GBP draft</span>
            </div>
            ${statusPill("queued")}
          </div>
          <div class="admin-campaign-row">
            <div>
              <strong>Cornhole League Finals</strong>
              <span>Push week-of · Sat Jun 14 patio event</span>
              <span class="admin-campaign-row-note">→ Add to Events calendar + social reminder + event QR tent</span>
            </div>
            <div class="admin-campaign-channels">
              <span>Events tab</span><span>Social draft</span><span>QR</span>
            </div>
            ${statusPill("approval")}
          </div>
          <div class="admin-campaign-row">
            <div>
              <strong>Live music — Back Porch Band</strong>
              <span>Push Fri Jun 13 · 7 PM</span>
              <span class="admin-campaign-row-note">→ Hero image + Facebook/X post + GBP event draft</span>
            </div>
            <div class="admin-campaign-channels">
              <span>Hero</span><span>Social draft</span><span>GBP draft</span>
            </div>
            ${statusPill("published")}
          </div>
          <div class="admin-campaign-row">
            <div>
              <strong>Gift card Father's Day push</strong>
              <span>Jun 8–15 seasonal campaign</span>
              <span class="admin-campaign-row-note">→ Homepage blurb + email blast (no public event date)</span>
            </div>
            <div class="admin-campaign-channels">
              <span>Homepage</span><span>Email</span>
            </div>
            ${statusPill("queued")}
          </div>
        </div>
        <button type="button" class="btn btn-primary" disabled>Generate draft suggestions (preview)</button>
        <p class="admin-mock-subnote" style="margin-top:0.65rem">Preview only — would open pre-filled drafts in Social Poster &amp; Google Business Profile for staff to edit before posting.</p>
      </div>`;
  }

  function renderQrCodes(panel) {
    panel.innerHTML = `
      ${previewBanner(
        "QR Code Manager",
        "Create trackable QR codes for menus, reviews, gift cards, online ordering, events, and private parties."
      )}
      <div class="admin-mock-qr-grid">
        ${[
          ["Menu QR", "142 scans", "Table tents"],
          ["Order pickup QR", "89 scans", "Bar & counter"],
          ["Review QR", "56 scans", "Receipts"],
          ["Gift card QR", "31 scans", "Host stand"],
          ["Events QR", "24 scans", "Cornhole board"],
          ["Private party QR", "12 scans", "Events page"],
        ]
          .map(
            ([title, scans, place]) => `
          <div class="admin-mock-card admin-qr-card">
            <div class="admin-qr-box" aria-hidden="true"></div>
            <strong>${esc(title)}</strong>
            <span>${esc(scans)} · ${esc(place)}</span>
            <button type="button" class="btn btn-outline admin-btn-sm" disabled>Preview tent</button>
          </div>`
          )
          .join("")}
      </div>`;
  }

  function renderOrderingHub(panel) {
    panel.innerHTML = `
      ${previewBanner(
        "Ordering Hub",
        "Manage every order path from one screen: direct pickup, delivery apps, gift cards, and call-in guidance."
      )}
      <div class="admin-mock-stats-row">
        ${statCard("Pickup clicks", "318", "last 7 days")}
        ${statCard("Gift card clicks", "47", "last 7 days")}
        ${statCard("Call-in taps", "92", "last 7 days")}
      </div>
      <div class="admin-mock-card">
        <h3>Order paths</h3>
        <table class="admin-mock-table">
          <thead><tr><th>Channel</th><th>Status</th><th>Clicks</th><th>Featured</th></tr></thead>
          <tbody>
            <tr><td><strong>Direct pickup (Toast)</strong></td><td>${statusPill("live")}</td><td>318</td><td><input type="checkbox" checked disabled /></td></tr>
            <tr><td>DoorDash</td><td>${statusPill("live")}</td><td>204</td><td><input type="checkbox" checked disabled /></td></tr>
            <tr><td>Uber Eats</td><td>${statusPill("live")}</td><td>156</td><td><input type="checkbox" disabled /></td></tr>
            <tr><td>Grubhub</td><td>${statusPill("paused")}</td><td>41</td><td><input type="checkbox" disabled /></td></tr>
            <tr><td>Gift cards</td><td>${statusPill("live")}</td><td>47</td><td><input type="checkbox" checked disabled /></td></tr>
          </tbody>
        </table>
        <label class="admin-mock-toggle"><input type="checkbox" disabled /> Show busy-night message on order page</label>
      </div>`;
  }

  function renderPrivateEvents(panel) {
    panel.innerHTML = `
      ${previewBanner(
        "Private Events & Large Parties",
        "Capture birthdays, reunions, local meetups, business groups, and larger parties before they disappear into phone calls or social messages."
      )}
      <div class="admin-mock-stats-row">
        ${statCard("New inquiries", "4", "this week")}
        ${statCard("Pipeline value", "$8,400", "estimated")}
        ${statCard("Booked", "2", "next 30 days")}
      </div>
      <div class="admin-mock-card">
        <h3>Inquiry queue</h3>
        <table class="admin-mock-table">
          <thead><tr><th>Contact</th><th>Event</th><th>Date</th><th>Guests</th><th>Space</th><th>Status</th><th>Est.</th></tr></thead>
          <tbody>
            <tr><td><strong>Sarah M.</strong><br><small>sarah@email.com</small></td><td>40th birthday</td><td>Jul 12</td><td>35</td><td>Patio</td><td>${statusPill("new")}</td><td>$2,800</td></tr>
            <tr><td><strong>Rotary Club</strong><br><small>info@rotary.org</small></td><td>Monthly meetup</td><td>Jun 28</td><td>22</td><td>Indoor</td><td>${statusPill("contacted")}</td><td>$1,200</td></tr>
            <tr><td><strong>Mike &amp; Lisa</strong><br><small>via website</small></td><td>Rehearsal dinner</td><td>Aug 3</td><td>18</td><td>Buyout interest</td><td>${statusPill("booked")}</td><td>$4,400</td></tr>
            <tr><td><strong>Corporate lunch</strong><br><small>HR coordinator</small></td><td>Team lunch</td><td>—</td><td>50</td><td>Indoor + patio</td><td>${statusPill("lost")}</td><td>—</td></tr>
          </tbody>
        </table>
      </div>`;
  }

  function renderReports(panel) {
    panel.innerHTML = `
      ${previewBanner(
        "Reports Dashboard",
        "One weekly snapshot for staff — what happened on the website, search, and order paths. Full drill-down still lives in GA4, Search Console, Clarity, and each delivery app’s merchant portal."
      )}
      <div class="admin-reports-purpose" role="note">
        <strong>What this page is for (when fully wired)</strong>
        <p>Owners and managers should not log into five tools every Monday. Reports pulls the <em>actionable</em> numbers into one place: Did the site drive calls and orders? Which promo worked? Where did people come from? Dollar totals per DoorDash/Uber/Grubhub pickup only appear here after <strong>Integrations</strong> (Toast POS, delivery APIs) — until then you see <strong>clicks to order</strong> plus links out to each partner dashboard for real revenue.</p>
      </div>
      <div class="admin-reports-sources">
        <h3>Data sources this board would combine</h3>
        <div class="admin-reports-source-grid">
          ${[
            ["GA4", "Sessions, menu views, order-button clicks, gift-card clicks, traffic sources", "Already on site"],
            ["Google Search Console", "Google search impressions, clicks, top queries (“whistle stop safety harbor”)", "Connected"],
            ["Microsoft Clarity", "Scroll depth, rage clicks, recording links for confusing pages", "Connected"],
            ["Bing Webmaster", "Bing search visibility (smaller share, still worth watching)", "Connected"],
            ["Website + QR Manager", "QR scans by tent/receipt, admin-tracked promo links", "Partial — grows with QR tab"],
            ["Toast / POS", "Pickup order count & ticket totals, curbside", "Integrations — not wired yet"],
            ["DoorDash · Uber · Grubhub", "Delivery order $ and volume per channel", "Merchant portals — API later"],
          ]
            .map(
              ([name, desc, status]) => `
            <article class="admin-reports-source-card">
              <header><strong>${esc(name)}</strong><span class="admin-reports-source-status">${esc(status)}</span></header>
              <p>${esc(desc)}</p>
            </article>`
            )
            .join("")}
        </div>
      </div>
      <div class="admin-mock-stats-row">
        ${statCard("Site sessions", "6,240", "GA4 · last 30 days")}
        ${statCard("Order path clicks", "866", "site → Toast / apps")}
        ${statCard("Calls + directions", "1,345", "tap-to-call & Maps")}
        ${statCard("QR scans", "394", "menus · reviews · events")}
      </div>
      <div class="admin-mock-layout admin-mock-layout--reports">
        <section class="admin-mock-card">
          <h3>Order paths — clicks today, dollars when integrated</h3>
          <p class="admin-mock-subnote">Right now the website can count how often someone clicked “Order pickup” or a delivery app link. Actual ticket amounts need Toast or each app’s API.</p>
          <table class="admin-mock-table admin-reports-table">
            <thead>
              <tr><th>Channel</th><th>Clicks (site)</th><th>Orders / revenue</th><th>Full detail</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Pickup / Toast</strong></td>
                <td>318</td>
                <td class="admin-reports-pending">— connect Toast</td>
                <td><span class="admin-reports-link">Toast dashboard ↗</span></td>
              </tr>
              <tr>
                <td><strong>DoorDash</strong></td>
                <td>214</td>
                <td class="admin-reports-pending">— merchant portal</td>
                <td><span class="admin-reports-link">DoorDash Store ↗</span></td>
              </tr>
              <tr>
                <td><strong>Uber Eats</strong></td>
                <td>186</td>
                <td class="admin-reports-pending">— merchant portal</td>
                <td><span class="admin-reports-link">Uber Manager ↗</span></td>
              </tr>
              <tr>
                <td><strong>Grubhub</strong></td>
                <td>97</td>
                <td class="admin-reports-pending">— merchant portal</td>
                <td><span class="admin-reports-link">Grubhub for Restaurants ↗</span></td>
              </tr>
              <tr>
                <td><strong>Call-in</strong></td>
                <td>203 taps</td>
                <td>—</td>
                <td>Tracked via GA4 event</td>
              </tr>
            </tbody>
          </table>
        </section>
        <section class="admin-mock-card">
          <h3>Search &amp; discovery</h3>
          <p class="admin-mock-subnote">Pulled from GSC + Bing — are people finding you for the right terms?</p>
          <ul class="admin-mock-metrics">
            <li><span>Google impressions</span><strong>18,420</strong></li>
            <li><span>Google clicks</span><strong>1,102</strong></li>
            <li><span>Top query</span><strong>“whistle stop safety harbor”</strong></li>
            <li><span>Bing clicks</span><strong>84</strong></li>
            <li><span>Avg position (Google)</span><strong>4.2</strong></li>
          </ul>
          <p class="admin-mock-subnote" style="margin-top:0.75rem">Clarity flag: menu page has high mobile scroll abandonment — <span class="admin-reports-link">view recording ↗</span></p>
        </section>
      </div>
      <div class="admin-mock-layout admin-mock-layout--reports">
        <section class="admin-mock-card">
          <h3>Website actions (owned by this system)</h3>
          <ul class="admin-mock-metrics">
            <li><span>Menu page views</span><strong>4,280</strong></li>
            <li><span>Events page views</span><strong>1,890</strong></li>
            <li><span>Gift card clicks</span><strong>47</strong></li>
            <li><span>Review QR scans</span><strong>56</strong></li>
            <li><span>Private events inquiries</span><strong>12</strong></li>
            <li><span>Social posts published</span><strong>8</strong></li>
          </ul>
        </section>
        <section class="admin-mock-card">
          <h3>Campaign impact</h3>
          <p class="admin-mock-subnote">Ties to Campaign Calendar — did the promo we planned move the needle?</p>
          <ol class="admin-mock-rank">
            <li><span>Martini Monday push</span><strong>+412 event/promo views</strong></li>
            <li><span>Live music Fridays</span><strong>+286 events page views</strong></li>
            <li><span>Gift card Father's Day</span><strong>+147 gift-card clicks</strong></li>
            <li><span>Cornhole league week-of</span><strong>+98 event detail views</strong></li>
          </ol>
        </section>
      </div>
      <section class="admin-mock-card admin-reports-weekly">
        <h3>Practical weekly use for staff</h3>
        <div class="admin-reports-weekly-grid">
          <div>
            <strong>Monday morning (5 min)</strong>
            <p>Glance at sessions, order clicks, and calls vs last week. If a Campaign Calendar row went live, check whether event or menu traffic moved.</p>
          </div>
          <div>
            <strong>Monthly owner review (15 min)</strong>
            <p>Search queries (GSC), top order channels, QR scan trends, review response rate. Export or screenshot for stakeholders — no need to learn GA4 filters.</p>
          </div>
          <div>
            <strong>When something looks off</strong>
            <p>Jump to Clarity for UX issues, GSC for ranking drops, or the delivery app portal for payout disputes. Reports is the front door, not the whole building.</p>
          </div>
        </div>
      </section>`;
  }

  function renderComingSoon(panel, title, cards) {
    panel.innerHTML = `
      ${previewBanner(title, "Connect deeper tools later — preview only for tomorrow's demo.")}
      <div class="admin-mock-soon-grid">
        ${cards
          .map(
            ([name, desc, tags]) => `
          <div class="admin-mock-card admin-mock-soon-card">
            <span class="admin-mock-badge">Coming soon</span>
            <strong>${esc(name)}</strong>
            <p>${esc(desc)}</p>
            <div class="admin-mock-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>
          </div>`
          )
          .join("")}
      </div>`;
  }

  function renderIntegrations(panel) {
    renderComingSoon(panel, "Integrations", [
      ["Toast", "Pickup, curbside, and scheduled orders flow into POS.", ["POS", "Pickup", "Scheduled orders"]],
      ["DoorDash", "Delivery status and featured link toggles.", ["Delivery"]],
      ["Uber Eats", "Menu sync and order path visibility.", ["Delivery"]],
      ["Grubhub", "Channel on/off and click tracking.", ["Delivery"]],
      ["Google", "Business Profile posts, insights, and review sync.", ["GBP", "Maps"]],
      ["Meta", "Facebook & Instagram publishing when credentials are connected.", ["Facebook", "Instagram"]],
      ["TikTok", "Short-form promo drafts and scheduling.", ["Video"]],
    ]);
  }

  function renderLiveMusic(panel) {
    renderComingSoon(panel, "Live Music / Band Manager", [
      ["Back Porch Band", "Fri Jun 13 · 7 PM · promo image ready", ["Social", "Homepage"]],
      ["Acoustic Sunday", "Sun Jun 15 · patio · contact on file", ["Events", "GBP"]],
    ]);
    panel.querySelector(".admin-mock-soon-grid").insertAdjacentHTML(
      "afterbegin",
      `<div class="admin-mock-card admin-mock-soon-card is-feature">
        <strong>Band lineup preview</strong>
        <table class="admin-mock-table admin-mock-table--compact">
          <tr><td>Back Porch Band</td><td>Jun 13</td><td>${statusPill("approval")}</td><td><button class="btn btn-outline admin-btn-sm" disabled>Create social post</button></td></tr>
          <tr><td>Duo at the Bar</td><td>Jun 20</td><td>${statusPill("queued")}</td><td><button class="btn btn-outline admin-btn-sm" disabled>Feature on homepage</button></td></tr>
        </table>
      </div>`
    );
  }

  function renderVipClub(panel) {
    panel.innerHTML = `
      ${previewBanner(
        "VIP Club / Email & SMS",
        "Birthday club, weekly event alerts, and promo blasts — concept preview; full SMS automation connects later."
      )}
      <div class="admin-mock-stats-row">
        ${statCard("Subscribers", "1,248", "email + SMS concept")}
        ${statCard("Signup QR scans", "89", "this month")}
        ${statCard("Birthdays this week", "14", "auto-offer queue")}
      </div>
      <div class="admin-mock-soon-grid">
        ${[
          ["Birthday club", "Capture birthdays for automatic offers.", ["Email"]],
          ["Weekly event alerts", "Live music and patio events.", ["SMS concept"]],
          ["Gift card promos", "Seasonal pushes to subscribers.", ["Email"]],
          ["Happy hour announcements", "Timed promos for locals.", ["SMS concept"]],
        ]
          .map(
            ([name, desc, tags]) => `
          <div class="admin-mock-card admin-mock-soon-card">
            <span class="admin-mock-badge">Coming soon</span>
            <strong>${esc(name)}</strong>
            <p>${esc(desc)}</p>
            <div class="admin-mock-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>
          </div>`
          )
          .join("")}
      </div>
      <div class="admin-mock-card" style="margin-top:1rem">
        <h3>Signup QR preview</h3>
        <div class="admin-qr-preview">
          <div class="admin-qr-box" aria-hidden="true"></div>
          <p>Join the VIP list — patio events, gift cards, and happy hour</p>
        </div>
      </div>`;
  }

  function render86Board(panel) {
    panel.innerHTML = `
      ${previewBanner("86 Board / Sold Out Items", "Simple sold-out toggles staff can update on busy nights — restaurant-native, not full inventory.")}
      <div class="admin-mock-card">
        <table class="admin-mock-table">
          <thead><tr><th>Item</th><th>Menu</th><th>Status</th><th>Staff note</th></tr></thead>
          <tbody>
            <tr><td><strong>Fried Green Tomatoes</strong></td><td>Starters</td><td>${statusPill("available")}</td><td>—</td></tr>
            <tr><td><strong>Grouper Sandwich</strong></td><td>Lunch</td><td>${statusPill("low")}</td><td>2 portions left</td></tr>
            <tr><td><strong>Seasonal Flatbread</strong></td><td>Dinner</td><td>${statusPill("soldout")}</td><td>86'd at 8:15 PM</td></tr>
            <tr><td><strong>Key Lime Pie</strong></td><td>Dessert</td><td>${statusPill("available")}</td><td>—</td></tr>
          </tbody>
        </table>
        <button type="button" class="btn btn-outline" disabled>Push update to website menu</button>
      </div>`;
  }

  return {
    renderGbp,
    renderReviews,
    renderCampaignCalendar,
    renderQrCodes,
    renderOrderingHub,
    renderPrivateEvents,
    renderReports,
    renderIntegrations,
    renderLiveMusic,
    renderVipClub,
    render86Board,
  };
})();
