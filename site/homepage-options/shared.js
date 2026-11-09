/* Shared facts for the homepage design options. One place to fix an hour or a night. */
(function () {
  const TZ = "America/New_York";

  // Weekly program, Sunday = 0 (from data/events.json and the venue's own flyers).
  const WEEK = [
    { day: "Sunday", short: "Sun", title: "Breakfast Bloody Mary Sunday", time: "From 11 AM", detail: "$5 mimosas and Bloody Marys with brunch on the patio." },
    { day: "Monday", short: "Mon", title: "Martini Monday & Taco Night", time: "4 PM to close", detail: "Half-off martinis and 2-for-$6 tacos. Words & Wine book club meets the 3rd Monday." },
    { day: "Tuesday", short: "Tue", title: "Open Mic Night", time: "6:30 to 9:30 PM", detail: "Local talent takes the stage. Happy hour runs 4 PM to close." },
    { day: "Wednesday", short: "Wed", title: "Cornhole Wednesdays", time: "From 6 PM", detail: "Boards out in the lot, happy hour 4 PM to close." },
    { day: "Thursday", short: "Thu", title: "Guitar Guild & Ukulele Jam", time: "3rd & 4th Thursdays", detail: "TB Guitar Guild on the 3rd Thursday (6–9 PM), Tampa Bay Ukulele Society open jam on the 4th (6:30–9:30 PM)." },
    { day: "Friday", short: "Fri", title: "Live Music", time: "6:30 to 9:30 PM", detail: "Local artists on the patio stage." },
    { day: "Saturday", short: "Sat", title: "Live Music", time: "6:30 to 9:30 PM", detail: "Local artists on the patio stage." },
  ];

  const HOURS = [
    { days: "Sunday to Thursday", short: "Sun–Thu", open: 11, close: 21, label: "11 AM – 9 PM" },
    { days: "Friday and Saturday", short: "Fri–Sat", open: 11, close: 22, label: "11 AM – 10 PM" },
  ];

  function nowParts(date = new Date()) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "numeric", minute: "numeric", hour12: false })
        .formatToParts(date)
        .map((p) => [p.type, p.value])
    );
    const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
    const hour = Number(parts.hour) % 24 + Number(parts.minute) / 60;
    return { dayIndex, hour };
  }

  function hoursFor(dayIndex) {
    return dayIndex === 5 || dayIndex === 6 ? HOURS[1] : HOURS[0];
  }

  function fmt(h) {
    const hr = Math.floor(h);
    return `${hr % 12 || 12} ${hr < 12 || hr === 24 ? "AM" : "PM"}`;
  }

  /** { open, text } e.g. "Open now · until 9 PM" or "Closed · opens 11 AM" */
  function status(date) {
    const { dayIndex, hour } = nowParts(date);
    const h = hoursFor(dayIndex);
    if (hour >= h.open && hour < h.close) return { open: true, text: `Open now until ${fmt(h.close)}` };
    if (hour < h.open) return { open: false, text: `Opens today at ${fmt(h.open)}` };
    return { open: false, text: `Closed now. Opens tomorrow at ${fmt(hoursFor((dayIndex + 1) % 7).open)}` };
  }

  function today(date) {
    const { dayIndex, hour } = nowParts(date);
    const happy = hour >= 16 && (dayIndex === 2 || dayIndex === 3 || hour < 19);
    return { dayIndex, hour, night: WEEK[dayIndex], happyHourNow: happy };
  }

  window.WS = {
    name: "Whistle Stop Grill & Bar",
    phone: "(727) 726-1956",
    tel: "tel:+17277261956",
    street: "915 Main Street",
    cityLine: "Safety Harbor, FL 34695",
    maps: "https://maps.google.com/?q=Whistle+Stop+Grill+Bar+915+Main+Street+Safety+Harbor+FL",
    giftCards: "https://order.toasttab.com/egift/whistle-stop-grill-bar",
    facebook: "https://www.facebook.com/Whistlestopgrillandbar915",
    instagram: "https://www.instagram.com/whistlestop_grill/",
    WEEK,
    HOURS,
    status,
    today,
  };

  // Fill any [data-ws="status"] / [data-ws="tonight"] placeholders the design left for us.
  document.addEventListener("DOMContentLoaded", () => {
    const s = status();
    const t = today();
    document.querySelectorAll('[data-ws="status"]').forEach((el) => {
      el.textContent = s.text;
      el.classList.toggle("is-open", s.open);
    });
    document.querySelectorAll('[data-ws="tonight"]').forEach((el) => (el.textContent = t.night.title));
    document.querySelectorAll('[data-ws="tonight-time"]').forEach((el) => (el.textContent = t.night.time));
    document.querySelectorAll('[data-ws="tonight-detail"]').forEach((el) => (el.textContent = t.night.detail));
    document.querySelectorAll('[data-ws="weekday"]').forEach((el) => (el.textContent = t.night.day));
    document.querySelectorAll("[data-ws-day]").forEach((el) => {
      el.classList.toggle("is-today", Number(el.dataset.wsDay) === t.dayIndex);
    });
  });
})();
