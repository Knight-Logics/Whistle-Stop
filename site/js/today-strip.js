/* "Right now at Whistle Stop" strip in the homepage hero.
   Reads hours from site.json and tonight's lineup from events.json, in the
   restaurant's own time zone, so it updates the moment staff publish. */
(function () {
  const root = document.getElementById("today-strip");
  if (!root || !window.WSConfig) return;

  const params = new URLSearchParams(location.search);
  const usePreview = params.has("preview") || params.has("homepagePreview");
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const ICONS = {
    music: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 18.5a2.5 2.5 0 1 1-2-2.45V5.2l11-2.2v12.5a2.5 2.5 0 1 1-2-2.45V7.3l-7 1.4v9.8z"/></svg>',
    star: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>',
    glass: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16l-8 9z"/><path d="M12 13v7"/><path d="M8 20h8"/></svg>',
    flame: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2s5 4.6 5 10a5 5 0 0 1-10 0c0-2.4 1.2-4.2 2.4-5.4.2 1.8 1 3 2.1 3.6C11 7.6 12 4.6 12 2z"/></svg>',
  };

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function load(section) {
    return usePreview && WSConfig.getForPreview ? WSConfig.getForPreview(section) : WSConfig.get(section);
  }

  /* Wall-clock parts in the venue's time zone (not the visitor's). */
  function venueNow(tz) {
    const parts = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .forEach((p) => (parts[p.type] = p.value));
    return {
      iso: `${parts.year}-${parts.month}-${parts.day}`,
      day: Number(parts.day),
      dow: DAY_NAMES.indexOf(parts.weekday),
      minutes: Number(parts.hour) * 60 + Number(parts.minute),
    };
  }

  function toMinutes(hhmm) {
    if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  function clock(hhmm) {
    const mins = toMinutes(hhmm);
    if (mins == null) return "";
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    const suffix = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
  }

  function hoursFor(site, dow) {
    const hours = site.hours || {};
    const block = dow === 5 || dow === 6 ? hours.weekend : hours.weekday;
    if (!block) return null;
    const opens = toMinutes(block.opens);
    const closes = toMinutes(block.closes);
    if (opens == null || closes == null) return null;
    return { opens, closes, opensLabel: clock(block.opens), closesLabel: clock(block.closes) };
  }

  function openStatus(site, now) {
    const today = hoursFor(site, now.dow);
    if (!today) return null;
    if (now.minutes >= today.opens && now.minutes < today.closes) {
      const soon = today.closes - now.minutes <= 45;
      return { state: soon ? "soon" : "open", label: soon ? "Closing soon" : "Open now", detail: `until ${today.closesLabel}` };
    }
    if (now.minutes < today.opens) {
      return { state: "later", label: "Opens today", detail: `at ${today.opensLabel}` };
    }
    const tomorrow = hoursFor(site, (now.dow + 1) % 7);
    return { state: "closed", label: "Closed now", detail: tomorrow ? `opens tomorrow ${tomorrow.opensLabel}` : "" };
  }

  function happyHour(site, now) {
    const today = hoursFor(site, now.dow);
    const start = 16 * 60;
    const isTuesday = now.dow === 2;
    const end = isTuesday && today ? today.closes : 19 * 60;
    if (!today || now.minutes >= end || now.minutes >= today.closes) return null;
    if (now.minutes >= start) {
      return { live: true, text: isTuesday ? "Happy hour now · all night" : `Happy hour now · until ${clock("19:00")}` };
    }
    return { live: false, text: isTuesday ? "Happy hour 4 PM – close" : "Happy hour 4–7 PM" };
  }

  function eventsOn(events, iso, dow, dayOfMonth) {
    const list = [];
    (events.performances || []).forEach((p) => {
      if (p.date === iso && p.title) list.push({ ...p, oneOff: true });
    });
    (events.recurring || []).forEach((r) => {
      if (!r.title || !Array.isArray(r.dayOfWeek) || !r.dayOfWeek.includes(dow)) return;
      if (r.id === "daily-specials") return;
      if (r.weekOfMonth && Math.ceil(dayOfMonth / 7) !== r.weekOfMonth) return;
      list.push({ ...r, oneOff: false });
    });
    /* A booked act replaces the generic weekend "Live Music" placeholder. */
    if (list.some((e) => e.oneOff && e.category === "live-music")) {
      for (let i = list.length - 1; i >= 0; i--) {
        if (!list[i].oneOff && list[i].id === "live-music-weekend") list.splice(i, 1);
      }
    }
    const rank = (e) => (e.oneOff ? 0 : e.category === "live-music" ? 1 : e.category === "community" ? 2 : 3);
    return list.sort((a, b) => rank(a) - rank(b) || (toMinutes(a.startTime) ?? 0) - (toMinutes(b.startTime) ?? 0));
  }

  function nextEvent(events, now) {
    for (let offset = 1; offset <= 7; offset++) {
      const d = new Date(Date.UTC(...now.iso.split("-").map((n, i) => (i === 1 ? Number(n) - 1 : Number(n)))));
      d.setUTCDate(d.getUTCDate() + offset);
      const iso = d.toISOString().slice(0, 10);
      const found = eventsOn(events, iso, d.getUTCDay(), d.getUTCDate()).filter(
        (e) => e.category !== "specials"
      );
      if (found.length) return { event: found[0], dayLabel: offset === 1 ? "Tomorrow" : DAY_NAMES[d.getUTCDay()] };
    }
    return null;
  }

  function chip({ href, icon, text, cls = "" }) {
    const inner = `<span class="today-chip-icon" aria-hidden="true">${icon}</span><span>${text}</span>`;
    return href
      ? `<a class="today-chip ${cls}" href="${esc(href)}">${inner}</a>`
      : `<span class="today-chip ${cls}">${inner}</span>`;
  }

  async function render() {
    let site;
    let events;
    try {
      [site, events] = await Promise.all([load("site"), load("events")]);
    } catch (e) {
      console.warn("today-strip:", e);
      return;
    }
    const now = venueNow(events.timezone || "America/New_York");
    const chips = [];

    const status = openStatus(site, now);
    if (status) {
      chips.push(
        `<span class="today-chip today-chip--status is-${status.state}"><span class="today-dot" aria-hidden="true"></span><strong>${esc(
          status.label
        )}</strong><span>${esc(status.detail)}</span></span>`
      );
    }

    const todays = eventsOn(events, now.iso, now.dow, now.day);
    const headline = todays.find((e) => e.category !== "specials");
    const special = todays.find((e) => e.category === "specials");
    const closedForDay = status?.state === "closed";
    const stillOn = (e) => {
      if (closedForDay) return false;
      const end = toMinutes(e.endTime);
      return end == null || now.minutes < end;
    };

    if (headline && stillOn(headline)) {
      const live = toMinutes(headline.startTime) != null && now.minutes >= toMinutes(headline.startTime);
      const icon = headline.category === "live-music" ? ICONS.music : ICONS.star;
      const when = live ? "" : clock(headline.startTime);
      chips.push(
        chip({
          href: headline.category === "live-music" ? "events.html#live-music" : "events.html",
          icon,
          text: `<em>${live ? "Happening now" : "Tonight"}</em> ${esc(headline.title)}${when ? ` · ${esc(when)}` : ""}`,
          cls: live ? "today-chip--live" : "today-chip--feature",
        })
      );
    } else {
      const next = nextEvent(events, now);
      if (next) {
        chips.push(
          chip({
            href: "events.html",
            icon: next.event.category === "live-music" ? ICONS.music : ICONS.star,
            text: `<em>${esc(next.dayLabel)}</em> ${esc(next.event.title)}${
              next.event.startTime ? ` · ${esc(clock(next.event.startTime))}` : ""
            }`,
            cls: "today-chip--feature",
          })
        );
      }
    }

    const hh = closedForDay ? null : happyHour(site, now);
    if (hh) chips.push(chip({ href: "happy-hour.html", icon: ICONS.glass, text: esc(hh.text), cls: hh.live ? "today-chip--live" : "" }));
    if (special && special.id !== headline?.id && stillOn(special)) {
      chips.push(chip({ href: "events.html", icon: ICONS.flame, text: esc(special.title) }));
    }

    if (!chips.length) return;
    root.innerHTML = chips.join("");
    root.hidden = false;
    root.classList.add("is-ready");
  }

  render();
  document.addEventListener("ws-config-updated", render);
  /* Keep "open now" honest if the page sits open for a while. */
  setInterval(render, 5 * 60 * 1000);
})();
