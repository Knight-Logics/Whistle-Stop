/* Whistle Stop — Staff Scheduling (operations week board) */
window.WSAdminStaffScheduling = (function () {
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function toISODate(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function parseISODate(iso) {
    const [y, m, day] = String(iso || "").split("-").map(Number);
    if (!y || !m || !day) return null;
    return new Date(y, m - 1, day);
  }

  function startOfWeek(d) {
    const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    out.setDate(out.getDate() - out.getDay());
    return out;
  }

  function addDays(d, n) {
    const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    out.setDate(out.getDate() + n);
    return out;
  }

  function formatTime(hhmm) {
    const [hRaw, m] = String(hhmm || "00:00").split(":").map(Number);
    let h = hRaw % 24;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${pad2(m || 0)} ${ampm}`;
  }

  function formatDayHeading(d) {
    return `${DOW[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  }

  function formatWeekRange(weekStart) {
    const end = addDays(weekStart, 6);
    if (weekStart.getMonth() === end.getMonth()) {
      return `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  }

  function employeeName(data, id) {
    return data.employees?.find((e) => e.id === id)?.name || "Unassigned";
  }

  function roleClass(role) {
    const key = String(role || "").toLowerCase();
    if (key.includes("manage")) return "is-manager";
    if (key.includes("cook") || key.includes("kitchen")) return "is-cook";
    if (key.includes("bar")) return "is-bar";
    if (key.includes("host")) return "is-host";
    return "is-server";
  }

  function cloneData(data) {
    return JSON.parse(JSON.stringify(data || { employees: [], shifts: [], roles: [] }));
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  async function render(panel) {
    let data = cloneData(await WSConfig.get("staffSchedule"));
    let weekStart = startOfWeek(new Date());
    const canEdit = WSConfig.canPublish?.() !== false;
    const user = WSConfig.getSessionUser?.() || {};

    function shiftsForDate(iso) {
      return (data.shifts || [])
        .filter((s) => s.date === iso)
        .sort((a, b) => String(a.start).localeCompare(String(b.start)) || employeeName(data, a.employeeId).localeCompare(employeeName(data, b.employeeId)));
    }

    function markDirty() {
      panel._markUnsaved?.();
    }

    function collect() {
      data.updatedAt = new Date().toISOString();
      data.source = data.source || "manual";
      return cloneData(data);
    }

    panel._getStaffSchedule = collect;

    function openShiftModal(existing, defaultDate) {
      const g = window.WSAdminGUI;
      if (!g?.openAdminModal) return;
      const shift = existing
        ? { ...existing }
        : {
            id: uid("s"),
            employeeId: data.employees?.[0]?.id || "",
            date: defaultDate || toISODate(new Date()),
            start: "11:00",
            end: "19:00",
            role: data.employees?.[0]?.roles?.[0] || data.roles?.[0] || "Server",
            note: "",
          };

      const empOptions = (data.employees || [])
        .map((e) => `<option value="${esc(e.id)}" ${e.id === shift.employeeId ? "selected" : ""}>${esc(e.name)} (${esc((e.roles || []).join(", "))})</option>`)
        .join("");
      const roleOptions = (data.roles || [])
        .map((r) => `<option value="${esc(r)}" ${r === shift.role ? "selected" : ""}>${esc(r)}</option>`)
        .join("");

      g.openAdminModal({
        title: existing ? "Edit shift" : "Add shift",
        subtitle: "First names only. This board is for staff phones — not the public website.",
        bodyHtml: `
          <div class="admin-form-grid">
            <div class="admin-field">
              <label for="ss-emp">Team member</label>
              <select id="ss-emp">${empOptions}</select>
            </div>
            <div class="admin-field">
              <label for="ss-role">Role</label>
              <select id="ss-role">${roleOptions}</select>
            </div>
            <div class="admin-field">
              <label for="ss-date">Date</label>
              <input type="date" id="ss-date" value="${esc(shift.date)}" />
            </div>
            <div class="admin-field">
              <label for="ss-start">Start</label>
              <input type="time" id="ss-start" value="${esc(shift.start)}" />
            </div>
            <div class="admin-field">
              <label for="ss-end">End</label>
              <input type="time" id="ss-end" value="${esc(shift.end)}" />
            </div>
            <div class="admin-field" style="grid-column:1/-1">
              <label for="ss-note">Note (optional)</label>
              <input type="text" id="ss-note" value="${esc(shift.note || "")}" placeholder="Patio, brunch, cut early…" />
            </div>
          </div>`,
        footerHtml: `
          ${existing ? `<button type="button" class="btn btn-outline admin-btn-sm" id="ss-delete" style="margin-right:auto;color:var(--rust);border-color:rgba(224,80,80,.45)">Delete</button>` : ""}
          <button type="button" class="btn btn-outline admin-btn-sm" data-admin-modal-close>Cancel</button>
          <button type="button" class="btn btn-primary admin-btn-sm" id="ss-save">Save shift</button>`,
        onMount: (root) => {
          root.querySelector("#ss-save")?.addEventListener("click", () => {
            const next = {
              id: shift.id,
              employeeId: root.querySelector("#ss-emp")?.value || "",
              role: root.querySelector("#ss-role")?.value || "Server",
              date: root.querySelector("#ss-date")?.value || shift.date,
              start: root.querySelector("#ss-start")?.value || "11:00",
              end: root.querySelector("#ss-end")?.value || "19:00",
              note: (root.querySelector("#ss-note")?.value || "").trim(),
            };
            if (!next.employeeId || !next.date) return;
            const idx = (data.shifts || []).findIndex((s) => s.id === next.id);
            if (idx >= 0) data.shifts[idx] = next;
            else {
              data.shifts = data.shifts || [];
              data.shifts.push(next);
            }
            markDirty();
            g.closeAdminModal();
            paint();
          });
          root.querySelector("#ss-delete")?.addEventListener("click", () => {
            data.shifts = (data.shifts || []).filter((s) => s.id !== shift.id);
            markDirty();
            g.closeAdminModal();
            paint();
          });
        },
      });
    }

    function paint() {
      const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
      const todayIso = toISODate(new Date());
      const weekShiftCount = (data.shifts || []).filter((s) => {
        const d = parseISODate(s.date);
        return d && d >= weekStart && d <= addDays(weekStart, 6);
      }).length;

      const myName = String(user.displayName || "").split(/\s+/)[0];
      const myShifts = myName
        ? (data.shifts || []).filter((s) => {
            const d = parseISODate(s.date);
            return (
              d &&
              d >= weekStart &&
              d <= addDays(weekStart, 6) &&
              employeeName(data, s.employeeId).toLowerCase() === myName.toLowerCase()
            );
          })
        : [];

      panel.innerHTML = `
        <p class="admin-note">Phone-friendly week board for cooks, servers, bartenders, hosts, and managers. <strong>Save draft</strong> keeps it on this device; <strong>Publish live</strong> shares the week with every staff phone that opens admin (first names only — not guest-facing).</p>

        <div class="admin-schedule-toast-card" role="note">
          <div>
            <strong>Toast already does staff scheduling</strong>
            <p>Toast POS alone clocks people in; <em>scheduling</em> is Toast Scheduling (in Toast Web) and/or <em>Sling by Toast</em>. Staff view their hours on the <strong>MyToast</strong> or Sling app — that’s the private, phone-native path for Whistle Stop when those products are enabled.</p>
            <p class="admin-schedule-toast-links">Docs: <a href="https://support.toasttab.com/en/article/Scheduling-by-Sling-in-Toast-Web" target="_blank" rel="noopener">Toast Scheduling</a> · <a href="https://support.toasttab.com/en/article/Integrating-Sling-with-Toast" target="_blank" rel="noopener">Sling by Toast</a></p>
          </div>
          <span class="admin-mock-pill is-pending">Use Toast when live</span>
        </div>

        <div class="admin-schedule-toolbar">
          <div class="admin-schedule-week-nav">
            <button type="button" class="btn btn-outline admin-btn-sm" id="ss-prev" aria-label="Previous week">‹</button>
            <div class="admin-schedule-week-label">
              <span class="admin-preview-label">This week</span>
              <strong>${esc(formatWeekRange(weekStart))}</strong>
            </div>
            <button type="button" class="btn btn-outline admin-btn-sm" id="ss-next" aria-label="Next week">›</button>
          </div>
          <div class="admin-schedule-toolbar-actions">
            <button type="button" class="btn btn-outline admin-btn-sm" id="ss-today">Today</button>
            ${canEdit ? `<button type="button" class="btn btn-primary admin-btn-sm" id="ss-add">+ Add shift</button>` : ""}
          </div>
        </div>

        <div class="admin-schedule-stats">
          <div class="admin-mock-stat">
            <span class="admin-mock-stat-label">Shifts this week</span>
            <strong>${weekShiftCount}</strong>
          </div>
          <div class="admin-mock-stat">
            <span class="admin-mock-stat-label">On the roster</span>
            <strong>${(data.employees || []).length}</strong>
          </div>
          <div class="admin-mock-stat">
            <span class="admin-mock-stat-label">Your shifts</span>
            <strong>${myShifts.length}</strong>
            <span class="admin-mock-stat-sub">${myName ? esc(myName) : "Sign-in name match"}</span>
          </div>
        </div>

        <div class="admin-schedule-week" aria-label="Week schedule">
          ${days
            .map((day) => {
              const iso = toISODate(day);
              const list = shiftsForDate(iso);
              const isToday = iso === todayIso;
              return `
              <section class="admin-schedule-day${isToday ? " is-today" : ""}" data-date="${esc(iso)}">
                <header class="admin-schedule-day-head">
                  <h3>${esc(formatDayHeading(day))}${isToday ? ' <span class="admin-schedule-today-tag">Today</span>' : ""}</h3>
                  ${canEdit ? `<button type="button" class="btn btn-outline admin-btn-sm" data-ss-add-day="${esc(iso)}">+ Shift</button>` : ""}
                </header>
                ${
                  list.length
                    ? `<ul class="admin-schedule-shift-list">
                        ${list
                          .map(
                            (s) => `
                          <li class="admin-schedule-shift ${roleClass(s.role)}" ${canEdit ? `data-ss-edit="${esc(s.id)}" tabindex="0" role="button"` : ""}>
                            <div class="admin-schedule-shift-time">${esc(formatTime(s.start))} – ${esc(formatTime(s.end))}</div>
                            <div class="admin-schedule-shift-who">
                              <strong>${esc(employeeName(data, s.employeeId))}</strong>
                              <span class="admin-schedule-role">${esc(s.role)}</span>
                            </div>
                            ${s.note ? `<p class="admin-schedule-note">${esc(s.note)}</p>` : ""}
                          </li>`
                          )
                          .join("")}
                      </ul>`
                    : `<p class="admin-schedule-empty">No one scheduled.</p>`
                }
              </section>`;
            })
            .join("")}
        </div>

        <div class="admin-mock-card admin-schedule-roster">
          <h3>Roster</h3>
          <p class="admin-mock-subnote">Demo names for presentation. Replace with real first names when Whistle Stop owns the board — or sync from Toast employees later.</p>
          <ul class="admin-schedule-roster-list">
            ${(data.employees || [])
              .map(
                (e) => `
              <li>
                <strong>${esc(e.name)}</strong>
                <span>${esc((e.roles || []).join(" · "))}</span>
              </li>`
              )
              .join("")}
          </ul>
        </div>`;

      panel.querySelector("#ss-prev")?.addEventListener("click", () => {
        weekStart = addDays(weekStart, -7);
        paint();
      });
      panel.querySelector("#ss-next")?.addEventListener("click", () => {
        weekStart = addDays(weekStart, 7);
        paint();
      });
      panel.querySelector("#ss-today")?.addEventListener("click", () => {
        weekStart = startOfWeek(new Date());
        paint();
      });
      panel.querySelector("#ss-add")?.addEventListener("click", () => openShiftModal(null, toISODate(weekStart)));
      panel.querySelectorAll("[data-ss-add-day]").forEach((btn) => {
        btn.addEventListener("click", () => openShiftModal(null, btn.getAttribute("data-ss-add-day")));
      });
      panel.querySelectorAll("[data-ss-edit]").forEach((el) => {
        const open = () => {
          const shift = (data.shifts || []).find((s) => s.id === el.getAttribute("data-ss-edit"));
          if (shift) openShiftModal(shift);
        };
        el.addEventListener("click", open);
        el.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            open();
          }
        });
      });
    }

    paint();
  }

  return { render };
})();
