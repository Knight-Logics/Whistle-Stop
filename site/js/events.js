/* Events engine — reads data/events.json, renders calendar + upcoming */

(async function () {

  const upcomingEls = document.querySelectorAll("#upcoming-events, #home-upcoming");

  const lineupEls = document.querySelectorAll("#live-music-lineup");

  const calendarEl = document.getElementById("event-calendar");

  if (!upcomingEls.length && !lineupEls.length && !calendarEl) return;



  let data;

  try {

    const res = await fetch("data/events.json");

    data = await res.json();

  } catch (e) {

    console.warn("events.json not loaded", e);

    return;

  }



  function parseDate(str) {

    const [y, m, d] = str.split("-").map(Number);

    return new Date(y, m - 1, d);

  }



  function formatTime(t) {

    if (!t) return "";

    const [h, min] = t.split(":").map(Number);

    const ampm = h >= 12 ? "PM" : "AM";

    const hr = h % 12 || 12;

    return `${hr}:${String(min).padStart(2, "0")} ${ampm}`;

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

          recurring: false,

          id: p.date + "-" + p.title,

        });

      }

    });

    return list.sort(

      (a, b) => a.date - b.date || (a.startTime || "").localeCompare(b.startTime || "")

    );

  }



  /** Home + highlights: skip noise and duplicate live-music rows */

  function filterForHome(events) {

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
      e.category === "live-music" && !e.recurring
        ? "Featured act"
        : e.recurring
          ? "Weekly"
          : "This date";

    return `
      <article class="upcoming-card reveal">
        <div class="upcoming-card-date">
          <span class="day">${e.date.getDate()}</span>
          <span class="month">${MONTHS_SHORT[e.date.getMonth()]}</span>
        </div>
        <h3>${e.title}</h3>
        ${timeStr ? `<div class="time">${timeStr}</div>` : ""}
        ${e.summary ? `<p class="upcoming-card-summary">${e.summary}</p>` : ""}
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

    return `

        <li class="reveal">

          <div class="date-box">

            <div class="day">${e.date.getDate()}</div>

            <div class="month">${MONTHS_SHORT[e.date.getMonth()]}</div>

          </div>

          <div>

            <h3>${e.title}</h3>

            ${timeStr ? `<div class="time">${timeStr}</div>` : ""}

            ${e.summary ? `<p style="margin:0.25rem 0 0;color:var(--text-muted);font-size:0.9rem">${e.summary}</p>` : ""}

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

              <strong>${e.title}</strong>

              ${timeStr ? `<span>${timeStr}</span>` : ""}

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



  function renderUpcoming(container, limit = 8) {

    const isHome = container.id === "home-upcoming";

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const end = new Date(today);

    end.setDate(end.getDate() + (isHome ? 21 : 45));



    let events = getEventsInRange(today, end).filter((e) => e.date >= today);

    if (isHome) events = filterForHome(events);



    if (!events.length) {

      container.innerHTML =

        "<p>No upcoming events scheduled. Check back soon or see the full <a href=\"events.html\">events calendar</a>.</p>";

      return;

    }



    if (isHome) {

      renderHomeEvents(container, events, today);

      return;

    }



    events = filterForHome(events);
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



    const events = getEventsInRange(startPad, endPad);

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



    let html = `

      <div class="cal-header">

        <button type="button" id="cal-prev" aria-label="Previous month">‹</button>

        <h3>${monthNames[viewMonth]} ${viewYear}</h3>

        <button type="button" id="cal-next" aria-label="Next month">›</button>

      </div>`;

    dows.forEach((d) => (html += `<div class="cal-dow">${d}</div>`));



    const cur = new Date(startPad);

    while (cur <= endPad) {

      const inMonth = cur.getMonth() === viewMonth;

      const isToday = cur.toDateString() === now.toDateString();

      const evs = byDay[cur.toDateString()] || [];

      html += `<div class="cal-day${inMonth ? "" : " other-month"}${isToday ? " today" : ""}">

        <span class="num">${cur.getDate()}</span>

        ${evs

          .slice(0, 3)

          .map(

            (e) =>

              `<span class="ev ${e.category === "live-music" ? "music" : ""}" title="${e.title}">${e.title}</span>`

          )

          .join("")}

      </div>`;

      cur.setDate(cur.getDate() + 1);

    }



    calendarEl.innerHTML = html;

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



  function renderLineup(container, limit = 10) {

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const end = new Date(today);

    end.setDate(end.getDate() + 35);

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];



    const events = filterForHome(

      getEventsInRange(today, end).filter(

        (e) => e.date >= today && e.category === "live-music"

      )

    ).slice(0, limit);



    if (!events.length) {

      container.innerHTML =

        '<h2>Upcoming acts</h2><p style="color:var(--text-muted);margin:0">Check the <a href="events.html">events calendar</a> for the latest lineup.</p>';

      return;

    }



    container.innerHTML = `<h2>Upcoming acts</h2>${events

      .map((e) => {

        const timeStr =

          e.startTime && e.endTime

            ? `${formatTime(e.startTime)} – ${formatTime(e.endTime)}`

            : e.startTime

              ? formatTime(e.startTime)

              : "";

        return `

        <div class="lineup-row">

          <div>

            <div class="lineup-date">${days[e.date.getDay()]}, ${months[e.date.getMonth()]} ${e.date.getDate()}</div>

            ${timeStr ? `<div class="lineup-time">${timeStr}</div>` : ""}

          </div>

          <div class="lineup-act">${e.title}</div>

        </div>`;

      })

      .join("")}`;

  }



  upcomingEls.forEach((el) => renderUpcoming(el, el.id === "home-upcoming" ? 6 : 24));

  lineupEls.forEach((el) => renderLineup(el, 10));

  renderCalendar();

})();

