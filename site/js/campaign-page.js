/* Whistle Stop — public campaign interest-check landing */
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

  function progressBar(current, goal) {
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

  function renderForm(campaign, signupCount) {
    const nights = (campaign.preferredWindows || []).map((w) => `<option value="${esc(w)}">${esc(w)}</option>`).join("");
    return `
      <form id="campaign-signup-form" class="campaign-signup-form" novalidate>
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
            <option value="Wednesday">Wednesday evening</option>
            <option value="Sunday">Sunday afternoon</option>
            <option value="Other">Other — I'll note below</option>
          </select>
        </label>
        <label class="campaign-field">
          <span>Experience</span>
          <select name="experience">
            <option value="new">New to D&amp;D</option>
            <option value="intermediate">Played a few times</option>
            <option value="experienced">Experienced player/DM</option>
          </select>
        </label>
        <label class="campaign-field">
          <span>Anything else? <em>(optional)</em></span>
          <textarea name="notes" rows="2" placeholder="Bring a friend, need wheelchair access, etc."></textarea>
        </label>
        <input type="text" name="company" class="campaign-honeypot" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <label class="campaign-consent">
          <input type="checkbox" name="consent" required />
          <span>Yes — email me if we schedule this. No spam; one-off updates for this event only.</span>
        </label>
        <button type="submit" class="btn btn-primary campaign-submit">Count me in</button>
        <p id="campaign-form-status" class="campaign-form-status" role="status" hidden></p>
      </form>
      ${progressBar(signupCount, campaign.signupGoal || 12)}
    `;
  }

  function renderSuccess(campaign, signupCount) {
    return `
      <div class="campaign-success">
        <h2>You're on the list!</h2>
        <p>Thanks for raising your hand for <strong>${esc(campaign.title)}</strong>. We'll only schedule it if enough locals are interested — you're signup #${signupCount}.</p>
        <p><a href="events.html" class="btn btn-secondary">See what's on the calendar</a></p>
      </div>
      ${progressBar(signupCount, campaign.signupGoal || 12)}
    `;
  }

  function renderNotFound(slug) {
    return `
      <div class="campaign-not-found">
        <h1>Campaign not found</h1>
        <p>We couldn't find an active signup for <code>${esc(slug)}</code>.</p>
        <p><a href="events.html">Browse events</a> or <a href="index.html">return home</a>.</p>
      </div>`;
  }

  async function init() {
    const main = document.getElementById("campaign-main");
    const slug = getSlug();
    if (!slug) {
      main.innerHTML = `<div class="container">${renderNotFound("(missing campaign)")}</div>`;
      return;
    }

    const campaign = await store().getCampaignBySlug(slug);
    if (!campaign) {
      main.innerHTML = `<div class="container">${renderNotFound(slug)}</div>`;
      document.title = "Not found | Whistle Stop";
      return;
    }

    document.title = `${campaign.title} — interest signup | Whistle Stop`;

    const runtime = await store().getRuntime();
    let signupCount = store().getSignupsForCampaign(runtime, campaign.id).length;

    main.innerHTML = `
      <div class="container campaign-signup-wrap">
        <p class="campaign-eyebrow">Interest check — not a confirmed date yet</p>
        <h1 class="campaign-title">${esc(campaign.headline || campaign.title)}</h1>
        <p class="campaign-lead">${esc(campaign.description)}</p>
        <div id="campaign-form-area">${renderForm(campaign, signupCount)}</div>
      </div>`;

    const form = document.getElementById("campaign-signup-form");
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
        await store().submitSignup(campaign.id, {
          name: fd.get("name"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          role: fd.get("role"),
          preferredNight: fd.get("preferredNight"),
          experience: fd.get("experience"),
          notes: fd.get("notes"),
          source: detectSource(),
        });
        signupCount += 1;
        document.getElementById("campaign-form-area").innerHTML = renderSuccess(campaign, signupCount);
      } catch (err) {
        status.className = "campaign-form-status is-error";
        status.textContent = err.message || "Something went wrong. Try again.";
        btn.disabled = false;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
