/* Whistle Stop — public campaign landing (signup, info, event promo) */
(function () {
  const store = () => window.WSCampaignStore;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getSlug() {
    const params = new URLSearchParams(location.search);
    return params.get("campaign") || params.get("c") || "";
  }

  function detectSource() {
    const params = new URLSearchParams(location.search);
    if (params.get("utm_source") === "qr") return "qr";
    if (params.get("utm_source")) return params.get("utm_source");
    if (document.referrer.includes("facebook")) return "social";
    return "web";
  }

  function campaignType(campaign) {
    return campaign.type || "interest_check";
  }

  function showsSignup(campaign) {
    const type = campaignType(campaign);
    if (type === "info") return Boolean(campaign.showSignup);
    if (type === "event_promo") return Boolean(campaign.showSignup);
    return true;
  }

  function eyebrowFor(campaign) {
    const map = {
      interest_check: "Interest check — not a confirmed date yet",
      info: campaign.eyebrow || "Special offer",
      event_promo: campaign.eyebrow || "Upcoming event",
    };
    return map[campaignType(campaign)] || "Whistle Stop";
  }

  function progressBar(current, goal) {
    if (!goal) return "";
    const pct = Math.min(100, Math.round((current / goal) * 100));
    return `
      <div class="campaign-progress" role="status" aria-label="${current} of ${goal} signups">
        <div class="campaign-progress-label">
          <strong>${current}</strong> of <strong>${goal}</strong> interested
          ${current >= goal ? '<span class="campaign-progress-met">Goal reached!</span>' : ""}
        </div>
        <div class="campaign-progress-track"><div class="campaign-progress-fill" style="width:${pct}%"></div></div>
      </div>`;
  }

  function renderMedia(campaign) {
    const hero = campaign.heroImage
      ? `<img class="campaign-hero-img" src="${esc(campaign.heroImage)}" alt="${esc(campaign.heroAlt || campaign.title)}" loading="eager" />`
      : "";
    const gallery = (campaign.media || [])
      .filter((m) => m.src)
      .map((m) => `<img src="${esc(m.src)}" alt="${esc(m.alt || "")}" loading="lazy" />`)
      .join("");
    const grid = gallery ? `<div class="campaign-media-grid">${gallery}</div>` : "";
    return hero + grid;
  }

  function renderEventMeta(campaign) {
    if (campaignType(campaign) !== "event_promo") return "";
    const bits = [];
    if (campaign.eventDate) bits.push(`<span><strong>Date</strong> ${esc(campaign.eventDate)}</span>`);
    if (campaign.eventTime) bits.push(`<span><strong>Time</strong> ${esc(campaign.eventTime)}</span>`);
    if (campaign.location) bits.push(`<span><strong>Where</strong> ${esc(campaign.location)}</span>`);
    if (!bits.length) return "";
    return `<div class="campaign-event-meta">${bits.join("")}</div>`;
  }

  function renderCtas(campaign) {
    const ctas = campaign.ctas || (campaign.cta ? [campaign.cta] : []);
    if (!ctas.length) return "";
    const buttons = ctas
      .map((c, i) => {
        const cls = i === 0 ? "btn btn-primary" : "btn btn-secondary";
        const target = c.external ? ' target="_blank" rel="noopener"' : "";
        return `<a href="${esc(c.url)}" class="${cls}"${target}>${esc(c.label)}</a>`;
      })
      .join("");
    return `<div class="campaign-cta-row">${buttons}</div>`;
  }

  function renderInfoBody(campaign) {
    const extra = campaign.infoBody ? `<p>${esc(campaign.infoBody)}</p>` : "";
    return `
      <div class="campaign-info-card">
        <p>${esc(campaign.description)}</p>
        ${extra}
      </div>`;
  }

  function renderForm(campaign, signupCount) {
    const nights = (campaign.preferredWindows || []).map((w) => `<option value="${esc(w)}">${esc(w)}</option>`).join("");
    const roleField =
      campaignType(campaign) === "interest_check"
        ? `
        <fieldset class="campaign-fieldset">
          <legend>I'd like to…</legend>
          <label class="campaign-radio"><input type="radio" name="role" value="player" checked /> Play</label>
          <label class="campaign-radio"><input type="radio" name="role" value="dm" /> DM / run a table</label>
          <label class="campaign-radio"><input type="radio" name="role" value="either" /> Either</label>
        </fieldset>
        <label class="campaign-field">
          <span>Preferred night</span>
          <select name="preferredNight">
            <option value="">No preference</option>
            ${nights}
          </select>
        </label>
        <label class="campaign-field">
          <span>Experience</span>
          <select name="experience">
            <option value="new">New to D&amp;D</option>
            <option value="intermediate">Played a few times</option>
            <option value="experienced">Experienced player/DM</option>
          </select>
        </label>`
        : `
        <label class="campaign-field">
          <span>Notes <em>(optional)</em></span>
          <textarea name="notes" rows="2" placeholder="Party size, questions, etc."></textarea>
        </label>`;

    const consent =
      campaign.consentText ||
      (campaignType(campaign) === "interest_check"
        ? "Yes — email me if we schedule this. No spam; one-off updates for this event only."
        : "Yes — send me updates about this campaign.");

    return `
      <form id="campaign-signup-form" class="campaign-signup-form" novalidate>
        <h2 class="campaign-form-title">${esc(campaign.signupTitle || "Join the list")}</h2>
        <div class="campaign-form-grid">
          <label class="campaign-field">
            <span>Your name</span>
            <input type="text" name="name" required autocomplete="name" placeholder="Alex" />
          </label>
          <label class="campaign-field">
            <span>Email</span>
            <input type="email" name="email" required autocomplete="email" placeholder="you@example.com" />
          </label>
          <label class="campaign-field">
            <span>Phone <em>(optional)</em></span>
            <input type="tel" name="phone" autocomplete="tel" placeholder="(727) 555-0100" />
          </label>
        </div>
        ${roleField}
        <input type="text" name="company" class="campaign-honeypot" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <label class="campaign-consent">
          <input type="checkbox" name="consent" required />
          <span>${esc(consent)}</span>
        </label>
        <button type="submit" class="btn btn-primary campaign-submit">${esc(campaign.signupButton || "Count me in")}</button>
        <p id="campaign-form-status" class="campaign-form-status" role="status" hidden></p>
      </form>
      ${campaign.signupGoal ? progressBar(signupCount, campaign.signupGoal) : ""}`;
  }

  function renderSuccess(campaign, signupCount) {
    return `
      <div class="campaign-success">
        <h2>You're on the list!</h2>
        <p>Thanks for your interest in <strong>${esc(campaign.title)}</strong>${signupCount ? ` — you're signup #${signupCount}.` : "."}</p>
        <p><a href="events.html" class="btn btn-secondary">See what's on the calendar</a></p>
      </div>
      ${campaign.signupGoal ? progressBar(signupCount, campaign.signupGoal) : ""}`;
  }

  function renderNotFound(slug) {
    return `
      <div class="campaign-not-found">
        <h1>Campaign not found</h1>
        <p>We couldn't find an active page for <code>${esc(slug)}</code>.</p>
        <p><a href="events.html">Browse events</a> or <a href="index.html">return home</a>.</p>
      </div>`;
  }

  function wireSignupForm(campaign, signupCount) {
    const form = document.getElementById("campaign-signup-form");
    if (!form) return;
    const status = document.getElementById("campaign-form-status");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (form.company?.value) return;

      const fd = new FormData(form);
      if (!fd.get("consent")) {
        status.hidden = false;
        status.textContent = "Please check the consent box to continue.";
        status.className = "campaign-form-status is-error";
        return;
      }

      const btn = form.querySelector(".campaign-submit");
      btn.disabled = true;
      status.hidden = false;
      status.className = "campaign-form-status";
      status.textContent = "Submitting…";

      try {
        const saved = await store().submitSignup(campaign.id, {
          name: fd.get("name"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          role: fd.get("role") || "guest",
          preferredNight: fd.get("preferredNight"),
          experience: fd.get("experience"),
          notes: fd.get("notes"),
          source: detectSource(),
          marketingConsent: true,
          consentAt: new Date().toISOString(),
        });
        if (saved?.localOnly) throw new Error("Signup was not saved to Whistle Stop. Please try again.");
        signupCount += 1;
        document.getElementById("campaign-form-area").innerHTML = renderSuccess(campaign, signupCount);
      } catch (err) {
        status.className = "campaign-form-status is-error";
        status.textContent = err.message || "Something went wrong. Try again.";
        btn.disabled = false;
      }
    });
  }

  async function init() {
    const main = document.getElementById("campaign-main");
    const slug = getSlug();
    if (!slug) {
      main.innerHTML = `<div class="container campaign-signup-wrap">${renderNotFound("(missing campaign)")}</div>`;
      return;
    }

    const campaign = await store().getCampaignBySlug(slug);
    if (!campaign) {
      main.innerHTML = `<div class="container campaign-signup-wrap">${renderNotFound(slug)}</div>`;
      document.title = "Not found | Whistle Stop";
      return;
    }

    document.title = `${campaign.title} | Whistle Stop`;

    await store().syncRuntimeFromCloud().catch(() => {});
    const runtime = await store().getRuntime(true);
    let signupCount = store().getSignupCount(runtime, campaign.id);
    const type = campaignType(campaign);

    let bodyHtml = renderMedia(campaign) + renderEventMeta(campaign);
    if (type === "info" || type === "event_promo") {
      bodyHtml += renderInfoBody(campaign);
      bodyHtml += renderCtas(campaign);
    }

    const signupHtml = showsSignup(campaign) ? `<div id="campaign-form-area">${renderForm(campaign, signupCount)}</div>` : "";

    main.innerHTML = `
      <div class="container campaign-signup-wrap">
        <p class="campaign-eyebrow">${esc(eyebrowFor(campaign))}</p>
        <h1 class="campaign-title">${esc(campaign.headline || campaign.title)}</h1>
        ${type === "interest_check" ? `<p class="campaign-lead">${esc(campaign.description)}</p>` : ""}
        ${bodyHtml}
        ${signupHtml}
      </div>`;

    wireSignupForm(campaign, signupCount);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
