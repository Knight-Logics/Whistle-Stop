/* Events engine — reads data/events.json, renders calendar + upcoming */

(async function () {
  const params = new URLSearchParams(window.location.search);
  const isPreview = params.has("preview");

  if (isPreview) {
    document.documentElement.classList.add("ws-preview-embed");
  }

  const upcomingEls = document.querySelectorAll("#upcoming-events, #home-upcoming");

  const calendarEl = document.getElementById("event-calendar");

  const recurringCardsEl = document.getElementById("promo-cards-events");

  const oneOffEl = document.getElementById("events-one-off");

  if (!upcomingEls.length && !calendarEl && !recurringCardsEl && !oneOffEl) return;



  let data;

  async function loadData() {

    try {

      data =
        params.has("preview") && WSConfig.getForPreview
          ? await WSConfig.getForPreview("events")
          : await WSConfig.get("events");

    } catch (e) {

      console.warn("events.json not loaded", e);

      return false;

    }

    return true;

  }

  if (!(await loadData())) return;



  function parseDate(str) {

    const [y, m, d] = str.split("-").map(Number);

    return new Date(y, m - 1, d);

  }

  function formatISODate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }



  function formatTime(t) {

    if (!t) return "";

    const [h, min] = t.split(":").map(Number);

    const ampm = h >= 12 ? "PM" : "AM";

    const hr = h % 12 || 12;

    return `${hr}:${String(min).padStart(2, "0")} ${ampm}`;

  }



  function esc(s) {

    return String(s ?? "")

      .replace(/&/g, "&amp;")

      .replace(/</g, "&lt;")

      .replace(/>/g, "&gt;")

      .replace(/"/g, "&quot;");

  }

  async function resolveImg(src) {
    if (!src) return "";
    return window.WSConfig?.resolveMediaSrc ? await WSConfig.resolveMediaSrc(src) : src;
  }

  function eventImage(e) {
    if (e.image) return e.image;
    if (e.category === "live-music") return "assets/live-music.webp";
    return "assets/gallery/WSGoodTimes.webp";
  }

  const DOWS_FULL = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  ];

  function formatRecurringTag(ev) {
    const days = ev.dayOfWeek || [];
    if (days.length === 7) return "Every day";
    if (days.length === 1) return `Every ${DOWS_FULL[days[0]]}`;
    if (days.length === 2 && days.includes(5) && days.includes(6)) return "Fri & Sat";
    return days.map((d) => DOWS_SHORT[d]).join(" · ");
  }

  function formatOneOffTag(e) {
    const datePart = `${DOWS_SHORT[e.date.getDay()]}, ${MONTHS_SHORT[e.date.getMonth()]} ${e.date.getDate()}`;
    const timeStr = eventTimeLabel(e);
    return timeStr ? `${datePart} · ${timeStr}` : datePart;
  }



  function eventTimeLabel(e) {

    if (!e.startTime) return "";

    if (e.endTime) return `${formatTime(e.startTime)} – ${formatTime(e.endTime)}`;

    return formatTime(e.startTime);

  }



  function adminEventAttrs(e) {
    if (!isPreview) return "";
    return ` data-admin-event-id="${esc(e.id || "")}" data-admin-event-date="${esc(formatISODate(e.date))}" data-admin-event-title="${esc(e.title)}" data-admin-event-start="${esc(e.startTime || "")}" data-admin-event-recurring="${e.recurring ? "1" : "0"}" tabindex="0" role="button"`;
  }

  function renderCalEventChip(e) {

    const timeStr = eventTimeLabel(e);

    const chipClass = `ev${e.category === "live-music" ? " music" : ""}`;

    const tip = timeStr ? `${e.title} · ${timeStr}` : e.title;

    const timeHtml = timeStr ? `<span class="ev-time">${esc(timeStr)}</span>` : "";

    const adminAttrs = adminEventAttrs(e);

    return `<span class="${chipClass}" title="${esc(tip)}"${adminAttrs}>${timeHtml}<span class="ev-title">${esc(e.title)}</span></span>`;

  }

  function postAdminCalendarMessage(payload) {
    if (!isPreview || window.parent === window) return;
    window.parent.postMessage({ source: "ws-events-preview", ...payload }, window.location.origin);
  }

  let adminHighlightDate = "";

  function applyAdminHighlightDate(dateStr) {
    adminHighlightDate = dateStr || "";
    if (!isPreview || !calendarEl) return;
    calendarEl.querySelectorAll(".cal-day.admin-editing").forEach((el) => el.classList.remove("admin-editing"));
    if (!adminHighlightDate) return;
    calendarEl.querySelector(`[data-admin-date="${adminHighlightDate}"]`)?.classList.add("admin-editing");
  }

  if (isPreview) {
    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.source !== "ws-admin-preview") return;
      if (event.data.type === "highlight-date") applyAdminHighlightDate(event.data.date || "");
    });
  }

  function bindAdminCalendarClicks() {
    if (!isPreview || calendarEl?.dataset.adminClickBound) return;
    if (calendarEl) {
      calendarEl.dataset.adminClickBound = "1";
      calendarEl.addEventListener("click", onAdminPreviewClick);
    }
  }

  function onAdminPreviewClick(event) {
    const chip = event.target.closest("[data-admin-event-date]");
    if (chip) {
      event.preventDefault();
      event.stopPropagation();
      postAdminCalendarMessage({
        type: "event",
        id: chip.dataset.adminEventId,
        date: chip.dataset.adminEventDate,
        title: chip.dataset.adminEventTitle,
        startTime: chip.dataset.adminEventStart,
        recurring: chip.dataset.adminEventRecurring === "1",
      });
      return;
    }

    const day = event.target.closest("[data-admin-date]");
    if (!day) return;
    event.preventDefault();
    postAdminCalendarMessage({
      type: "day",
      date: day.dataset.adminDate,
    });
  }

  function bindAdminPreviewClicks() {
    if (!isPreview) return;
    ["upcoming-events", "events-one-off"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el.dataset.adminClickBound) return;
      el.dataset.adminClickBound = "1";
      el.addEventListener("click", onAdminPreviewClick);
      el.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const chip = event.target.closest("[data-admin-event-date]");
        if (!chip) return;
        event.preventDefault();
        onAdminPreviewClick(event);
      });
    });
    bindAdminSectionClicks();
  }

  function bindAdminSectionClicks() {
    if (!isPreview || document.body.dataset.adminSectionsBound) return;
    document.body.dataset.adminSectionsBound = "1";
    document.querySelectorAll("[data-admin-section]").forEach((el) => {
      el.classList.add("admin-preview-clickable");
      el.setAttribute("title", "Click to edit this section");
    });
    document.addEventListener(
      "click",
      (event) => {
        if (!isPreview) return;
        if (event.target.closest("[data-admin-event-date], [data-admin-date], [data-admin-promo-id], [data-admin-recurring-id]")) return;
        const section = event.target.closest("[data-admin-section]");
        if (!section) return;
        event.preventDefault();
        event.stopPropagation();
        postAdminCalendarMessage({ type: "section", section: section.dataset.adminSection });
      },
      true
    );
  }



  function expandRecurring(start, end) {

    const out = [];

    const cur = new Date(start);

    while (cur <= end) {

      data.recurring.forEach((ev) => {

        const dow = cur.getDay();

        if (!ev.dayOfWeek.includes(dow)) return;

        if (ev.weekOfMonth) {

          const week = Math.ceil(cur.getDate() / 7);

          if (week !== ev.weekOfMonth) return;

        }

        out.push({

          date: new Date(cur),

          title: ev.title,

          summary: ev.summary,

          category: ev.category,

          startTime: ev.startTime,

          endTime: ev.endTime,

          image: ev.image || "",

          recurring: true,

          id: ev.id,

        });

      });

      cur.setDate(cur.getDate() + 1);

    }

    return out;

  }



  function getEventsInRange(start, end) {

    const list = expandRecurring(start, end);

    (data.performances || []).forEach((p) => {

      const d = parseDate(p.date);

      if (d >= start && d <= end) {

        list.push({

          date: d,

          title: p.title,

          summary: p.note || "",

          category: p.category || "live-music",

          startTime: p.startTime,

          endTime: p.endTime,

          image: p.image || "",

          recurring: false,

          id: p.id || p.date + "-" + p.title,

        });

      }

    });

    return list.sort(

      (a, b) => a.date - b.date || (a.startTime || "").localeCompare(b.startTime || "")

    );

  }



  /** Calendar: show everything except generic “Live Music” when a named act exists that day */

  function filterCalendarEvents(events) {

    const byDay = new Map();

    events.forEach((e) => {

      const key = e.date.toDateString();

      if (!byDay.has(key)) byDay.set(key, []);

      byDay.get(key).push(e);

    });



    const out = [];

    byDay.forEach((dayEvents) => {

      const namedActs = dayEvents.filter(

        (e) =>

          e.category === "live-music" &&

          !e.recurring &&

          e.title !== "Live Music" &&

          e.title !== "Open Mic Night"

      );

      const hasNamedAct = namedActs.length > 0;



      dayEvents.forEach((e) => {

        if (hasNamedAct && e.title === "Live Music") return;

        out.push(e);

      });

    });



    const seen = new Set();

    return out

      .sort((a, b) => a.date - b.date || (a.startTime || "").localeCompare(b.startTime || ""))

      .filter((e) => {

        const key = `${e.date.toDateString()}|${e.title}|${e.startTime || ""}`;

        if (seen.has(key)) return false;

        seen.add(key);

        return true;

      });

  }



  /** Home + lineup highlights: skip noise and duplicate live-music rows */

  function filterDisplayEvents(events) {

    const byDay = new Map();

    events.forEach((e) => {

      const key = e.date.toDateString();

      if (!byDay.has(key)) byDay.set(key, []);

      byDay.get(key).push(e);

    });



    const out = [];

    byDay.forEach((dayEvents) => {

      const namedActs = dayEvents.filter(

        (e) =>

          e.category === "live-music" &&

          !e.recurring &&

          e.title !== "Live Music" &&

          e.title !== "Open Mic Night"

      );

      const hasNamedAct = namedActs.length > 0;



      dayEvents.forEach((e) => {

        if (e.id === "daily-specials" || e.title === "Daily Drink & Food Specials") return;

        if (hasNamedAct && e.title === "Live Music") return;

        out.push(e);

      });

    });



    const seen = new Set();

    return out

      .sort((a, b) => a.date - b.date || (a.startTime || "").localeCompare(b.startTime || ""))

      .filter((e) => {

        const key = `${e.date.toDateString()}|${e.title}|${e.startTime || ""}`;

        if (seen.has(key)) return false;

        seen.add(key);

        return true;

      });

  }



  const MONTHS_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  const MONTHS_LONG = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const DOWS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];



  function renderUpcomingGridItem(e) {
    const timeStr =
      e.startTime && e.endTime
        ? `${formatTime(e.startTime)} – ${formatTime(e.endTime)}`
        : e.startTime
          ? formatTime(e.startTime)
          : "";
    const tagClass = e.category === "live-music" ? "music" : "";
    const tagLabel =
      e.category === "live-music"
        ? "Featured act"
        : e.category === "specials"
          ? "Special"
          : "This date";

    return `
      <article class="upcoming-card reveal${isPreview ? " admin-preview-clickable" : ""}"${adminEventAttrs(e)}>
        <div class="upcoming-card-date">
          <span class="day">${e.date.getDate()}</span>
          <span class="month">${MONTHS_SHORT[e.date.getMonth()]}</span>
        </div>
        <h3>${esc(e.title)}</h3>
        ${timeStr ? `<div class="time">${esc(timeStr)}</div>` : ""}
        ${e.summary ? `<p class="upcoming-card-summary">${esc(e.summary)}</p>` : ""}
        <span class="tag ${tagClass}">${tagLabel}</span>
      </article>`;
  }

  function renderUpcomingListItem(e) {
    const timeStr =
      e.startTime && e.endTime
        ? `${formatTime(e.startTime)} – ${formatTime(e.endTime)}`
        : e.startTime
          ? formatTime(e.startTime)
          : "";
    const tagClass = e.category === "live-music" ? "music" : "";
    const tagLabel =
      e.category === "live-music" && !e.recurring
        ? "Featured act"
        : e.recurring
          ? "Weekly"
          : "This date";
    const adminAttrs = adminEventAttrs(e);
    const clickable = isPreview ? " admin-preview-clickable" : "";

    return `
        <li class="reveal${clickable}"${adminAttrs}>
          <div class="date-box">
            <div class="day">${e.date.getDate()}</div>
            <div class="month">${MONTHS_SHORT[e.date.getMonth()]}</div>
          </div>
          <div>
            <h3>${esc(e.title)}</h3>
            ${timeStr ? `<div class="time">${esc(timeStr)}</div>` : ""}
            ${e.summary ? `<p style="margin:0.25rem 0 0;color:var(--text-muted);font-size:0.9rem">${esc(e.summary)}</p>` : ""}
            <span class="tag ${tagClass}">${tagLabel}</span>
          </div>
        </li>`;
  }

function renderHomeEvents(container, events, today) {

    const listEvents = events.slice(0, 6);

    const gridStart = new Date(today);

    gridStart.setDate(gridStart.getDate() - gridStart.getDay());

    const gridEnd = new Date(gridStart);

    gridEnd.setDate(gridEnd.getDate() + 13);



    const byDay = {};

    events.forEach((e) => {

      if (e.date < gridStart || e.date > gridEnd) return;

      const key = e.date.toDateString();

      if (!byDay[key]) byDay[key] = [];

      byDay[key].push(e);

    });



    const rangeLabel =

      gridStart.getMonth() === gridEnd.getMonth()

        ? `${MONTHS_LONG[gridStart.getMonth()]} ${gridStart.getDate()} – ${gridEnd.getDate()}, ${gridEnd.getFullYear()}`

        : `${MONTHS_LONG[gridStart.getMonth()]} ${gridStart.getDate()} – ${MONTHS_LONG[gridEnd.getMonth()]} ${gridEnd.getDate()}, ${gridEnd.getFullYear()}`;



    let calendarHtml = `<div class="home-cal-head"><p class="home-cal-range">${rangeLabel}</p></div>`;

    DOWS_SHORT.forEach((d) => (calendarHtml += `<div class="cal-dow">${d}</div>`));



    const cur = new Date(gridStart);

    while (cur <= gridEnd) {

      const isPast = cur < today;

      const isToday = cur.toDateString() === today.toDateString();

      const evs = byDay[cur.toDateString()] || [];

      calendarHtml += `<div class="cal-day home-cal-day${isPast ? " past-day" : ""}${isToday ? " today" : ""}">

        <span class="num">${cur.getDate()}</span>

        <div class="home-cal-events">${evs

          .map((e) => {

            const timeStr = e.startTime ? formatTime(e.startTime) : "";

            const evClass =

              e.category === "live-music" ? "music" : e.recurring ? "weekly" : "special";

            return `<article class="home-cal-ev ${evClass}">

              ${timeStr ? `<span class="home-cal-ev-time">${timeStr}</span>` : ""}

              <strong>${e.title}</strong>

            </article>`;

          })

          .join("")}</div>

      </div>`;

      cur.setDate(cur.getDate() + 1);

    }



    const listHtml = listEvents.length

      ? `<ul class="upcoming-list">${listEvents.map(renderUpcomingListItem).join("")}</ul>`

      : "";



    container.innerHTML = `

      <div class="home-events-mobile" aria-label="Upcoming events list">${listHtml}</div>

      <div class="home-events-desktop calendar-grid home-calendar-grid" role="grid" aria-label="Two-week event calendar">${calendarHtml}</div>`;



    requestAnimationFrame(() => {

      container.querySelectorAll(".reveal").forEach((el, i) => {

        setTimeout(() => el.classList.add("visible"), i * 80);

      });

    });

  }



  async function renderUpcoming(container, limit = 8) {

    const isHome = container.id === "home-upcoming";

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const end = new Date(today);

    end.setDate(end.getDate() + (isHome ? 21 : 45));



    let events = getEventsInRange(today, end).filter((e) => e.date >= today);

    if (isHome) events = filterDisplayEvents(events);



    if (!events.length) {

      container.innerHTML =

        "<p>No upcoming events scheduled. Check back soon or see the full <a href=\"events.html\">events calendar</a>.</p>";

      return;

    }



    if (isHome) {

      renderHomeEvents(container, events, today);

      return;

    }



    events = filterDisplayEvents(events);
    events = events.slice(0, limit);

    container.innerHTML = `<div class="upcoming-grid" role="list">${events

      .map(renderUpcomingGridItem)

      .join("")}</div>`;



    requestAnimationFrame(() => {

      container.querySelectorAll(".reveal").forEach((el, i) => {

        setTimeout(() => el.classList.add("visible"), i * 80);

      });

    });

  }



  let viewYear, viewMonth;



  function renderCalendar() {
    if (!calendarEl) return;
    const now = new Date();
    if (viewYear == null) {
      viewYear = now.getFullYear();
      viewMonth = now.getMonth();
    }

    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    const startPad = new Date(first);
    startPad.setDate(startPad.getDate() - first.getDay());
    const endPad = new Date(last);
    endPad.setDate(endPad.getDate() + (6 - last.getDay()));

    const events = filterCalendarEvents(getEventsInRange(startPad, endPad));
    const byDay = {};
    events.forEach((e) => {
      const key = e.date.toDateString();
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(e);
    });

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const monthEvents = events
      .filter((e) => e.date.getMonth() === viewMonth && e.date.getFullYear() === viewYear)
      .sort((a, b) => a.date - b.date || (a.startTime || "").localeCompare(b.startTime || ""));

    const listHtml = monthEvents.length
      ? `<ul class="upcoming-list">${monthEvents.map(renderUpcomingListItem).join("")}</ul>`
      : `<p class="events-cal-empty">No events scheduled this month.</p>`;

    let gridHtml = "";
    dows.forEach((d) => (gridHtml += `<div class="cal-dow">${d}</div>`));

    const cur = new Date(startPad);
    while (cur <= endPad) {
      const inMonth = cur.getMonth() === viewMonth;
      const isToday = cur.toDateString() === now.toDateString();
      const evs = byDay[cur.toDateString()] || [];
      const adminDayAttrs = isPreview
        ? ` data-admin-date="${esc(formatISODate(cur))}" title="Click to add or edit this date"`
        : "";
      gridHtml += `<div class="cal-day${inMonth ? "" : " other-month"}${isToday ? " today" : ""}"${adminDayAttrs}>
        <span class="num">${cur.getDate()}</span>
        ${evs
          .slice(0, 3)
          .map((e) => renderCalEventChip(e))
          .join("")}
      </div>`;
      cur.setDate(cur.getDate() + 1);
    }

    calendarEl.classList.remove("calendar-grid");
    calendarEl.classList.add("event-calendar-root");
    calendarEl.innerHTML = `
      <div class="cal-header">
        <button type="button" id="cal-prev" aria-label="Previous month">‹</button>
        <h3>${monthNames[viewMonth]} ${viewYear}</h3>
        <button type="button" id="cal-next" aria-label="Next month">›</button>
      </div>
      <div class="events-cal-mobile" aria-label="Month events list">${listHtml}</div>
      <div class="events-cal-desktop calendar-grid" role="grid" aria-label="Month calendar">${gridHtml}</div>`;

    bindAdminCalendarClicks();
    applyAdminHighlightDate(adminHighlightDate);

    calendarEl.querySelector("#cal-prev")?.addEventListener("click", () => {
      viewMonth--;
      if (viewMonth < 0) {
        viewMonth = 11;
        viewYear--;
      }
      renderCalendar();
    });

    calendarEl.querySelector("#cal-next")?.addEventListener("click", () => {
      viewMonth++;
      if (viewMonth > 11) {
        viewMonth = 0;
        viewYear++;
      }
      renderCalendar();
    });
  }

async function renderOneOffEvents() {
    const root = oneOffEl;
    if (!root) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + 60);

    const events = getEventsInRange(today, end)
      .filter((e) => e.date >= today && !e.recurring)
      .slice(0, 24);

    if (!events.length) {
      root.innerHTML =
        '<p style="color:var(--text-muted);margin:0">No special one-time events on the calendar yet — check back or browse the month above.</p>';
      return;
    }

    root.innerHTML = `<div class="card-grid cols-2">${(
      await Promise.all(
        events.map(async (e) => {
          const src = await resolveImg(eventImage(e));
          const tagClass =
            e.category === "live-music" ? " music" : e.category === "specials" ? " specials" : "";
          return `
      <article class="card reveal visible${isPreview ? " admin-preview-clickable" : ""}"${adminEventAttrs(e)}>
        <div class="card-img card-img--media"><img src="${esc(src)}" alt="${esc(e.title)}" loading="lazy" decoding="async" /></div>
        <div class="card-body">
          <h3>${esc(e.title)}</h3>
          <p>${esc(e.summary || "")}</p>
          <div class="card-meta"><span class="tag${tagClass}">${esc(formatOneOffTag(e))}</span></div>
        </div>
      </article>`;
        })
      )
    ).join("")}</div>`;

    window.WSUI?.refreshScrollReveal?.();
  }



  async function renderRecurringFavorites() {
    const root = recurringCardsEl;
    if (!root || !data.recurring?.length) return;

    const cards = data.recurring.filter((ev) => ev.title);

    if (!cards.length) {
      root.innerHTML = "";
      return;
    }

    root.innerHTML = (
      await Promise.all(
        cards.map(async (ev) => {
          const src = await resolveImg(eventImage(ev));
          const tagClass = ev.category === "live-music" ? " music" : "";
          const clickAttrs = isPreview
            ? ` data-admin-recurring-id="${esc(ev.id)}" tabindex="0" role="button"`
            : "";
          return `
      <article class="card reveal visible${isPreview ? " admin-preview-clickable" : ""}"${clickAttrs}>
        <div class="card-img card-img--media"><img src="${esc(src)}" alt="${esc(ev.title)}" loading="lazy" decoding="async" /></div>
        <div class="card-body">
          <h3>${esc(ev.title)}</h3>
          <p>${esc(ev.summary || "")}</p>
          <div class="card-meta"><span class="tag${tagClass}">${esc(formatRecurringTag(ev))}</span></div>
        </div>
      </article>`;
        })
      )
    ).join("");

    window.WSUI?.refreshScrollReveal?.();
  }



  function bindAdminRecurringClicks() {
    if (!isPreview || !recurringCardsEl || recurringCardsEl.dataset.adminRecurringBound) return;
    recurringCardsEl.dataset.adminRecurringBound = "1";
    const send = (card) => {
      postAdminCalendarMessage({ type: "recurring", id: card.dataset.adminRecurringId });
    };
    recurringCardsEl.addEventListener("click", (event) => {
      const card = event.target.closest("[data-admin-recurring-id]");
      if (!card) return;
      event.preventDefault();
      event.stopPropagation();
      send(card);
    });
    recurringCardsEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const card = event.target.closest("[data-admin-recurring-id]");
      if (!card) return;
      event.preventDefault();
      send(card);
    });
  }



  async function renderAll() {

    await Promise.all([
      ...Array.from(upcomingEls).map((el) => renderUpcoming(el, el.id === "home-upcoming" ? 6 : 24)),
      renderRecurringFavorites(),
      renderOneOffEvents(),
    ]);

    renderCalendar();

    bindAdminPreviewClicks();
    bindAdminRecurringClicks();
    document.dispatchEvent(new CustomEvent("ws-preview-layout"));
  }

  renderAll();

  document.addEventListener("ws-config-updated", async (e) => {
    const section = e.detail?.section;
    if (section === "site" || section === "all") bindAdminSectionClicks();
    if (section && section !== "events" && section !== "site" && section !== "all") return;
    if (await loadData()) renderAll();
  });

  document.addEventListener("ws-site-applied", () => {
    bindAdminSectionClicks();
  });

})();

