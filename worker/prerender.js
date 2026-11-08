// Writes the menu and upcoming events into the page HTML so search engines and AI tools
// can read them without running JavaScript. The page scripts replace this markup on load.

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function menuHtml(data) {
  const menus = Array.isArray(data?.menus) ? data.menus : [];
  if (!menus.length) return "";
  const panels = menus
    .map((menu, mi) => {
      const cats = (menu.categories || [])
        .map(
          (cat) => `
        <section class="menu-category-block" id="${esc(menu.id)}-${esc(cat.id)}">
          <h2 class="menu-category-title">${esc(cat.name)}</h2>
          ${cat.note ? `<p class="menu-cat-note">${esc(cat.note)}</p>` : ""}
          <div class="menu-items">${(cat.items || [])
            .map(
              (item) => `
            <article class="menu-item visible">
              <div class="menu-item-body"><h3>${esc(item.name)}</h3>${item.desc ? `<p>${esc(item.desc)}</p>` : ""}</div>
              ${item.price ? `<div class="menu-item-actions"><span class="price">${esc(item.price)}</span></div>` : ""}
            </article>`
            )
            .join("")}</div>
        </section>`
        )
        .join("");
      return `
      <div class="menu-panel${mi === 0 ? " is-active" : ""}" data-menu="${esc(menu.id)}">
        <div class="menu-panel-grid"><div class="menu-panel-content">
          <h2 class="menu-category-title">${esc(menu.label)}</h2>
          ${menu.intro ? `<p class="menu-panel-intro">${esc(menu.intro)}</p>` : ""}
          ${cats}
        </div></div>
      </div>`;
    })
    .join("");
  return `<div class="container menu-layout menu-layout--prerendered"><div class="menu-panels">${panels}</div></div>`;
}

function formatTime(t) {
  const [h, m] = String(t || "").split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = ((h + 11) % 12) + 1;
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""} ${suffix}`;
}

export function upcomingEventsHtml(data, now = new Date()) {
  const today = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today.getTime() + 60 * 86400000);
  const shows = (Array.isArray(data?.performances) ? data.performances : [])
    .map((p) => ({ ...p, when: new Date(`${p.date}T12:00:00`) }))
    .filter((p) => p.when >= today && p.when <= horizon)
    .sort((a, b) => a.when - b.when)
    .slice(0, 12);
  if (!shows.length) return "";
  const items = shows
    .map((p) => {
      const day = p.when.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const time = p.startTime ? ` · ${formatTime(p.startTime)}${p.endTime ? `–${formatTime(p.endTime)}` : ""}` : "";
      return `<li><strong>${esc(p.title)}</strong> <span>${esc(day)}${esc(time)}</span></li>`;
    })
    .join("");
  return `<ul class="events-prerendered">${items}</ul>`;
}
