/* Whistle Stop — staff-facing admin form builders (no JSON editing) */
window.WSAdminGUI = (function () {
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function field(label, html) {
    return `<div class="admin-field"><label>${label}</label>${html}</div>`;
  }

  const EVENT_CATEGORIES = [
    ["live-music", "Live music"],
    ["community", "Community"],
    ["specials", "Specials / promos"],
  ];

  function dayOfWeekFromDate(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return 0;
    return new Date(y, m - 1, d).getDay();
  }

  function formatDaysOfWeek(days) {
    if (!Array.isArray(days) || !days.length) return "No days selected";
    if (days.length === 7) return "Every day";
    return days.map((d) => DAYS[d]).join(", ");
  }

  function daysOfWeekField(selectedDays, attrName) {
    const selected = new Set(Array.isArray(selectedDays) ? selectedDays : []);
    const boxes = DAYS.map(
      (label, i) => `
        <label class="admin-dow-option">
          <input type="checkbox" ${attrName}="day" value="${i}"${selected.has(i) ? " checked" : ""} />
          <span>${label}</span>
        </label>`
    ).join("");
    return `<div class="admin-field admin-field--full"><label>Repeats on</label><div class="admin-dow-picker" role="group" aria-label="Days of week">${boxes}</div></div>`;
  }

  function readCheckedDays(scope, selector) {
    return [...scope.querySelectorAll(selector)]
      .filter((el) => el.checked)
      .map((el) => Number(el.value))
      .sort((a, b) => a - b);
  }

  function eventCategoryField(name, value, attr = "data-field") {
    const options = EVENT_CATEGORIES.map(
      ([val, label]) => `<option value="${val}"${value === val ? " selected" : ""}>${label}</option>`
    ).join("");
    return field("Category", `<select ${attr}="${name}">${options}</select>`);
  }

  function weekOfMonthField(name, value, attr = "data-field") {
    const weeks = [
      ["", "Every week"],
      ["1", "1st week of month"],
      ["2", "2nd week of month"],
      ["3", "3rd week of month"],
      ["4", "4th week of month"],
      ["5", "5th week of month"],
    ];
    const options = weeks
      .map(([val, label]) => `<option value="${val}"${String(value || "") === val ? " selected" : ""}>${label}</option>`)
      .join("");
    return field("Week of month", `<select ${attr}="${name}">${options}</select>`);
  }

  function modalSectionHead(title, { btnId = "", btnLabel = "" } = {}) {
    const btn = btnId
      ? `<button type="button" class="btn btn-primary admin-btn-sm" id="${btnId}" aria-expanded="false">${btnLabel}</button>`
      : "";
    return `
      <div class="admin-modal-day-section-head">
        <h3 class="admin-modal-day-section-title">${title}</h3>
        ${btn}
      </div>`;
  }

  function slugEventId(title) {
    const base = String(title || "event")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `${base || "event"}-${Date.now().toString(36)}`;
  }

  function addEventPanelHtml(dateStr) {
    const dow = dayOfWeekFromDate(dateStr);
    return `
      <div id="modal-add-event-panel" class="admin-modal-add-panel" hidden>
        <div class="admin-modal-add-panel-inner">
          <div class="admin-field admin-field--centered">
            <label>Event type</label>
            <div class="admin-event-type-toggle" role="radiogroup" aria-label="Event type">
              <label class="admin-event-type-option">
                <input type="radio" name="add-event-type" value="one-off" checked />
                <span>One-off on this date</span>
              </label>
              <label class="admin-event-type-option">
                <input type="radio" name="add-event-type" value="weekly" />
                <span>Weekly recurring</span>
              </label>
            </div>
          </div>
          <div id="modal-add-one-off-fields">
            <div class="admin-form-grid cols-2">
              ${field("Event name", `<input data-add-oneoff-field="title" placeholder="e.g. Josh Plummer" />`)}
              ${eventCategoryField("category", "live-music", "data-add-oneoff-field")}
              ${field("Start time", `<input type="time" data-add-oneoff-field="startTime" value="18:30" />`)}
              ${field("End time", `<input type="time" data-add-oneoff-field="endTime" value="21:30" />`)}
              ${field("Note (optional)", `<input data-add-oneoff-field="note" placeholder="e.g. Friday bandingo" />`)}
            </div>
          </div>
          <div id="modal-add-weekly-fields" hidden>
            <div class="admin-form-grid cols-2">
              ${field("Event name", `<input data-add-weekly-field="title" placeholder="e.g. Martini Monday" />`)}
              ${eventCategoryField("category", "community", "data-add-weekly-field")}
              ${daysOfWeekField([dow], "data-add-weekly-field")}
              ${field("Summary", `<textarea data-add-weekly-field="summary" rows="2" placeholder="Short description for the calendar"></textarea>`)}
              ${field("Start time", `<input type="time" data-add-weekly-field="startTime" value="18:00" />`)}
              ${field("End time (optional)", `<input type="time" data-add-weekly-field="endTime" value="" />`)}
              ${weekOfMonthField("weekOfMonth", "", "data-add-weekly-field")}
            </div>
            <p class="admin-modal-add-hint">Check the days this repeats (e.g. Mon for every Monday). Use week of month only for events like “3rd Monday book club.”</p>
          </div>
          <button type="button" class="btn btn-primary admin-btn-sm" id="modal-add-event-submit">Add to calendar</button>
        </div>
      </div>`;
  }

  function getCatalog(imagesData) {
    if (Array.isArray(imagesData)) return imagesData;
    return imagesData?.catalog || [];
  }

  function imagePicker(name, value, imagesData, tags) {
    const imgs = getCatalog(imagesData).filter(
      (img) => !tags?.length || tags.some((t) => img.tags?.includes(t))
    );
    return `
      <div class="admin-img-picker" data-picker="${esc(name)}">
        ${imgs
          .map(
            (img) => `
          <button type="button" class="admin-img-option${img.path === value ? " is-selected" : ""}"
            data-path="${esc(img.path)}" title="${esc(img.label)}">
            <img src="${esc(img.path)}" alt="" loading="lazy" />
          </button>`
          )
          .join("")}
      </div>
      <input type="hidden" data-field="${esc(name)}" value="${esc(value || "")}" />`;
  }

  function bindImagePickers(root, onChange) {
    root.querySelectorAll("[data-picker]").forEach((picker) => {
      const hidden = picker.parentElement.querySelector('input[type="hidden"]');
      picker.querySelectorAll(".admin-img-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          picker.querySelectorAll(".admin-img-option").forEach((b) => b.classList.remove("is-selected"));
          btn.classList.add("is-selected");
          if (hidden) hidden.value = btn.dataset.path;
          onChange?.(picker);
        });
      });
    });
  }

  const PROMO_PLACEMENTS = {
    homepage: {
      key: "homepageFeatured",
      label: "Homepage",
      hint: "Shows in the “Weekly & monthly happenings” row on the homepage (index.html).",
      previewPage: "index.html",
    },
    events: {
      key: "eventsPageFeatured",
      label: "Events page",
      hint: "Shows in the “Recurring favorites” grid on the events calendar page.",
      previewPage: "events.html",
    },
  };

  function readPromoRow(row) {
    return {
      title: rowVal(row, "title"),
      summary: rowVal(row, "summary"),
      tag: rowVal(row, "tag"),
      tagClass: rowVal(row, "tagClass"),
      layout: rowVal(row, "layout") || "standard",
      image: rowVal(row, "image"),
      mediaType: rowVal(row, "mediaType"),
      alt: rowVal(row, "alt") || rowVal(row, "title"),
    };
  }

  function val(root, name) {
    const el = root.querySelector(`[data-field="${name}"]`);
    return el ? el.value.trim() : "";
  }

  function rowVal(row, name) {
    const el = row.querySelector(`[data-field="${name}"]`);
    return el ? el.value.trim() : "";
  }

  function ensureAdminModalRoot() {
    let root = document.getElementById("admin-modal-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "admin-modal-root";
      document.body.appendChild(root);
    }
    return root;
  }

  function closeAdminModal() {
    const root = document.getElementById("admin-modal-root");
    if (root) root.replaceChildren();
    document.body.classList.remove("admin-modal-open");
  }

  function openAdminModal({ title, subtitle = "", bodyHtml = "", footerHtml = "", wide = false, onMount, onClose }) {
    closeAdminModal();
    const root = ensureAdminModalRoot();
    root.innerHTML = `
      <div class="admin-modal-backdrop" data-admin-modal-backdrop>
        <div class="admin-modal${wide ? " admin-modal--wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
          <div class="admin-modal__header">
            <div>
              <h3 id="admin-modal-title">${title}</h3>
              ${subtitle ? `<p class="admin-modal__subtitle">${subtitle}</p>` : ""}
            </div>
            <button type="button" class="admin-modal__close" data-admin-modal-close aria-label="Close">&times;</button>
          </div>
          <div class="admin-modal__body">${bodyHtml}</div>
          ${footerHtml ? `<div class="admin-modal__footer">${footerHtml}</div>` : ""}
        </div>
      </div>`;
    document.body.classList.add("admin-modal-open");
    const backdrop = root.querySelector("[data-admin-modal-backdrop]");
    const dialog = root.querySelector(".admin-modal");
    const close = () => {
      onClose?.();
      closeAdminModal();
    };
    backdrop?.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });
    root.querySelectorAll("[data-admin-modal-close]").forEach((btn) => {
      btn.addEventListener("click", close);
    });
    dialog?.addEventListener("click", (e) => e.stopPropagation());
    onMount?.(root);
    return root;
  }

  function formatAdminDate(dateStr) {
    if (!dateStr) return "Selected date";
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function numVal(root, name, fallback) {
    const n = parseFloat(val(root, name));
    return Number.isFinite(n) ? n : fallback;
  }

  function rowNum(row, name, fallback) {
    const n = parseFloat(rowVal(row, name));
    return Number.isFinite(n) ? n : fallback;
  }

  /* ——— Social Media ——— */
  function renderSocial(panel, config, site) {
    if (window.WSSocial) {
      WSSocial.renderAdmin(panel, config, site);
      return;
    }
    panel.innerHTML =
      '<p class="admin-note" style="border-color:var(--rust)">Social manager script failed to load. Hard refresh (Ctrl+Shift+R).</p>';
  }

  function collectSocial(panel, base) {
    return base;
  }

  /* ——— Events ——— */
  function renderEvents(panel, data, images) {
    let eventsData = JSON.parse(JSON.stringify(data || { performances: [], recurring: [] }));
    eventsData.performances = eventsData.performances || [];
    eventsData.recurring = eventsData.recurring || [];
    let previewTimer = null;
    let nextPerfId = 1;

    eventsData.performances.forEach((p) => {
      if (!p.__adminId) p.__adminId = `perf-${nextPerfId++}`;
    });

    function cleanPerformance(p) {
      const item = {
        date: p.date || "",
        title: p.title || "",
        startTime: p.startTime || "18:30",
        endTime: p.endTime || "21:30",
        category: p.category || "live-music",
      };
      if (p.note) item.note = p.note;
      return item;
    }

    function syncRecurringFromPanel() {
      const recurring = [];
      panel.querySelectorAll("[data-recurring]").forEach((row) => {
        const i = row.dataset.recurring;
        const orig = eventsData.recurring?.[Number(i)] || {};
        recurring.push({
          ...orig,
          title: rowVal(row, "title") || orig.title,
          summary: rowVal(row, "summary") || orig.summary,
        });
      });
      if (recurring.length) eventsData.recurring = recurring;
    }

    function sortedPerformances() {
      return [...eventsData.performances].sort((a, b) => {
        return (a.date || "").localeCompare(b.date || "") || (a.startTime || "").localeCompare(b.startTime || "");
      });
    }

    function performanceById(id) {
      return eventsData.performances.find((p) => p.__adminId === id);
    }

    function collectFromPanel() {
      syncRecurringFromPanel();
      const out = { ...eventsData, performances: [], recurring: eventsData.recurring || [] };
      out.performances = sortedPerformances()
        .map(cleanPerformance)
        .filter((p) => p.date && p.title);
      out.performances.sort((a, b) => a.date.localeCompare(b.date));
      return out;
    }

    function refreshEventsPreview() {
      const iframe = panel.querySelector("#events-page-iframe");
      if (!iframe) return;
      iframe.src = `events.html?preview=1&_=${Date.now()}#events-calendar-section`;
    }

    function pushEventsDraft(reloadFrame) {
      if (window.WSConfig) WSConfig.savePreview("events", collectFromPanel());
      if (reloadFrame) refreshEventsPreview();
    }

    function scheduleEventsPreview() {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => pushEventsDraft(true), 300);
    }

    function highlightPreviewDate(date) {
      const iframe = panel.querySelector("#events-page-iframe");
      iframe?.contentWindow?.postMessage(
        { source: "ws-admin-preview", type: "highlight-date", date: date || "" },
        window.location.origin
      );
    }

    let editingDate = "";

    function performancesForDate(date) {
      return sortedPerformances().filter((p) => p.date === date);
    }

    function recurringForDate(dateStr) {
      const [y, m, d] = dateStr.split("-").map(Number);
      if (!y || !m || !d) return [];
      const cur = new Date(y, m - 1, d);
      const dow = cur.getDay();
      return (eventsData.recurring || [])
        .map((ev, index) => ({ ev, index }))
        .filter(({ ev }) => {
          if (!Array.isArray(ev.dayOfWeek) || !ev.dayOfWeek.includes(dow)) return false;
          if (ev.weekOfMonth) {
            const week = Math.ceil(cur.getDate() / 7);
            if (week !== ev.weekOfMonth) return false;
          }
          return true;
        });
    }

    function recurringEditorFieldsHtml(ev) {
      return `
        <div class="admin-form-grid cols-2">
          ${field("Event name", `<input data-recurring-field="title" value="${esc(ev.title || "")}" />`)}
          ${eventCategoryField("category", ev.category || "community", "data-recurring-field")}
          ${daysOfWeekField(ev.dayOfWeek || [], "data-recurring-field")}
          ${field("Summary", `<textarea data-recurring-field="summary" rows="2">${esc(ev.summary || "")}</textarea>`)}
          ${field("Start time", `<input type="time" data-recurring-field="startTime" value="${esc(ev.startTime || "")}" />`)}
          ${field("End time (optional)", `<input type="time" data-recurring-field="endTime" value="${esc(ev.endTime || "")}" />`)}
          ${weekOfMonthField("weekOfMonth", ev.weekOfMonth || "", "data-recurring-field")}
        </div>`;
    }

    function bindRecurringEditor(root, index, { onRemove } = {}) {
      const ev = eventsData.recurring?.[index];
      if (!ev) return;
      root.querySelectorAll('[data-recurring-field="day"]').forEach((cb) => {
        cb.addEventListener("change", () => {
          const days = readCheckedDays(root, '[data-recurring-field="day"]');
          if (!days.length) {
            cb.checked = true;
            alert("Select at least one day of the week.");
            return;
          }
          ev.dayOfWeek = days;
          scheduleEventsPreview();
          panel._markUnsaved?.();
        });
      });
      root.querySelectorAll("[data-recurring-field]").forEach((input) => {
        if (input.dataset.recurringField === "day") return;
        const update = () => {
          const key = input.dataset.recurringField;
          if (key === "weekOfMonth") {
            const raw = input.value.trim();
            if (raw) ev.weekOfMonth = Number(raw);
            else delete ev.weekOfMonth;
          } else {
            ev[key] = input.value.trim();
          }
          scheduleEventsPreview();
          panel._markUnsaved?.();
        };
        input.addEventListener("input", update);
        input.addEventListener("change", update);
      });
      root.querySelector("[data-remove-recurring]")?.addEventListener("click", onRemove);
    }

    function perfEditorFieldsHtml(perf, { showDate = false } = {}) {
      return `
        <div class="admin-form-grid cols-2">
          ${showDate ? field("Date", `<input type="date" data-field="date" data-focus-field="date" value="${esc(perf.date)}" />`) : ""}
          ${field("Event name", `<input data-field="title" data-focus-field="title" value="${esc(perf.title)}" placeholder="e.g. Josh Plummer" />`)}
          ${eventCategoryField("category", perf.category || "live-music", "data-focus-field")}
          ${field("Start time", `<input type="time" data-field="startTime" data-focus-field="startTime" value="${esc(perf.startTime || "18:30")}" />`)}
          ${field("End time", `<input type="time" data-field="endTime" data-focus-field="endTime" value="${esc(perf.endTime || "21:30")}" />`)}
          ${field("Note (optional)", `<input data-field="note" data-focus-field="note" value="${esc(perf.note || "")}" placeholder="e.g. Friday bandingo" />`)}
        </div>`;
    }

    function bindPerfEditor(root, perf, { onChange, onRemove, onDuplicate } = {}) {
      root.querySelectorAll("[data-focus-field]").forEach((input) => {
        const update = () => {
          perf[input.dataset.focusField] = input.value.trim();
          onChange?.();
          scheduleEventsPreview();
          panel._markUnsaved?.();
        };
        input.addEventListener("input", update);
        input.addEventListener("change", update);
      });
      root.querySelector("[data-duplicate-perf]")?.addEventListener("click", onDuplicate);
      root.querySelector("[data-remove-perf]")?.addEventListener("click", onRemove);
    }

    function bindAddEventPanel(root, { expandAdd = false, addType = "one-off" } = {}) {
      const toggleBtn = root.querySelector("#modal-toggle-add-event");
      const addPanel = root.querySelector("#modal-add-event-panel");
      const oneOffFields = root.querySelector("#modal-add-one-off-fields");
      const weeklyFields = root.querySelector("#modal-add-weekly-fields");
      const typeRadios = root.querySelectorAll('input[name="add-event-type"]');

      function setAddPanelOpen(open) {
        if (!addPanel || !toggleBtn) return;
        addPanel.hidden = !open;
        toggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
        toggleBtn.textContent = open ? "Cancel" : "+ Add event";
      }

      function syncAddType(type) {
        if (oneOffFields) oneOffFields.hidden = type !== "one-off";
        if (weeklyFields) weeklyFields.hidden = type !== "weekly";
      }

      toggleBtn?.addEventListener("click", () => {
        const open = toggleBtn.getAttribute("aria-expanded") !== "true";
        setAddPanelOpen(open);
        if (open) {
          const type = root.querySelector('input[name="add-event-type"]:checked')?.value || "one-off";
          root.querySelector(`[data-add-${type === "weekly" ? "weekly" : "oneoff"}-field="title"]`)?.focus();
        }
      });

      typeRadios.forEach((radio) => {
        radio.addEventListener("change", () => syncAddType(radio.value));
      });

      if (expandAdd) {
        const typeRadio = root.querySelector(`input[name="add-event-type"][value="${addType}"]`);
        if (typeRadio) {
          typeRadio.checked = true;
          syncAddType(addType);
        }
        setAddPanelOpen(true);
      } else {
        syncAddType("one-off");
      }

      root.querySelector("#modal-add-event-submit")?.addEventListener("click", () => {
        const type = root.querySelector('input[name="add-event-type"]:checked')?.value || "one-off";
        if (type === "one-off") {
          const title = root.querySelector('[data-add-oneoff-field="title"]')?.value.trim() || "";
          const category = root.querySelector('[data-add-oneoff-field="category"]')?.value || "live-music";
          const startTime = root.querySelector('[data-add-oneoff-field="startTime"]')?.value.trim() || "18:30";
          const endTime = root.querySelector('[data-add-oneoff-field="endTime"]')?.value.trim() || "21:30";
          const note = root.querySelector('[data-add-oneoff-field="note"]')?.value.trim() || "";
          if (!title) {
            alert("Add an event name.");
            return;
          }
          const newPerf = {
            __adminId: `perf-${nextPerfId++}`,
            date: editingDate,
            title,
            category,
            startTime,
            endTime,
            note,
          };
          eventsData.performances.push(newPerf);
          scheduleEventsPreview();
          panel._markUnsaved?.();
          openEventsDayModal(editingDate, { focusId: newPerf.__adminId });
          return;
        }

        const title = root.querySelector('[data-add-weekly-field="title"]')?.value.trim() || "";
        const category = root.querySelector('[data-add-weekly-field="category"]')?.value || "community";
        const summary = root.querySelector('[data-add-weekly-field="summary"]')?.value.trim() || "";
        const startTime = root.querySelector('[data-add-weekly-field="startTime"]')?.value.trim() || "18:00";
        const endTime = root.querySelector('[data-add-weekly-field="endTime"]')?.value.trim() || "";
        const weekRaw = root.querySelector('[data-add-weekly-field="weekOfMonth"]')?.value.trim() || "";
        const days = readCheckedDays(root, '#modal-add-weekly-fields [data-add-weekly-field="day"]');
        if (!title) {
          alert("Add an event name.");
          return;
        }
        if (!days.length) {
          alert("Select at least one day of the week.");
          return;
        }
        const newRecurring = {
          id: slugEventId(title),
          title,
          category,
          summary,
          dayOfWeek: days,
          startTime,
          image: "assets/live-music.webp",
        };
        if (endTime) newRecurring.endTime = endTime;
        if (weekRaw) newRecurring.weekOfMonth = Number(weekRaw);
        eventsData.recurring.push(newRecurring);
        scheduleEventsPreview();
        panel._markUnsaved?.();
        openEventsDayModal(editingDate, {
          recurringPayload: { id: newRecurring.id, title: newRecurring.title, recurring: true },
        });
      });
    }

    function openEventsDayModal(date, { focusId = null, recurringPayload = null, expandAdd = false, addType = "one-off" } = {}) {
      editingDate = date || "";
      highlightPreviewDate(editingDate);

      const dayRecurring = recurringForDate(editingDate);
      const dayPerfs = performancesForDate(editingDate);
      const hasAnyEvents = dayRecurring.length > 0 || dayPerfs.length > 0;

      const recurringListHtml = dayRecurring.length
        ? dayRecurring
            .map(({ ev, index }) => {
              const isFocus =
                recurringPayload &&
                (recurringPayload.id === ev.id ||
                  (recurringPayload.title === ev.title && recurringPayload.recurring));
              return `
                <div class="admin-modal-day-event admin-modal-day-event--recurring${isFocus ? " is-focus" : ""}" data-modal-recurring="${index}">
                  <div class="admin-modal-day-event-head">
                    <div class="admin-modal-day-event-title-wrap">
                      <strong>${esc(ev.title || "Weekly event")}</strong>
                      <span class="admin-modal-recurring-badge">${esc(formatDaysOfWeek(ev.dayOfWeek))}${ev.weekOfMonth ? ` · ${ev.weekOfMonth}${ev.weekOfMonth === 1 ? "st" : ev.weekOfMonth === 2 ? "nd" : ev.weekOfMonth === 3 ? "rd" : "th"} week` : ""}</span>
                    </div>
                    <button type="button" class="btn btn-outline admin-btn-sm" data-remove-recurring>Remove</button>
                  </div>
                  ${recurringEditorFieldsHtml(ev)}
                </div>`;
            })
            .join("")
        : `<p class="admin-events-empty admin-events-empty--subtle">No weekly events on this day.</p>`;

      const recurringHtml = `<div class="admin-modal-day-section">
            ${modalSectionHead("Weekly events on this day", { btnId: "modal-toggle-add-event", btnLabel: "+ Add event" })}
            ${addEventPanelHtml(editingDate)}
            <div class="admin-modal-day-events">${recurringListHtml}</div>
          </div>`;

      const perfHtml = dayPerfs.length
        ? dayPerfs
            .map((perf) => {
              const isFocus = focusId === perf.__adminId || (!focusId && !dayRecurring.length && dayPerfs.length === 1);
              return `
                <div class="admin-modal-day-event${isFocus ? " is-focus" : ""}" data-modal-perf="${esc(perf.__adminId)}">
                  <div class="admin-modal-day-event-head">
                    <strong>${esc(perf.title || "New act")}</strong>
                    <div class="admin-events-summary-actions">
                      <button type="button" class="btn btn-outline admin-btn-sm" data-duplicate-perf>Duplicate</button>
                      <button type="button" class="btn btn-outline admin-btn-sm" data-remove-perf>Remove</button>
                    </div>
                  </div>
                  ${perfEditorFieldsHtml(perf)}
                </div>`;
            })
            .join("")
        : hasAnyEvents
          ? `<p class="admin-events-empty admin-events-empty--subtle">No one-off performances on this date.</p>`
          : `<p class="admin-events-empty">No events on this date yet. Use + Add event above.</p>`;

      const perfSectionHtml = `<div class="admin-modal-day-section">
            ${modalSectionHead("One-off performances")}
            <div class="admin-modal-day-events">${perfHtml}</div>
          </div>`;

      openAdminModal({
        title: formatAdminDate(editingDate),
        subtitle: "Green = today · Red highlight = date you are editing",
        wide: true,
        bodyHtml: `
          ${recurringHtml}
          ${perfSectionHtml}`,
        footerHtml: `<button type="button" class="btn btn-outline admin-btn-sm" data-admin-modal-close>Done</button>`,
        onClose: () => highlightPreviewDate(""),
        onMount: (root) => {
          bindAddEventPanel(root, { expandAdd, addType });

          root.querySelectorAll("[data-modal-recurring]").forEach((block) => {
            const index = Number(block.dataset.modalRecurring);
            bindRecurringEditor(block, index, {
              onRemove: () => {
                const ev = eventsData.recurring?.[index];
                const label = ev?.title || "this weekly event";
                if (
                  !window.confirm(
                    `Remove "${label}" from the weekly calendar? It will disappear from every matching day going forward.`
                  )
                ) {
                  return;
                }
                eventsData.recurring.splice(index, 1);
                scheduleEventsPreview();
                panel._markUnsaved?.();
                openEventsDayModal(editingDate);
              },
            });
          });

          root.querySelectorAll("[data-modal-perf]").forEach((block) => {
            const perf = performanceById(block.dataset.modalPerf);
            if (!perf) return;
            bindPerfEditor(block, perf, {
              onDuplicate: () => {
                const copy = {
                  ...perf,
                  __adminId: `perf-${nextPerfId++}`,
                  title: `${perf.title || "New act"} copy`,
                };
                eventsData.performances.push(copy);
                scheduleEventsPreview();
                panel._markUnsaved?.();
                openEventsDayModal(editingDate, { focusId: copy.__adminId });
              },
              onRemove: () => {
                removePerformance(perf.__adminId, { reopen: false });
                openEventsDayModal(editingDate);
              },
            });
          });
        },
      });
    }

    function openEventsBulkModal(initialTab = "performances") {
      openAdminModal({
        title: "Manage all events",
        subtitle: "Upcoming performances and weekly recurring nights",
        wide: true,
        bodyHtml: `
          <div class="admin-events-toolbar">
            <div class="admin-events-tabs" role="tablist" aria-label="Events editor views">
              <button type="button" class="admin-events-tab${initialTab === "performances" ? " is-active" : ""}" role="tab" data-events-tab="performances">Upcoming performances</button>
              <button type="button" class="admin-events-tab${initialTab === "recurring" ? " is-active" : ""}" role="tab" data-events-tab="recurring">Weekly recurring nights</button>
            </div>
          </div>
          <div class="admin-events-panel${initialTab === "performances" ? " is-active" : ""}" id="events-tab-performances"${initialTab === "performances" ? "" : " hidden"}>
            <div id="perf-rows"></div>
          </div>
          <div class="admin-events-panel${initialTab === "recurring" ? " is-active" : ""}" id="events-tab-recurring"${initialTab === "recurring" ? "" : " hidden"}>
            <p class="admin-events-panel-hint">These power the calendar every week. Edit titles and descriptions only if the promo changed.</p>
            <div id="recurring-rows">${(eventsData.recurring || []).map((r, i) => recurringRow(r, i)).join("")}</div>
          </div>`,
        footerHtml: `<button type="button" class="btn btn-primary admin-btn-sm" data-admin-modal-close>Done</button>`,
        onMount: (root) => {
          bindEventsTabs(root);
          bindEventsPreviewInputs(root, scheduleEventsPreview);
          renderPerformanceList(root);
          root.querySelectorAll("[data-edit-perf]").forEach((btn) => {
            btn.onclick = () => {
              const id = btn.closest("[data-perf]")?.dataset.perfId;
              const perf = performanceById(id);
              closeAdminModal();
              if (perf?.date) openEventsDayModal(perf.date, { focusId: id });
            };
          });
        },
      });
    }

    function renderPerformanceList(scope = panel) {
      const list = scope.querySelector("#perf-rows");
      if (!list) return;
      const perfs = sortedPerformances();
      list.innerHTML = perfs.length
        ? perfs.map((p) => perfSummaryRow(p, false)).join("")
        : `<p class="admin-events-empty">No dated performances yet. Click a calendar date to add one.</p>`;

      list.querySelectorAll("[data-edit-perf]").forEach((btn) => {
        btn.onclick = () => {
          const id = btn.closest("[data-perf]")?.dataset.perfId;
          const perf = performanceById(id);
          closeAdminModal();
          if (perf?.date) openEventsDayModal(perf.date, { focusId: id });
        };
      });
      list.querySelectorAll("[data-remove-perf]").forEach((btn) => {
        btn.onclick = () => removePerformance(btn.closest("[data-perf]")?.dataset.perfId);
      });
    }

    function addPerformance(date, seed = {}) {
      openEventsDayModal(date || new Date().toISOString().slice(0, 10), {
        expandAdd: true,
        addType: seed.recurring ? "weekly" : "one-off",
        recurringPayload: seed.recurring ? seed : null,
      });
    }

    function removePerformance(id, { reopen = true } = {}) {
      if (!id) return;
      eventsData.performances = eventsData.performances.filter((p) => p.__adminId !== id);
      scheduleEventsPreview();
      panel._markUnsaved?.();
      if (reopen && editingDate) openEventsDayModal(editingDate);
    }

    function findPerformanceFromPreview(payload) {
      return eventsData.performances.find(
        (p) =>
          p.date === payload.date &&
          p.title === payload.title &&
          (!payload.startTime || p.startTime === payload.startTime)
      );
    }

    function handlePreviewMessage(event) {
      if (!panel.isConnected) {
        window.removeEventListener("message", handlePreviewMessage);
        return;
      }
      if (event.origin !== window.location.origin || event.data?.source !== "ws-events-preview") return;
      const payload = event.data;
      if (payload.type === "day") {
        openEventsDayModal(payload.date);
        return;
      }
      if (payload.type === "event") {
        if (payload.recurring) {
          openEventsDayModal(payload.date, { recurringPayload: payload });
          return;
        }
        const perf = findPerformanceFromPreview(payload);
        if (perf) openEventsDayModal(payload.date, { focusId: perf.__adminId });
        else
          openEventsDayModal(payload.date, {
            focusId: null,
          });
      }
    }

    panel.innerHTML = `
      <p class="admin-note">This is a <strong>draft preview</strong>. Click any calendar date to add or edit everything on that day — weekly events and one-off performances (highlighted in red). Today stays green. <em>Save changes</em> keeps the draft on this device; public files stay unchanged until export/publish.</p>
      <div class="admin-draft-full">
        <div class="admin-draft-full__toolbar">
          <div>
            <p class="admin-preview-label">Draft preview — events calendar</p>
            <p>Click a date or event chip in the calendar below. Edits open in a popup.</p>
          </div>
          <div class="admin-draft-full__toolbar-actions">
            <button type="button" class="btn btn-outline admin-btn-sm" id="events-manage-all">Manage all events</button>
            <button type="button" class="btn btn-primary admin-btn-sm" id="add-perf">+ Add performance</button>
          </div>
        </div>
        <iframe id="events-page-iframe" class="admin-preview-frame admin-events-preview-frame" title="Draft events calendar preview" src="events.html?preview=1#events-calendar-section"></iframe>
      </div>`;

    panel.querySelector("#add-perf")?.addEventListener("click", () =>
      openEventsDayModal(new Date().toISOString().slice(0, 10), { expandAdd: true, addType: "one-off" })
    );
    panel.querySelector("#events-manage-all")?.addEventListener("click", () => openEventsBulkModal("performances"));
    panel._getEvents = collectFromPanel;
    panel._refreshPagePreview = refreshEventsPreview;
    window.addEventListener("message", handlePreviewMessage);
    pushEventsDraft(true);
  }

  function bindEventsTabs(panel) {
    const tabs = panel.querySelectorAll("[data-events-tab]");
    const panels = {
      performances: panel.querySelector("#events-tab-performances"),
      recurring: panel.querySelector("#events-tab-recurring"),
    };
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.dataset.eventsTab;
        tabs.forEach((t) => {
          const active = t === tab;
          t.classList.toggle("is-active", active);
          t.setAttribute("aria-selected", active ? "true" : "false");
          t.tabIndex = active ? 0 : -1;
        });
        Object.entries(panels).forEach(([key, el]) => {
          if (!el) return;
          const active = key === id;
          el.classList.toggle("is-active", active);
          el.hidden = !active;
        });
      });
    });
  }

  function bindEventsPreviewInputs(panel, onChange) {
    ["#perf-rows", "#recurring-rows"].forEach((sel) => {
      const wrap = panel.querySelector(sel);
      if (!wrap || wrap.dataset.previewBound) return;
      wrap.dataset.previewBound = "1";
      wrap.addEventListener("input", (e) => {
        if (e.target.matches("[data-field]")) onChange();
      });
      wrap.addEventListener("change", (e) => {
        if (e.target.matches("[data-field]")) onChange();
      });
    });
  }

  function formatPerfSummary(p) {
    const date = p.date || "No date";
    const time = p.startTime ? `${p.startTime}${p.endTime ? `-${p.endTime}` : ""}` : "No time";
    return `${date} / ${time}`;
  }

  function perfSummaryRow(p, selected) {
    return `
      <div class="admin-list-item admin-events-summary-row${selected ? " is-selected" : ""}" data-perf data-perf-id="${esc(p.__adminId || "")}">
        <div class="admin-list-item-head">
          <strong>${esc(p.title || "New act")}</strong>
          <div class="admin-events-summary-actions">
            <button type="button" class="btn btn-outline admin-btn-sm" data-edit-perf>Edit</button>
            <button type="button" class="btn btn-outline admin-btn-sm" data-remove-perf>Remove</button>
          </div>
        </div>
        <p class="admin-events-summary-meta">${esc(formatPerfSummary(p))}${p.note ? ` / ${esc(p.note)}` : ""}</p>
      </div>`;
  }

  function recurringRow(r, i) {
    const days = (r.dayOfWeek || []).map((d) => DAYS[d]).join(", ");
    return `
      <div class="admin-list-item" data-recurring="${i}">
        <div class="admin-list-item-head"><strong>${esc(r.title)}</strong><span style="color:var(--text-muted);font-size:0.85rem">${esc(days)}</span></div>
        <div class="admin-form-grid">
          ${field("Title", `<input data-field="title" value="${esc(r.title)}" />`)}
          ${field("Summary", `<textarea data-field="summary" rows="2">${esc(r.summary)}</textarea>`)}
        </div>
      </div>`;
  }

  function collectEvents(panel, base) {
    if (panel._getEvents) return panel._getEvents();
    const out = { ...base, performances: [], recurring: [] };
    panel.querySelectorAll("[data-perf]").forEach((row) => {
      const title = rowVal(row, "title");
      const date = rowVal(row, "date");
      if (!title || !date) return;
      const item = {
        date,
        title,
        startTime: rowVal(row, "startTime") || "18:30",
        endTime: rowVal(row, "endTime") || "21:30",
        category: "live-music",
      };
      const note = rowVal(row, "note");
      if (note) item.note = note;
      out.performances.push(item);
    });
    panel.querySelectorAll("[data-recurring]").forEach((row) => {
      const i = row.dataset.recurring;
      const orig = base.recurring?.[Number(i)] || {};
      out.recurring.push({
        ...orig,
        title: rowVal(row, "title") || orig.title,
        summary: rowVal(row, "summary") || orig.summary,
      });
    });
    out.performances.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  }

  /* ——— Menus ——— */
  function renderMenus(panel, data) {
    panel.dataset.menuEditorReady = "";
    let menusData = JSON.parse(JSON.stringify(data));
    let menus = menusData.menus || [];
    let previewTimer = null;
    const menuOptions = menus
      .map((m, i) => `<option value="${i}">${esc(m.label)}</option>`)
      .join("");

    function getSelection() {
      const menuIdx = Number(panel.querySelector("#menu-select")?.value || 0);
      const catIdx = Number(panel.querySelector("#cat-select")?.value || 0);
      const menu = menus[menuIdx] || menus[0];
      const cat = menu?.categories?.[catIdx];
      return { menu, cat, menuIdx, catIdx };
    }

    function markSyncedSection() {
      panel.dataset.syncedMenuIdx = menuSelect.value;
      panel.dataset.syncedCatIdx = catSelect.value;
    }

    function syncCurrentEditorSection() {
      if (!panel.dataset.menuEditorReady) return;
      const menuIdx = Number(panel.dataset.syncedMenuIdx ?? menuSelect.value ?? 0);
      const catIdx = Number(panel.dataset.syncedCatIdx ?? catSelect.value ?? 0);
      const modalRoot = document.getElementById("admin-modal-root");
      const scope = modalRoot?.querySelector("#menu-items") ? modalRoot : panel;
      if (!scope.querySelector("#menu-items")) return;
      menusData = syncMenuSection(scope, menusData, menuIdx, catIdx);
      menus = menusData.menus;
    }

    function renderMenuDraftPreview() {
      if (!panel.dataset.menuEditorReady) return;
      syncCurrentEditorSection();
      const mount = panel.querySelector("#menu-draft-preview");
      const { menu, cat } = getSelection();
      if (!mount || !window.WSMenuRender || !menu) return;
      mount.innerHTML = WSMenuRender.renderApp(menusData, menu.id, cat?.id || "");
      const section = cat ? mount.querySelector(`#${menu.id}-${cat.id}`) : null;
      if (section) section.scrollIntoView({ block: "start", behavior: "auto" });
    }

    function scheduleMenuPreview() {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(renderMenuDraftPreview, 200);
    }

    function openMenuSectionModal(focusItemIndex = null) {
      syncCurrentEditorSection();
      const { menu, cat, menuIdx, catIdx } = getSelection();
      if (!cat) return;

      openAdminModal({
        title: `${menu?.label || "Menu"} — ${cat.name}`,
        subtitle: "Edit items in this section. The draft preview updates as you type.",
        wide: true,
        bodyHtml: `<div id="menu-items"></div>`,
        footerHtml: `
          <button type="button" class="btn btn-outline admin-btn-sm" id="modal-add-menu-item">+ Add item</button>
          <button type="button" class="btn btn-primary admin-btn-sm" data-admin-modal-close>Done</button>`,
        onMount: (root) => {
          const container = root.querySelector("#menu-items");
          container.innerHTML = (cat.items || []).map((item) => menuItemRow(item)).join("");
          bindRemove(root);
          root.querySelectorAll("[data-remove-item]").forEach((btn) => {
            btn.onclick = () => {
              btn.closest("[data-menu-item]")?.remove();
              renderMenuDraftPreview();
              panel._markUnsaved?.();
            };
          });
          if (focusItemIndex != null) {
            const row = container.querySelectorAll("[data-menu-item]")[focusItemIndex];
            row?.scrollIntoView({ block: "nearest" });
            row?.classList.add("is-focus");
          }
          bindMenuPreviewInputs(root, scheduleMenuPreview);
          root.querySelector("#modal-add-menu-item")?.addEventListener("click", () => {
            container.insertAdjacentHTML("beforeend", menuItemRow({ name: "", desc: "", price: "" }));
            bindRemove(root);
            root.querySelectorAll("[data-remove-item]").forEach((btn) => {
              btn.onclick = () => {
                btn.closest("[data-menu-item]")?.remove();
                renderMenuDraftPreview();
                panel._markUnsaved?.();
              };
            });
            renderMenuDraftPreview();
          });
          panel.dataset.syncedMenuIdx = String(menuIdx);
          panel.dataset.syncedCatIdx = String(catIdx);
        },
        onClose: () => {
          const modalRoot = document.getElementById("admin-modal-root");
          const modalItems = modalRoot?.querySelector("#menu-items");
          if (modalItems) {
            const { menuIdx, catIdx } = getSelection();
            const cat = menus[menuIdx]?.categories?.[catIdx];
            if (cat) {
              const items = [];
              modalItems.querySelectorAll("[data-menu-item]").forEach((row) => {
                const name = rowVal(row, "name");
                if (!name) return;
                const item = { name };
                const desc = rowVal(row, "desc");
                const price = rowVal(row, "price");
                if (desc) item.desc = desc;
                if (price) item.price = price;
                items.push(item);
              });
              cat.items = items;
              menusData.menus = menus;
            }
          }
          renderMenuDraftPreview();
        },
      });
    }

    panel.innerHTML = `
      <p class="admin-note">Update item names, descriptions, and prices. Click a menu item in the preview to edit it, or use Edit section. <em>Save changes</em> keeps the draft on this device; public files stay unchanged until export/publish.</p>
      <div class="admin-draft-full">
        <div class="admin-draft-full__toolbar">
          <div class="admin-form-grid cols-2" style="margin:0;flex:1;min-width:min(100%,520px)">
            ${field("Menu", `<select id="menu-select">${menuOptions}</select>`)}
            ${field("Section", `<select id="cat-select"></select>`)}
          </div>
          <div class="admin-draft-full__toolbar-actions">
            <button type="button" class="btn btn-outline admin-btn-sm" id="edit-menu-section">Edit section</button>
            <button type="button" class="btn btn-primary admin-btn-sm" id="add-menu-item">+ Add item</button>
          </div>
        </div>
        <div id="menu-draft-preview" class="admin-menu-draft-preview admin-preview-frame" aria-label="Menu draft preview"></div>
      </div>`;

    const menuSelect = panel.querySelector("#menu-select");
    const catSelect = panel.querySelector("#cat-select");

    function refreshCategories() {
      const menu = menus[Number(menuSelect.value)] || menus[0];
      catSelect.innerHTML = (menu?.categories || [])
        .map((c, i) => `<option value="${i}">${esc(c.name)}</option>`)
        .join("");
      renderItems();
      renderMenuDraftPreview();
    }

    function renderItems() {
      const menu = menus[Number(menuSelect.value)] || menus[0];
      const cat = menu?.categories?.[Number(catSelect.value)];
      if (!cat) return;
      panel.dataset.menuEditorReady = "1";
      markSyncedSection();
      renderMenuDraftPreview();
    }

    function switchMenu() {
      syncCurrentEditorSection();
      refreshCategories();
    }

    function switchCategory() {
      syncCurrentEditorSection();
      renderItems();
      renderMenuDraftPreview();
    }

    menuSelect.addEventListener("change", switchMenu);
    catSelect.addEventListener("change", switchCategory);
    panel.querySelector("#edit-menu-section")?.addEventListener("click", () => openMenuSectionModal());
    panel.querySelector("#add-menu-item")?.addEventListener("click", () => openMenuSectionModal());
    panel.querySelector("#menu-draft-preview")?.addEventListener("click", (e) => {
      const itemEl = e.target.closest(".menu-item");
      if (!itemEl) return;
      const { cat } = getSelection();
      const items = itemEl.parentElement?.querySelectorAll(".menu-item");
      const index = items ? [...items].indexOf(itemEl) : -1;
      if (index >= 0) openMenuSectionModal(index);
    });
    panel._getMenus = () => {
      syncCurrentEditorSection();
      return menusData;
    };
    panel._refreshPagePreview = renderMenuDraftPreview;

    bindMenuPreviewInputs(panel, scheduleMenuPreview);
    refreshCategories();
  }

  function bindMenuPreviewInputs(panel, onChange) {
    if (panel.dataset.menuPreviewBound) return;
    panel.dataset.menuPreviewBound = "1";
    panel.addEventListener("input", (e) => {
      if (e.target.closest("#menu-items") && e.target.matches("[data-field]")) onChange();
    });
    panel.addEventListener("change", (e) => {
      if (e.target.closest("#menu-items") && e.target.matches("[data-field]")) onChange();
    });
  }

  function menuItemRow(item) {
    return `
      <div class="admin-list-item" data-menu-item>
        <div class="admin-list-item-head">
          <strong>${esc(item.name || "New item")}</strong>
          <button type="button" class="btn btn-outline admin-btn-sm" data-remove-item>Remove</button>
        </div>
        <div class="admin-form-grid cols-2">
          ${field("Name", `<input data-field="name" value="${esc(item.name)}" />`)}
          ${field("Price", `<input data-field="price" value="${esc(item.price || "")}" placeholder="$9.90" />`)}
          ${field("Description", `<textarea data-field="desc" rows="2">${esc(item.desc || "")}</textarea>`)}
        </div>
      </div>`;
  }

  function syncMenuSection(scope, menus, menuIdx, catIdx) {
    const out = JSON.parse(JSON.stringify(menus));
    if (!scope?.querySelector("#menu-items")) return out;
    const mIdx = menuIdx ?? Number(scope.querySelector("#menu-select")?.value || 0);
    const cIdx = catIdx ?? Number(scope.querySelector("#cat-select")?.value || 0);
    const cat = out.menus?.[mIdx]?.categories?.[cIdx];
    if (!cat) return out;

    const items = [];
    scope.querySelectorAll("#menu-items [data-menu-item]").forEach((row) => {
      const name = rowVal(row, "name");
      if (!name) return;
      const item = { name };
      const desc = rowVal(row, "desc");
      const price = rowVal(row, "price");
      if (desc) item.desc = desc;
      if (price) item.price = price;
      items.push(item);
    });
    cat.items = items;
    return out;
  }

  function collectMenus(panel, base) {
    return syncMenuSection(panel, base);
  }

  /* ——— Reviews ——— */
  function renderReviews(panel, data) {
    const g = data.google || {};
    const featured = data.featured || [];
    panel.innerHTML = `
      <div class="admin-card">
        <h3>Google score (homepage)</h3>
        <div class="admin-form-grid cols-2">
          ${field("Rating", `<input type="number" step="0.1" min="1" max="5" data-field="google.rating" value="${esc(g.rating)}" />`)}
          ${field("Review count", `<input type="number" data-field="google.count" value="${esc(g.count)}" />`)}
        </div>
      </div>
      <div class="admin-card">
        <h3>Featured review carousel</h3>
        <div id="review-rows">${featured.map((r) => reviewRow(r)).join("")}</div>
        <button type="button" class="btn btn-outline" id="add-review" style="margin-top:0.75rem">+ Add review</button>
      </div>`;

    panel.querySelector("#add-review")?.addEventListener("click", () => {
      const rows = panel.querySelector("#review-rows");
      const i = rows.children.length;
      rows.insertAdjacentHTML("beforeend", reviewRow({ author: "", rating: 5, date: "Recently", text: "" }));
      bindRemove(panel);
    });
    bindRemove(panel);
  }

  function reviewRow(r) {
    return `
      <div class="admin-list-item" data-review>
        <div class="admin-list-item-head">
          <strong>${esc(r.author || "New review")}</strong>
          <button type="button" class="btn btn-outline admin-btn-sm" data-remove-review>Remove</button>
        </div>
        <div class="admin-form-grid cols-2">
          ${field("Author", `<input data-field="author" value="${esc(r.author)}" />`)}
          ${field("Stars (1–5)", `<input type="number" min="1" max="5" data-field="rating" value="${esc(r.rating)}" />`)}
          ${field("Date label", `<input data-field="date" value="${esc(r.date)}" placeholder="3 weeks ago" />`)}
          ${field("Meal / badge (optional)", `<input data-field="meal" value="${esc(r.meal || r.badge || "")}" />`)}
          ${field("Review text", `<textarea data-field="text" rows="3">${esc(r.text)}</textarea>`)}
        </div>
      </div>`;
  }

  function collectReviews(panel, base) {
    const out = { ...base, google: { ...base.google }, featured: [] };
    out.google.rating = numVal(panel, "google.rating", 4.4);
    out.google.count = Math.round(numVal(panel, "google.count", 2000));
    out.google.label = "Google";

    panel.querySelectorAll("[data-review]").forEach((row) => {
      const author = rowVal(row, "author");
      const text = rowVal(row, "text");
      if (!author || !text) return;
      const item = {
        author,
        rating: Math.min(5, Math.max(1, Math.round(rowNum(row, "rating", 5)))),
        date: rowVal(row, "date") || "Recently",
        text,
      };
      const meal = rowVal(row, "meal");
      if (meal.includes("Guide")) item.badge = meal;
      else if (meal) item.meal = meal;
      out.featured.push(item);
    });
    return out;
  }

  /* ——— Promos ——— */
  const PROMO_IMAGE_TAGS = ["events", "promo", "gallery", "food", "music"];

  function promoLayoutLabel(layout) {
    return layout === "highlight" ? "Highlight" : "Standard";
  }

  function emptyPromoCard(placement) {
    return {
      id: `new-${Date.now()}`,
      title: "",
      summary: "",
      tag: "",
      tagClass: "",
      layout: "standard",
      image: "assets/gallery/WSGoodTimes.webp",
      mediaType: "image",
      alt: "",
      placement,
    };
  }

  const PROMO_DRAG_HANDLE_SVG = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm12-12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/></svg>`;

  function promoSummaryRow(p, placement) {
    const pl = PROMO_PLACEMENTS[placement];
    const img = p.image || "assets/gallery/WSGoodTimes.webp";
    return `
      <div class="admin-list-item admin-promo-summary" data-promo-summary data-promo-placement="${placement}" data-promo-id="${esc(p.id || "")}">
        <div class="admin-promo-summary-layout">
          <button type="button" class="admin-promo-drag-handle" data-promo-drag-handle draggable="true" aria-label="Drag to reorder" title="Drag to reorder">${PROMO_DRAG_HANDLE_SVG}</button>
          <img class="admin-promo-summary-thumb" src="${esc(img)}" alt="" loading="lazy" />
          <div class="admin-promo-summary-body">
            <div class="admin-promo-summary-head">
              <strong>${esc(p.title || "Untitled card")}</strong>
              <span class="admin-placement-badge">${esc(pl.label)}</span>
            </div>
            <p class="admin-promo-summary-meta">${esc(p.tag || "No tag line")} · ${esc(promoLayoutLabel(p.layout))}${p.tagClass === "music" ? " · Live music tag" : ""}</p>
            <p class="admin-promo-summary-desc">${esc(p.summary || "")}</p>
          </div>
          <div class="admin-promo-summary-actions">
            <button type="button" class="btn btn-outline admin-btn-sm" data-edit-promo>Edit</button>
            <button type="button" class="btn btn-outline admin-btn-sm" data-remove-promo>Remove</button>
          </div>
        </div>
      </div>`;
  }

  function promoEditorFieldsHtml(p, imagesData) {
    return `
      <div class="admin-form-grid cols-2">
        ${field("Card style", `
          <select data-field="layout">
            <option value="standard"${p.layout !== "highlight" ? " selected" : ""}>Standard — photo on top</option>
            <option value="highlight"${p.layout === "highlight" ? " selected" : ""}>Highlight — live music accent</option>
          </select>`)}
        ${field("Tag style", `
          <select data-field="tagClass">
            <option value=""${!p.tagClass ? " selected" : ""}>Default tag</option>
            <option value="music"${p.tagClass === "music" ? " selected" : ""}>Live music (purple tag)</option>
          </select>`)}
        ${field("Title", `<input data-field="title" value="${esc(p.title)}" placeholder="Martini Monday" />`)}
        ${field("Tag line", `<input data-field="tag" value="${esc(p.tag)}" placeholder="Every Monday" />`)}
        ${field("Description", `<textarea data-field="summary" rows="3">${esc(p.summary)}</textarea>`)}
        ${field("Image alt text", `<input data-field="alt" value="${esc(p.alt || p.title)}" />`)}
        <div class="admin-field admin-field--full admin-field--promo-photo">
          <label>Photo</label>
          ${imagePicker("image", p.image || "", imagesData, PROMO_IMAGE_TAGS)}
          <input type="hidden" data-field="mediaType" value="${esc(p.mediaType || "image")}" />
        </div>
      </div>`;
  }

  function syncPromoOrderFromList(list, promosData, key) {
    const cards = promosData[key] || [];
    const byId = new Map(cards.map((c) => [c.id, c]));
    promosData[key] = [...list.querySelectorAll("[data-promo-summary]")]
      .map((row) => byId.get(row.dataset.promoId))
      .filter(Boolean);
  }

  function bindPromoDragReorder(list, promosData, key, onChange) {
    if (!list || list.dataset.promoDragBound) return;
    list.dataset.promoDragBound = "1";
    let dragId = null;

    list.addEventListener("dragstart", (e) => {
      const handle = e.target.closest("[data-promo-drag-handle]");
      if (!handle) {
        e.preventDefault();
        return;
      }
      const row = handle.closest("[data-promo-summary]");
      if (!row) return;
      dragId = row.dataset.promoId;
      row.classList.add("is-dragging");
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", dragId);
        e.dataTransfer.setDragImage(row, 40, 40);
      }
    });

    list.addEventListener("dragend", () => {
      const dragging = dragId
        ? list.querySelector(`[data-promo-summary][data-promo-id="${dragId}"]`)
        : null;
      dragging?.classList.remove("is-dragging");
      if (dragId) syncPromoOrderFromList(list, promosData, key);
      dragId = null;
      onChange(true);
    });

    list.addEventListener("dragover", (e) => {
      if (!dragId) return;
      e.preventDefault();
      const dragging = list.querySelector(`[data-promo-summary][data-promo-id="${dragId}"]`);
      if (!dragging) return;
      const row = e.target.closest("[data-promo-summary]");
      if (!row || row === dragging) return;
      const rect = row.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      if (after) row.after(dragging);
      else row.before(dragging);
    });

    list.addEventListener("drop", (e) => {
      e.preventDefault();
      if (dragId) syncPromoOrderFromList(list, promosData, key);
    });
  }

  function promoCardFromDraft(draft, orig, placement, id) {
    const image = draft.image || orig.image || "assets/gallery/WSGoodTimes.webp";
    return {
      ...orig,
      id:
        orig.id && !String(orig.id).startsWith("new-")
          ? orig.id
          : id || draft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || `promo-${Date.now()}`,
      placement,
      layout: draft.layout || "standard",
      title: draft.title,
      summary: draft.summary,
      tag: draft.tag,
      tagClass: draft.tagClass,
      image,
      mediaType:
        draft.mediaType ||
        orig.mediaType ||
        (window.WSConfig ? WSConfig.inferMediaType("", image) : "image"),
      alt: draft.alt || draft.title,
    };
  }

  function mountPromoEditorWorkflow(panel, promosData, placement, images, listId, editorId, addBtnId, onChange) {
    const key = PROMO_PLACEMENTS[placement].key;
    let editingId = null;

    function getCards() {
      promosData[key] = promosData[key] || [];
      return promosData[key];
    }

    function renderSummaries() {
      const list = panel.querySelector(`#${listId}`);
      if (!list) return;
      const cards = getCards();
      list.innerHTML = cards.length
        ? cards.map((p) => promoSummaryRow(p, placement)).join("")
        : `<p class="admin-promo-empty">No cards yet. Click “Add promo card” above.</p>`;
      list.querySelectorAll("[data-edit-promo]").forEach((btn) => {
        btn.onclick = () => openEditor(btn.closest("[data-promo-summary]")?.dataset.promoId);
      });
      list.querySelectorAll("[data-remove-promo]").forEach((btn) => {
        btn.onclick = () => {
          const id = btn.closest("[data-promo-summary]")?.dataset.promoId;
          if (!id) return;
          promosData[key] = getCards().filter((c) => c.id !== id);
          if (editingId === id) closeEditor();
          renderSummaries();
          onChange();
        };
      });
      bindPromoDragReorder(list, promosData, key, onChange);
    }

    function closeEditor() {
      editingId = null;
      closeAdminModal();
    }

    function openEditor(id) {
      const cards = getCards();
      const orig = id ? cards.find((c) => c.id === id) : emptyPromoCard(placement);
      if (id && !orig) return;
      editingId = id || orig.id;
      openAdminModal({
        title: id ? "Edit promo card" : "New promo card",
        subtitle: PROMO_PLACEMENTS[placement]?.label || "Promo card",
        wide: true,
        bodyHtml: `
          ${promoEditorFieldsHtml(orig, images)}
          <div class="admin-promo-editor-actions">
            <button type="button" class="btn btn-primary admin-btn-sm" data-promo-editor-save>Save card</button>
          </div>`,
        footerHtml: `<button type="button" class="btn btn-outline admin-btn-sm" data-promo-editor-cancel>Cancel</button>`,
        onMount: (root) => {
          bindImagePickers(root, onChange);
          root.querySelector("[data-promo-editor-cancel]")?.addEventListener("click", closeEditor);
          root.querySelector("[data-promo-editor-save]")?.addEventListener("click", () => saveEditor(root));
        },
      });
    }

    function saveEditor(formRoot) {
      if (!formRoot) formRoot = panel.querySelector(`#${editorId} .admin-promo-editor-panel`);
      if (!formRoot) return;
      const draft = readPromoRow(formRoot);
      if (!draft.title) {
        alert("Add a title before saving this promo card.");
        return;
      }
      const cards = getCards();
      const idx = editingId ? cards.findIndex((c) => c.id === editingId) : -1;
      const orig = idx >= 0 ? cards[idx] : emptyPromoCard(placement);
      const saved = promoCardFromDraft(draft, orig, placement, editingId || orig.id);
      if (idx >= 0) cards[idx] = saved;
      else cards.push(saved);
      closeEditor();
      renderSummaries();
      onChange();
    }

    panel.querySelector(`#${addBtnId}`)?.addEventListener("click", () => openEditor(null));
    renderSummaries();
    return { renderSummaries, closeEditor, openEditor };
  }

  function renderPromos(panel, data, images) {
    const activePlacement = "events";
    let promosData = JSON.parse(JSON.stringify(data || { homepageFeatured: [], eventsPageFeatured: [] }));
    let previewTimer = null;

    function pushDraftToBrowser(reloadFrame) {
      if (window.WSConfig) WSConfig.savePreview("promos", promosData);
      if (reloadFrame) refreshPagePreview(true);
    }

    function scheduleDraftPreview(immediate) {
      clearTimeout(previewTimer);
      if (immediate) {
        pushDraftToBrowser(true);
        return;
      }
      previewTimer = setTimeout(() => pushDraftToBrowser(true), 300);
    }

    function notifyPromoPreviewFrame(iframe) {
      if (!iframe?.contentWindow) return false;
      try {
        iframe.contentWindow.postMessage({ type: "ws-promo-preview-refresh" }, window.location.origin);
        return true;
      } catch {
        return false;
      }
    }

    function refreshPagePreview(reload) {
      const iframe = panel.querySelector("#promo-page-iframe");
      if (!iframe || !reload) return;
      notifyPromoPreviewFrame(iframe);
      iframe.src = `events.html?promoPreview=1#promo-recurring&_=${Date.now()}`;
    }

    panel.innerHTML = `
      <p class="admin-note"><strong>Featured promo cards</strong> on the events page — photo tiles for weekly/monthly happenings. Click <em>Manage promo cards</em> to add or edit. <em>Save changes</em> when done.</p>
      <p style="color:var(--text-muted);font-size:0.9rem;margin:0.75rem 0 1rem">${esc(PROMO_PLACEMENTS.events.hint)}</p>
      <div class="admin-draft-full">
        <div class="admin-draft-full__toolbar">
          <div>
            <p class="admin-preview-label">Draft preview — events promos</p>
            <p>Full-width preview. Use Manage promo cards to edit the recurring favorites grid.</p>
          </div>
          <div class="admin-draft-full__toolbar-actions">
            <button type="button" class="btn btn-outline admin-btn-sm" id="manage-promos">Manage promo cards</button>
            <button type="button" class="btn btn-primary admin-btn-sm" id="add-promo">+ Add promo card</button>
          </div>
        </div>
        <iframe id="promo-page-iframe" class="admin-preview-frame" title="Events promo preview" src="events.html?promoPreview=1#promo-recurring"></iframe>
      </div>
      <div id="promo-editor" hidden></div>
      <div id="promo-list" hidden></div>`;

    const promoWorkflow = mountPromoEditorWorkflow(
      panel,
      promosData,
      activePlacement,
      images,
      "promo-list",
      "promo-editor",
      "add-promo",
      scheduleDraftPreview
    );

    panel.querySelector("#manage-promos")?.addEventListener("click", () => {
      promoWorkflow.renderSummaries();
      const list = panel.querySelector("#promo-list");
      openAdminModal({
        title: "Events promo cards",
        subtitle: "Click Edit on any card · drag handles to reorder",
        wide: true,
        bodyHtml: `<div id="promo-list-modal">${list.innerHTML}</div>`,
        footerHtml: `<button type="button" class="btn btn-primary admin-btn-sm" data-admin-modal-close>Done</button>`,
        onMount: (root) => {
          const modalList = root.querySelector("#promo-list-modal");
          modalList.innerHTML = list.innerHTML;
          bindPromoDragReorder(modalList, promosData, PROMO_PLACEMENTS.events.key, scheduleDraftPreview);
          modalList.querySelectorAll("[data-edit-promo]").forEach((btn) => {
            btn.onclick = () => {
              const id = btn.closest("[data-promo-summary]")?.dataset.promoId;
              closeAdminModal();
              promoWorkflow.openEditor(id);
            };
          });
          modalList.querySelectorAll("[data-remove-promo]").forEach((btn) => {
            btn.onclick = () => {
              const id = btn.closest("[data-promo-summary]")?.dataset.promoId;
              if (!id) return;
              promosData.eventsPageFeatured = (promosData.eventsPageFeatured || []).filter((c) => c.id !== id);
              promoWorkflow.renderSummaries();
              scheduleDraftPreview();
              panel._markUnsaved?.();
            };
          });
        },
      });
    });

    panel._getPromos = (base) => {
      const out = JSON.parse(JSON.stringify(base || promosData));
      out.eventsPageFeatured = promosData.eventsPageFeatured || [];
      if (base?.homepageFeatured) out.homepageFeatured = base.homepageFeatured;
      return out;
    };
    panel._refreshPagePreview = () => refreshPagePreview(true);

    pushDraftToBrowser(true);
  }

  function collectPromos(panel, base) {
    if (panel._getPromos) return panel._getPromos(base);
    return base;
  }

  /* ——— Homepage ——— */
  function renderHomepage(panel, site, images, promos) {
    const hp = site.homepage || {};
    let promosData = JSON.parse(JSON.stringify(promos || { homepageFeatured: [], eventsPageFeatured: [] }));
    let previewTimer = null;

    function notifyHomepagePromoFrame(iframe) {
      if (!iframe?.contentWindow) return false;
      try {
        iframe.contentWindow.postMessage({ type: "ws-promo-preview-refresh" }, window.location.origin);
        return true;
      } catch {
        return false;
      }
    }

    function pushHomepagePromoPreview(reloadFrame) {
      if (window.WSConfig) WSConfig.savePreview("promos", promosData);
      const iframe = panel.querySelector("#homepage-preview-iframe");
      if (!iframe || !reloadFrame) return;
      notifyHomepagePromoFrame(iframe);
      iframe.src = `index.html?promoPreview=1#promo-happenings&_=${Date.now()}`;
    }

    function scheduleHomepagePromoPreview(immediate) {
      clearTimeout(previewTimer);
      if (immediate) {
        pushHomepagePromoPreview(true);
        return;
      }
      previewTimer = setTimeout(() => pushHomepagePromoPreview(true), 300);
    }

    panel.innerHTML = `
      <p class="admin-note">Edit homepage sections from the toolbar — the full-width preview updates as you work. Click <em>Save changes</em> when done.</p>
      <div class="admin-draft-full">
        <div class="admin-draft-full__toolbar">
          <div>
            <p class="admin-preview-label">Draft preview — homepage</p>
            <p>Use the buttons to edit welcome text, promos, gallery, signatures, and FAQ.</p>
          </div>
          <div class="admin-draft-full__toolbar-actions">
            <button type="button" class="btn btn-outline admin-btn-sm" data-homepage-modal="welcome">Welcome text</button>
            <button type="button" class="btn btn-outline admin-btn-sm" data-homepage-modal="promos">Happenings</button>
            <button type="button" class="btn btn-outline admin-btn-sm" data-homepage-modal="gallery">Gallery</button>
            <button type="button" class="btn btn-outline admin-btn-sm" data-homepage-modal="signatures">Signatures</button>
            <button type="button" class="btn btn-outline admin-btn-sm" data-homepage-modal="faq">FAQ</button>
          </div>
        </div>
        <iframe id="homepage-preview-iframe" class="admin-preview-frame" title="Homepage preview" src="index.html?promoPreview=1#promo-happenings"></iframe>
      </div>
      <div id="homepage-hidden-editors" hidden>
          <div id="homepage-welcome-editor">
            <div class="admin-form-grid">
              ${field("Location line", `<input data-field="heroes.index.eyebrow" value="${esc(site.heroes?.index?.eyebrow)}" />`)}
              ${field("Intro paragraph", `<textarea data-field="heroes.index.lead" rows="3">${esc(site.heroes?.index?.lead)}</textarea>`)}
            </div>
          </div>
          <div id="homepage-promos-editor">
            <p style="color:var(--text-muted);font-size:0.88rem;margin:0 0 1rem">${esc(PROMO_PLACEMENTS.homepage.hint)}</p>
            <div class="admin-promo-toolbar">
              <button type="button" class="btn btn-outline admin-btn-sm" id="add-homepage-promo">+ Add promo card</button>
            </div>
            <div id="homepage-promo-editor" hidden></div>
            <div id="homepage-promo-list"></div>
          </div>
          <div id="homepage-gallery-editor">
            <div id="gallery-rows">${(hp.gallery || []).map((g, i) => galleryRow(g, i, images)).join("")}</div>
            <button type="button" class="btn btn-outline" id="add-gallery" style="margin-top:0.75rem">+ Add gallery photo</button>
          </div>
          <div id="homepage-signatures-editor">
            <div id="sig-rows">${(hp.signatureCards || []).map((c, i) => sigRow(c, i, images)).join("")}</div>
            <button type="button" class="btn btn-outline" id="add-sig" style="margin-top:0.75rem">+ Add signature card</button>
          </div>
          <div id="homepage-faq-editor">
            <div id="faq-rows">${(hp.faq || []).map((f, i) => faqRow(f, i)).join("")}</div>
            <button type="button" class="btn btn-outline" id="add-faq" style="margin-top:0.75rem">+ Add FAQ</button>
          </div>
      </div>`;

    const homepageModalMap = {
      welcome: { title: "Homepage welcome text", id: "homepage-welcome-editor" },
      promos: { title: "Weekly & monthly happenings", id: "homepage-promos-editor" },
      gallery: { title: "Main Street vibes — gallery", id: "homepage-gallery-editor" },
      signatures: { title: "Signature favorites", id: "homepage-signatures-editor" },
      faq: { title: "Good to know — FAQ", id: "homepage-faq-editor" },
    };

    const homepagePromoWorkflow = mountPromoEditorWorkflow(
      panel,
      promosData,
      "homepage",
      images,
      "homepage-promo-list",
      "homepage-promo-editor",
      "add-homepage-promo",
      scheduleHomepagePromoPreview
    );

    panel.querySelectorAll("[data-homepage-modal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cfg = homepageModalMap[btn.dataset.homepageModal];
        const block = panel.querySelector(`#${cfg.id}`);
        if (!block) return;
        openAdminModal({
          title: cfg.title,
          wide: true,
          bodyHtml: block.innerHTML,
          footerHtml: `<button type="button" class="btn btn-primary admin-btn-sm" data-admin-modal-close>Done</button>`,
          onMount: (root) => {
            bindImagePickers(root);
            bindRemove(root);
            root.querySelector("#add-gallery")?.addEventListener("click", () => {
              const rows = root.querySelector("#gallery-rows");
              rows.insertAdjacentHTML(
                "beforeend",
                galleryRow({ caption: "", alt: "", image: "assets/gallery/WSGoodTimes.webp" }, rows.children.length, images)
              );
              bindImagePickers(root);
              bindRemove(root);
            });
            root.querySelector("#add-sig")?.addEventListener("click", () => {
              const rows = root.querySelector("#sig-rows");
              rows.insertAdjacentHTML(
                "beforeend",
                sigRow({ title: "", summary: "", image: "assets/gallery/WSFood.webp", ctaLabel: "View menu", ctaHref: "menu.html" }, rows.children.length, images)
              );
              bindImagePickers(root);
              bindRemove(root);
            });
            root.querySelector("#add-faq")?.addEventListener("click", () => {
              root.querySelector("#faq-rows")?.insertAdjacentHTML("beforeend", faqRow({ q: "", a: "" }));
              bindRemove(root);
            });
            root.querySelector("#add-homepage-promo")?.addEventListener("click", () => homepagePromoWorkflow.openEditor(null));
          },
          onClose: () => {
            const modalRoot = document.getElementById("admin-modal-root");
            const body = modalRoot?.querySelector(".admin-modal__body");
            if (body) block.innerHTML = body.innerHTML;
            bindImagePickers(panel);
            bindRemove(panel);
            scheduleHomepagePromoPreview(true);
          },
        });
      });
    });

    bindImagePickers(panel);
    bindRemove(panel);
    panel._getHomepagePromos = (base) => {
      const out = JSON.parse(JSON.stringify(base || promosData));
      out.homepageFeatured = promosData.homepageFeatured || [];
      return out;
    };
    panel._refreshPagePreview = () => pushHomepagePromoPreview(true);
    pushHomepagePromoPreview(true);
  }

  function galleryRow(g, i, images) {
    return `
      <div class="admin-list-item" data-gallery="${i}">
        <div class="admin-list-item-head">
          <strong>Gallery photo ${Number(i) + 1}</strong>
          <button type="button" class="btn btn-outline admin-btn-sm" data-remove-gallery>Remove</button>
        </div>
        <div class="admin-form-grid cols-2">
          ${field("Caption", `<input data-field="gal.${i}.caption" value="${esc(g.caption)}" />`)}
          ${field("Alt text", `<input data-field="gal.${i}.alt" value="${esc(g.alt)}" />`)}
        </div>
        ${imagePicker(`gal.${i}.image`, g.image, images, ["gallery", "food", "drinks", "music", "ambiance"])}
      </div>`;
  }

  function sigRow(c, i, images) {
    return `
      <div class="admin-list-item" data-sig="${i}">
        <div class="admin-list-item-head">
          <strong>${esc(c.title || `Signature card ${Number(i) + 1}`)}</strong>
          <button type="button" class="btn btn-outline admin-btn-sm" data-remove-sig>Remove</button>
        </div>
        <div class="admin-form-grid cols-2">
          ${field("Title", `<input data-field="sig.${i}.title" value="${esc(c.title)}" />`)}
          ${field("Button label", `<input data-field="sig.${i}.ctaLabel" value="${esc(c.ctaLabel)}" />`)}
          ${field("Description", `<textarea data-field="sig.${i}.summary" rows="2">${esc(c.summary)}</textarea>`)}
          ${field("Button link", `<input data-field="sig.${i}.ctaHref" value="${esc(c.ctaHref)}" />`)}
        </div>
        ${imagePicker(`sig.${i}.image`, c.image, images, ["food", "gallery", "menu", "signature"])}
      </div>`;
  }

  function faqRow(f, i) {
    return `
      <div class="admin-list-item" data-faq="${i}">
        <div class="admin-list-item-head">
          <strong>FAQ ${Number(i) + 1}</strong>
          <button type="button" class="btn btn-outline admin-btn-sm" data-remove-faq>Remove</button>
        </div>
        ${field("Question", `<input data-field="faq.${i}.q" value="${esc(f.q)}" />`)}
        ${field("Answer", `<textarea data-field="faq.${i}.a" rows="2">${esc(f.a)}</textarea>`)}
      </div>`;
  }

  function collectHomepage(panel, site) {
    const out = JSON.parse(JSON.stringify(site));
    out.heroes = out.heroes || {};
    out.heroes.index = out.heroes.index || {};
    out.heroes.index.eyebrow = val(panel, "heroes.index.eyebrow");
    out.heroes.index.lead = val(panel, "heroes.index.lead");
    out.homepage = out.homepage || {};

    out.homepage.gallery = [];
    panel.querySelectorAll("[data-gallery]").forEach((row) => {
      const i = row.dataset.gallery;
      const caption = val(panel, `gal.${i}.caption`);
      if (!caption) return;
      out.homepage.gallery.push({
        image: val(panel, `gal.${i}.image`),
        caption,
        alt: val(panel, `gal.${i}.alt`) || caption,
      });
    });

    out.homepage.signatureCards = [];
    panel.querySelectorAll("[data-sig]").forEach((row) => {
      const i = row.dataset.sig;
      const title = val(panel, `sig.${i}.title`);
      if (!title) return;
      out.homepage.signatureCards.push({
        title,
        summary: val(panel, `sig.${i}.summary`),
        image: val(panel, `sig.${i}.image`),
        alt: title,
        ctaLabel: val(panel, `sig.${i}.ctaLabel`) || "View menu",
        ctaHref: val(panel, `sig.${i}.ctaHref`) || "menu.html",
      });
    });

    out.homepage.faq = [];
    panel.querySelectorAll("[data-faq]").forEach((row) => {
      const i = row.dataset.faq;
      const q = val(panel, `faq.${i}.q`);
      const a = val(panel, `faq.${i}.a`);
      if (q && a) out.homepage.faq.push({ q, a });
    });
    return out;
  }

  /* ——— Heroes ——— */
  const HERO_PAGES = [
    { key: "index", label: "Homepage", url: "index.html" },
    { key: "events", label: "Events", url: "events.html" },
    { key: "menu", label: "Menu", url: "menu.html" },
    { key: "contact", label: "Visit / Contact", url: "contact.html" },
    { key: "happyHour", label: "Happy Hour", url: "happy-hour.html" },
  ];

  function renderHeroes(panel, site, images) {
    let heroesData = JSON.parse(JSON.stringify(site.heroes || {}));
    let activePage = "index";
    let previewTimer = null;
    const baseSite = JSON.parse(JSON.stringify(site));

    function syncActivePage() {
      heroesData[activePage] = heroesData[activePage] || { panels: ["", "", "", ""] };
      const modalRoot = document.getElementById("admin-modal-root");
      const scope = modalRoot?.querySelector(`[data-field="hero.${activePage}.0"]`) ? modalRoot : panel;
      heroesData[activePage].panels = [0, 1, 2, 3].map((i) => {
        const v = scope.querySelector(`[data-field="hero.${activePage}.${i}"]`);
        return v ? v.value.trim() : heroesData[activePage].panels[i] || "";
      });
    }

    function pushHeroPreview() {
      syncActivePage();
      const draft = { ...baseSite, heroes: heroesData };
      if (window.WSConfig) WSConfig.savePreview("site", draft);
    }

    function scheduleHeroPreview() {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(pushHeroPreview, 400);
    }

    function refreshHeroIframe(reload) {
      const iframe = panel.querySelector("#hero-page-preview");
      const openLink = panel.querySelector("#hero-open-page");
      const pl = HERO_PAGES.find((p) => p.key === activePage);
      if (!pl || !iframe) return;
      const base = `${pl.url}?heroPreview=1`;
      if (openLink) openLink.href = pl.url;
      if (reload) iframe.src = `${base}&_=${Date.now()}`;
    }

    function openHeroEditorModal() {
      const pl = HERO_PAGES.find((p) => p.key === activePage);
      const panels = heroesData[activePage]?.panels || ["", "", "", ""];
      openAdminModal({
        title: `${pl?.label || "Page"} hero photos`,
        subtitle: "Pick four rotating hero images for this page",
        wide: true,
        bodyHtml: `
          ${[0, 1, 2, 3]
            .map(
              (i) => `
            <div class="admin-hero-photo-row">
              <label>Photo ${i + 1}</label>
              ${imagePicker(`hero.${activePage}.${i}`, panels[i] || "", images, ["hero", "gallery"])}
            </div>`
            )
            .join("")}`,
        footerHtml: `<button type="button" class="btn btn-primary admin-btn-sm" data-admin-modal-close>Done</button>`,
        onMount: (root) => {
          bindImagePickers(root, scheduleHeroPreview);
        },
        onClose: () => {
          syncActivePage();
          pushHeroPreview();
          refreshHeroIframe(true);
        },
      });
    }

    function renderEditor() {
      /* hero editor now opens in modal */
    }

    panel.innerHTML = `
      <p class="admin-note">Pick four hero photos per page. Use the draft preview below, then <em>Edit hero photos</em> to change images. Click <em>Save changes</em> when done.</p>
      <div class="admin-placement-tabs" id="hero-page-tabs">
        ${HERO_PAGES.map(
          (p) =>
            `<button type="button" class="admin-placement-tab${p.key === activePage ? " is-active" : ""}" data-hero-page="${p.key}">${esc(p.label)}</button>`
        ).join("")}
      </div>
      <div class="admin-draft-full">
        <div class="admin-draft-full__toolbar">
          <div>
            <p class="admin-preview-label">Draft preview — ${esc(HERO_PAGES.find((p) => p.key === activePage)?.label || "Hero")}</p>
            <p>Switch pages above · edit photos in the popup.</p>
          </div>
          <div class="admin-draft-full__toolbar-actions">
            <button type="button" class="btn btn-primary admin-btn-sm" id="hero-edit-photos">Edit hero photos</button>
            <a href="index.html" target="_blank" rel="noopener" class="btn btn-outline admin-btn-sm" id="hero-open-page">Open full page ↗</a>
          </div>
        </div>
        <iframe id="hero-page-preview" class="admin-preview-frame admin-hero-preview-frame" title="Hero preview" src="index.html?heroPreview=1"></iframe>
      </div>
      <div id="hero-editor-col" hidden></div>`;

    panel.querySelector("#hero-edit-photos")?.addEventListener("click", openHeroEditorModal);

    panel.querySelectorAll("[data-hero-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        syncActivePage();
        activePage = btn.dataset.heroPage;
        panel.querySelectorAll("[data-hero-page]").forEach((b) => {
          b.classList.toggle("is-active", b.dataset.heroPage === activePage);
        });
        const pl = HERO_PAGES.find((p) => p.key === activePage);
        const label = panel.querySelector(".admin-draft-full .admin-preview-label");
        if (label && pl) label.textContent = `Draft preview — ${pl.label}`;
        pushHeroPreview();
        refreshHeroIframe(true);
      });
    });

    panel._collectHeroes = (siteBase) => {
      syncActivePage();
      const out = JSON.parse(JSON.stringify(siteBase));
      out.heroes = heroesData;
      return out;
    };
    panel._refreshPagePreview = () => refreshHeroIframe(true);

    pushHeroPreview();
    refreshHeroIframe(true);
  }

  function collectHeroes(panel, site) {
    const out = JSON.parse(JSON.stringify(site));
    out.heroes = out.heroes || {};
    ["index", "events", "menu", "contact", "happyHour"].forEach((key) => {
      out.heroes[key] = out.heroes[key] || {};
      out.heroes[key].panels = [0, 1, 2, 3].map((i) => val(panel, `hero.${key}.${i}`));
    });
    return out;
  }

  function bindRemove(panel) {
    panel.querySelectorAll("[data-remove-perf]").forEach((btn) => {
      btn.onclick = () => btn.closest("[data-perf]")?.remove();
    });
    panel.querySelectorAll("[data-remove-item]").forEach((btn) => {
      btn.onclick = () => btn.closest("[data-menu-item]")?.remove();
    });
    panel.querySelectorAll("[data-remove-review]").forEach((btn) => {
      btn.onclick = () => btn.closest("[data-review]")?.remove();
    });
    panel.querySelectorAll("[data-remove-faq]").forEach((btn) => {
      btn.onclick = () => btn.closest("[data-faq]")?.remove();
    });
    panel.querySelectorAll("[data-remove-gallery]").forEach((btn) => {
      btn.onclick = () => btn.closest("[data-gallery]")?.remove();
    });
    panel.querySelectorAll("[data-remove-sig]").forEach((btn) => {
      btn.onclick = () => btn.closest("[data-sig]")?.remove();
    });
  }

  return {
    openAdminModal,
    closeAdminModal,
    renderSocial,
    collectSocial,
    renderEvents,
    collectEvents,
    renderMenus,
    collectMenus,
    syncMenuSection,
    renderReviews,
    collectReviews,
    renderPromos,
    collectPromos,
    renderHomepage,
    collectHomepage,
    renderHeroes,
    collectHeroes,
  };
})();
