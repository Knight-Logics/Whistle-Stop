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

  function mediaPicker(name, value, mediaType, imagesData, tags) {
    const imgs = getCatalog(imagesData).filter(
      (img) => !tags?.length || tags.some((t) => img.tags?.includes(t))
    );
    const isUpload = window.WSConfig?.isUploadRef?.(value);
    const urlValue = value && !isUpload ? value : "";
    return `
      <div class="admin-media-picker" data-media-picker data-media-field="${esc(name)}" data-media-type-field="mediaType">
        <div class="admin-media-toolbar">
          <label class="btn btn-outline admin-btn-sm admin-media-upload-btn">
            Upload file
            <input type="file" data-media-file hidden accept="image/*,video/*,.gif,.webp,.avif,.mp4,.webm,.mov,.m4v" />
          </label>
          <span class="admin-media-hint">Images, GIFs, and videos up to 100 MB</span>
        </div>
        <div class="admin-media-dropzone" data-media-dropzone tabindex="0">
          <strong>Drag &amp; drop a file here</strong>
          <span>or use Upload file above</span>
        </div>
        <div class="admin-media-current" data-media-current aria-live="polite"></div>
        <div class="admin-field admin-media-url-field">
          <label>Or paste a site path / URL</label>
          <input type="text" data-media-url value="${esc(urlValue)}" placeholder="assets/gallery/photo.webp or https://..." />
        </div>
        <details class="admin-media-library" open>
          <summary>Site photo library</summary>
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
        </details>
        <input type="hidden" data-field="${esc(name)}" value="${esc(value || "")}" />
        <input type="hidden" data-field="mediaType" value="${esc(mediaType || "")}" />
      </div>`;
  }

  async function renderMediaCurrent(el, src, mediaType, label) {
    if (!el) return;
    if (!src) {
      el.innerHTML = `<p class="admin-media-empty">No file selected yet.</p>`;
      return;
    }
    const resolved = window.WSConfig ? await WSConfig.resolveMediaSrc(src) : src;
    const type =
      mediaType ||
      (window.WSConfig ? WSConfig.inferMediaType("", src) : "image");
    const name = label || src;
    if (type === "video") {
      el.innerHTML = `
        <div class="admin-media-current-card is-video">
          <video src="${esc(resolved)}" muted loop playsinline controls></video>
          <p><strong>${esc(name)}</strong><span>Video</span></p>
        </div>`;
      return;
    }
    el.innerHTML = `
      <div class="admin-media-current-card">
        <img src="${esc(resolved)}" alt="" />
        <p><strong>${esc(name)}</strong><span>${type === "gif" ? "GIF" : "Image"}</span></p>
      </div>`;
  }

  function bindImagePickers(root, onChange) {
    root.querySelectorAll("[data-picker]").forEach((picker) => {
      if (picker.closest("[data-media-picker]")) return;
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

  function bindMediaPickers(root, onChange) {
    root.querySelectorAll("[data-media-picker]").forEach((wrap) => {
      const fieldName = wrap.dataset.mediaField || "image";
      const typeField = wrap.dataset.mediaTypeField || "mediaType";
      const hiddenImage = wrap.querySelector(`[data-field="${fieldName}"]`);
      const hiddenType = wrap.querySelector(`[data-field="${typeField}"]`);
      const current = wrap.querySelector("[data-media-current]");
      const urlInput = wrap.querySelector("[data-media-url]");
      const fileInput = wrap.querySelector("[data-media-file]");
      const dropzone = wrap.querySelector("[data-media-dropzone]");
      const catalog = wrap.querySelector("[data-picker]");

      async function applyMedia(ref, type, label) {
        if (hiddenImage) hiddenImage.value = ref || "";
        const mediaType =
          type ||
          (window.WSConfig ? WSConfig.inferMediaType("", ref) : "image");
        if (hiddenType) hiddenType.value = mediaType;
        if (urlInput && ref && !WSConfig?.isUploadRef?.(ref)) urlInput.value = ref;
        if (urlInput && WSConfig?.isUploadRef?.(ref)) urlInput.value = "";
        catalog?.querySelectorAll(".admin-img-option").forEach((btn) => {
          btn.classList.toggle("is-selected", btn.dataset.path === ref);
        });
        await renderMediaCurrent(current, ref, mediaType, label);
        onChange?.(wrap);
      }

      async function handleFile(file) {
        if (!file || !window.WSConfig?.saveUpload) return;
        try {
          dropzone?.classList.add("is-uploading");
          const result = await WSConfig.saveUpload(file);
          await applyMedia(result.ref, result.mediaType, result.name);
        } catch (err) {
          alert(err.message || "Upload failed.");
        } finally {
          dropzone?.classList.remove("is-uploading");
          if (fileInput) fileInput.value = "";
        }
      }

      fileInput?.addEventListener("change", () => handleFile(fileInput.files?.[0]));

      dropzone?.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("is-dragover");
      });
      dropzone?.addEventListener("dragleave", () => dropzone.classList.remove("is-dragover"));
      dropzone?.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("is-dragover");
        handleFile(e.dataTransfer?.files?.[0]);
      });

      urlInput?.addEventListener("change", () => {
        const value = urlInput.value.trim();
        if (!value) return;
        applyMedia(value, WSConfig.inferMediaType("", value), value);
      });

      catalog?.querySelectorAll(".admin-img-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          catalog.querySelectorAll(".admin-img-option").forEach((b) => b.classList.remove("is-selected"));
          btn.classList.add("is-selected");
          applyMedia(btn.dataset.path, "image", btn.title);
        });
      });

      const initial = hiddenImage?.value || "";
      const initialType = hiddenType?.value || "";
      if (initial) {
        const label = WSConfig?.isUploadRef?.(initial) ? "Uploaded file" : initial;
        renderMediaCurrent(current, initial, initialType, label);
      } else {
        renderMediaCurrent(current, "", "", "");
      }
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

  function promoMediaHtml(src, mediaType, alt) {
    const safeSrc = esc(src || "assets/gallery/WSGoodTimes.webp");
    const safeAlt = esc(alt || "");
    if (mediaType === "video") {
      return `<video src="${safeSrc}" muted loop playsinline autoplay></video>`;
    }
    return `<img src="${safeSrc}" alt="${safeAlt}" />`;
  }

  function promoPreviewHtml(p, resolvedSrc) {
    const tagClass = p.tagClass === "music" ? " music" : "";
    const mediaType =
      p.mediaType ||
      (window.WSConfig ? WSConfig.inferMediaType("", p.image) : "image");
    const src = resolvedSrc || p.image || "assets/gallery/WSGoodTimes.webp";
    return `
      <article class="card admin-promo-preview-card${p.layout === "highlight" ? " card-promo-highlight" : ""}">
        <div class="card-img">${promoMediaHtml(src, mediaType, p.alt || p.title)}</div>
        <div class="card-body">
          <h3>${esc(p.title || "Card title")}</h3>
          <p>${esc(p.summary || "Description appears here.")}</p>
          <div class="card-meta"><span class="tag${tagClass}">${esc(p.tag || "Tag")}</span></div>
        </div>
      </article>`;
  }

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

  async function updatePromoPreview(row) {
    const preview = row.querySelector("[data-promo-preview]");
    if (!preview) return;
    const draft = readPromoRow(row);
    const resolved = window.WSConfig
      ? await WSConfig.resolveMediaSrc(draft.image || "assets/gallery/WSGoodTimes.webp")
      : draft.image;
    preview.innerHTML = promoPreviewHtml(draft, resolved);
  }

  function bindPromoRow(row) {
    row.querySelectorAll("[data-field]").forEach((el) => {
      el.addEventListener("input", () => updatePromoPreview(row));
      el.addEventListener("change", () => updatePromoPreview(row));
    });
    updatePromoPreview(row);
  }

  function val(root, name) {
    const el = root.querySelector(`[data-field="${name}"]`);
    return el ? el.value.trim() : "";
  }

  function rowVal(row, name) {
    const el = row.querySelector(`[data-field="${name}"]`);
    return el ? el.value.trim() : "";
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
    let previewTimer = null;

    function collectFromPanel() {
      const out = { ...eventsData, performances: [], recurring: [] };
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
        const orig = eventsData.recurring?.[Number(i)] || {};
        out.recurring.push({
          ...orig,
          title: rowVal(row, "title") || orig.title,
          summary: rowVal(row, "summary") || orig.summary,
        });
      });
      out.performances.sort((a, b) => a.date.localeCompare(b.date));
      eventsData = out;
      return eventsData;
    }

    function refreshEventsPreview() {
      const iframe = panel.querySelector("#events-page-iframe");
      if (!iframe) return;
      iframe.src = `events.html?preview=1&_=${Date.now()}#events-calendar-section`;
    }

    function pushEventsDraft(reloadFrame) {
      collectFromPanel();
      if (window.WSConfig) WSConfig.savePreview("events", eventsData);
      if (reloadFrame) refreshEventsPreview();
    }

    function scheduleEventsPreview() {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => pushEventsDraft(true), 300);
    }

    const perfs = eventsData.performances || [];
    panel.innerHTML = `
      <p class="admin-note">Add or update <strong>dated acts</strong> (Friday bands, Sunday acoustic, etc.). The calendar on the right updates as you edit — click <em>Save changes</em> when done.</p>
      <div class="admin-page-split">
        <div class="admin-editor-col">
          <div class="admin-card">
            <h3>Upcoming performances</h3>
            <div id="perf-rows">${perfs.map((p) => perfRow(p)).join("")}</div>
            <button type="button" class="btn btn-outline" id="add-perf" style="margin-top:0.75rem">+ Add performance</button>
          </div>
          <details class="admin-card admin-details">
            <summary><h3 style="display:inline;margin:0">Weekly recurring nights</h3></summary>
            <p style="color:var(--text-muted);font-size:0.9rem">These power the calendar every week. Edit titles and descriptions only if the promo changed.</p>
            <div id="recurring-rows">${(eventsData.recurring || []).map((r, i) => recurringRow(r, i)).join("")}</div>
          </details>
        </div>
        <div class="admin-preview-col">
          <p class="admin-preview-label">Live preview — calendar</p>
          <p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 0.75rem">Same month-at-a-glance calendar as the events page. Use ‹ › inside the preview to change months.</p>
          <iframe id="events-page-iframe" class="admin-preview-frame" title="Events calendar preview" src="events.html?preview=1#events-calendar-section"></iframe>
        </div>
      </div>`;

    panel.querySelector("#add-perf")?.addEventListener("click", () => {
      panel.querySelector("#perf-rows")?.insertAdjacentHTML(
        "beforeend",
        perfRow({ date: "", title: "", startTime: "18:30", endTime: "21:30", category: "live-music" })
      );
      bindRemove(panel);
      panel.querySelectorAll("[data-remove-perf]").forEach((btn) => {
        btn.onclick = () => {
          btn.closest("[data-perf]")?.remove();
          scheduleEventsPreview();
        };
      });
    });
    bindRemove(panel);
    panel.querySelectorAll("[data-remove-perf]").forEach((btn) => {
      btn.onclick = () => {
        btn.closest("[data-perf]")?.remove();
        scheduleEventsPreview();
      };
    });
    bindEventsPreviewInputs(panel, scheduleEventsPreview);
    panel._getEvents = collectFromPanel;
    panel._refreshPagePreview = refreshEventsPreview;
    pushEventsDraft(true);
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

  function perfRow(p) {
    return `
      <div class="admin-list-item" data-perf>
        <div class="admin-list-item-head">
          <strong>${esc(p.title || "New act")}</strong>
          <button type="button" class="btn btn-outline admin-btn-sm" data-remove-perf>Remove</button>
        </div>
        <div class="admin-form-grid cols-2">
          ${field("Date", `<input type="date" data-field="date" value="${esc(p.date)}" />`)}
          ${field("Artist / event name", `<input data-field="title" value="${esc(p.title)}" placeholder="e.g. Josh Plummer" />`)}
          ${field("Start time", `<input type="time" data-field="startTime" value="${esc(p.startTime || "18:30")}" />`)}
          ${field("End time", `<input type="time" data-field="endTime" value="${esc(p.endTime || "21:30")}" />`)}
          ${field("Note (optional)", `<input data-field="note" value="${esc(p.note || "")}" placeholder="e.g. Friday bandingo" />`)}
        </div>
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

    function menuPreviewHash() {
      const { menu, cat } = getSelection();
      if (!menu) return "#main-menu";
      if (!cat) return `#${menu.id}`;
      return `#${menu.id}-${cat.id}`;
    }

    function markSyncedSection() {
      panel.dataset.syncedMenuIdx = menuSelect.value;
      panel.dataset.syncedCatIdx = catSelect.value;
    }

    function syncCurrentEditorSection() {
      if (!panel.dataset.menuEditorReady) return;
      const menuIdx = Number(panel.dataset.syncedMenuIdx ?? menuSelect.value ?? 0);
      const catIdx = Number(panel.dataset.syncedCatIdx ?? catSelect.value ?? 0);
      menusData = syncMenuSection(panel, menusData, menuIdx, catIdx);
      menus = menusData.menus;
    }

    function renderMenuDraftPreview() {
      if (!panel.dataset.menuEditorReady) return;
      syncCurrentEditorSection();
      const mount = panel.querySelector("#menu-draft-preview");
      const { menu, cat } = getSelection();
      if (!mount || !window.WSMenuRender || !menu) return;
      const hash = menuPreviewHash();
      const openLink = panel.querySelector("#menu-open-preview");
      if (openLink) openLink.href = `menu.html${hash}`;
      mount.innerHTML = WSMenuRender.renderApp(menusData, menu.id, cat?.id || "");
      const section = cat ? mount.querySelector(`#${menu.id}-${cat.id}`) : null;
      if (section) section.scrollIntoView({ block: "start", behavior: "auto" });
    }

    function scheduleMenuPreview() {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(renderMenuDraftPreview, 200);
    }

    panel.innerHTML = `
      <p class="admin-note">Update item names, descriptions, and prices. The preview on the right shows your edits before you save — nothing goes live on the website until you click <em>Save changes</em>.</p>
      <div class="admin-page-split">
        <div class="admin-editor-col">
          <div class="admin-card">
            <div class="admin-form-grid cols-2">
              ${field("Menu", `<select id="menu-select">${menuOptions}</select>`)}
              ${field("Section", `<select id="cat-select"></select>`)}
            </div>
          </div>
          <div class="admin-card">
            <h3 id="cat-heading">Items</h3>
            <div id="menu-items"></div>
            <button type="button" class="btn btn-outline" id="add-menu-item" style="margin-top:0.75rem">+ Add item to this section</button>
          </div>
        </div>
        <div class="admin-preview-col">
          <p class="admin-preview-label">Draft preview — if you save</p>
          <p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 0.75rem">Shows how the menu page will look after you click <em>Save changes</em>. The live site stays unchanged until then.</p>
          <div id="menu-draft-preview" class="admin-menu-draft-preview admin-preview-frame" aria-label="Menu draft preview"></div>
          <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.75rem">
            <button type="button" class="btn btn-outline admin-btn-sm" id="menu-refresh-preview">Refresh preview</button>
            <a href="menu.html#main-menu" target="_blank" rel="noopener" class="btn btn-outline admin-btn-sm" id="menu-open-preview">Open menu page ↗</a>
          </div>
        </div>
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
      const heading = panel.querySelector("#cat-heading");
      const container = panel.querySelector("#menu-items");
      if (!cat) {
        container.innerHTML = "<p>No sections in this menu.</p>";
        return;
      }
      heading.textContent = cat.name;
      container.innerHTML = (cat.items || []).map((item) => menuItemRow(item)).join("");
      panel.dataset.menuEditorReady = "1";
      markSyncedSection();
      bindRemove(panel);
      panel.querySelectorAll("[data-remove-item]").forEach((btn) => {
        btn.onclick = () => {
          btn.closest("[data-menu-item]")?.remove();
          renderMenuDraftPreview();
        };
      });
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
    panel.querySelector("#add-menu-item")?.addEventListener("click", () => {
      panel.querySelector("#menu-items")?.insertAdjacentHTML(
        "beforeend",
        menuItemRow({ name: "", desc: "", price: "" })
      );
      panel.querySelectorAll("[data-remove-item]").forEach((btn) => {
        btn.onclick = () => {
          btn.closest("[data-menu-item]")?.remove();
          renderMenuDraftPreview();
        };
      });
      renderMenuDraftPreview();
    });
    panel.querySelector("#menu-refresh-preview")?.addEventListener("click", renderMenuDraftPreview);

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

  function syncMenuSection(panel, menus, menuIdx, catIdx) {
    const out = JSON.parse(JSON.stringify(menus));
    if (!panel.dataset.menuEditorReady) return out;
    const mIdx = menuIdx ?? Number(panel.querySelector("#menu-select")?.value || 0);
    const cIdx = catIdx ?? Number(panel.querySelector("#cat-select")?.value || 0);
    const cat = out.menus?.[mIdx]?.categories?.[cIdx];
    if (!cat) return out;

    const items = [];
    panel.querySelectorAll("#menu-items [data-menu-item]").forEach((row) => {
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
  function promoEditorRow(p, placement, imagesData) {
    const pl = PROMO_PLACEMENTS[placement];
    return `
      <div class="admin-list-item admin-promo-editor" data-promo-placement="${placement}" data-promo-id="${esc(p.id || "")}">
        <div class="admin-list-item-head">
          <strong>${esc(p.title || "New promo card")}</strong>
          <span class="admin-placement-badge">${esc(pl.label)}</span>
          <button type="button" class="btn btn-outline admin-btn-sm" data-remove-promo>Remove</button>
        </div>
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
        </div>
        <label style="font-size:0.8rem;color:var(--text-muted);display:block;margin:0.75rem 0 0.35rem">Media — upload, library, or URL</label>
        ${mediaPicker("image", p.image || "", p.mediaType || "", imagesData, ["events", "promo", "gallery", "food", "music"])}
        <p style="font-size:0.8rem;color:var(--text-muted);margin:0.5rem 0 0">Upload images, GIFs, or videos — they are saved with the card when you click <em>Save changes</em>.</p>
      </div>`;
  }

  function syncPromoPlacement(panel, promosData, placement) {
    const key = PROMO_PLACEMENTS[placement].key;
    const items = [];
    panel.querySelectorAll(`[data-promo-placement="${placement}"]`).forEach((row) => {
      const draft = readPromoRow(row);
      if (!draft.title) return;
      const id = row.dataset.promoId;
      const orig = (promosData[key] || []).find((c) => c.id === id) || {};
      items.push({
        ...orig,
        id: orig.id || id || draft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        placement,
        layout: draft.layout,
        title: draft.title,
        summary: draft.summary,
        tag: draft.tag,
        tagClass: draft.tagClass,
        image: draft.image || orig.image,
        mediaType:
          draft.mediaType ||
          orig.mediaType ||
          (window.WSConfig ? WSConfig.inferMediaType("", draft.image || orig.image) : "image"),
        alt: draft.alt || draft.title,
      });
    });
    promosData[key] = items;
    return promosData;
  }

  function renderPromoList(panel, promosData, placement, images, listId, onChange) {
    const key = PROMO_PLACEMENTS[placement].key;
    const cards = promosData[key] || [];
    const list = panel.querySelector(`#${listId}`);
    if (!list) return;
    list.innerHTML = cards.length
      ? cards.map((p) => promoEditorRow({ ...p, placement }, placement, images)).join("")
      : `<p style="color:var(--text-muted)">No cards yet. Click “Add promo card” below.</p>`;
    list.querySelectorAll(".admin-promo-editor").forEach((row) => {
      row.querySelectorAll("[data-field]").forEach((el) => {
        el.addEventListener("input", onChange);
        el.addEventListener("change", onChange);
      });
    });
    bindMediaPickers(list, onChange);
    bindRemove(panel);
    list.querySelectorAll("[data-remove-promo]").forEach((btn) => {
      btn.onclick = () => {
        btn.closest("[data-promo-placement]")?.remove();
        onChange();
      };
    });
  }

  function renderPromos(panel, data, images) {
    const activePlacement = "events";
    let promosData = JSON.parse(JSON.stringify(data || { homepageFeatured: [], eventsPageFeatured: [] }));
    let previewTimer = null;

    function pushDraftToBrowser(reloadFrame) {
      promosData = syncPromoPlacement(panel, promosData, activePlacement);
      if (window.WSConfig) WSConfig.savePreview("promos", promosData);
      if (reloadFrame) refreshPagePreview(true);
    }

    function scheduleDraftPreview() {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => pushDraftToBrowser(false), 500);
    }

    function refreshPagePreview(reload) {
      const iframe = panel.querySelector("#promo-page-iframe");
      const openLink = panel.querySelector("#promo-open-preview");
      if (openLink) openLink.href = "events.html#promo-recurring";
      if (!iframe) return;
      if (reload) iframe.src = `events.html?promoPreview=1#promo-recurring&_=${Date.now()}`;
    }

    panel.innerHTML = `
      <p class="admin-note"><strong>Featured promo cards</strong> on the events page — photo tiles for weekly/monthly happenings (cornhole, book club, etc.). This is not the public <strong>Events</strong> calendar (dates &amp; times) or <strong>Campaign Calendar</strong> (marketing plan). Homepage happenings are under <strong>Homepage</strong>. Click <em>Save changes</em> when done.</p>
      <p style="color:var(--text-muted);font-size:0.9rem;margin:0.75rem 0 1rem">${esc(PROMO_PLACEMENTS.events.hint)}</p>
      <div class="admin-page-split">
        <div class="admin-editor-col">
          <div id="promo-list"></div>
          <button type="button" class="btn btn-outline" id="add-promo" style="margin-top:0.75rem">+ Add promo card</button>
        </div>
        <div class="admin-preview-col">
          <p class="admin-preview-label">Live preview — Events page</p>
          <p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 0.75rem">Recurring favorites grid on events.html.</p>
          <iframe id="promo-page-iframe" class="admin-preview-frame" title="Events promo preview" src="events.html?promoPreview=1#promo-recurring"></iframe>
          <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.75rem">
            <button type="button" class="btn btn-outline admin-btn-sm" id="promo-refresh-preview">Refresh preview</button>
            <a href="events.html#promo-recurring" target="_blank" rel="noopener" class="btn btn-outline admin-btn-sm" id="promo-open-preview">Open full page ↗</a>
          </div>
        </div>
      </div>`;

    panel.querySelector("#promo-refresh-preview")?.addEventListener("click", () => pushDraftToBrowser(true));
    panel.querySelector("#add-promo")?.addEventListener("click", () => {
      const key = PROMO_PLACEMENTS[activePlacement].key;
      promosData[key] = promosData[key] || [];
      promosData[key].push({
        id: `new-${Date.now()}`,
        title: "",
        summary: "",
        tag: "",
        tagClass: "",
        layout: "standard",
        image: "assets/gallery/WSGoodTimes.webp",
        mediaType: "image",
        alt: "",
        placement: activePlacement,
      });
      renderPromoList(panel, promosData, activePlacement, images, "promo-list", scheduleDraftPreview);
    });

    panel._getPromos = (base) => {
      promosData = syncPromoPlacement(panel, promosData, activePlacement);
      const out = JSON.parse(JSON.stringify(base || promosData));
      out.eventsPageFeatured = promosData.eventsPageFeatured || [];
      if (base?.homepageFeatured) out.homepageFeatured = base.homepageFeatured;
      return out;
    };
    panel._refreshPagePreview = () => refreshPagePreview(true);

    renderPromoList(panel, promosData, activePlacement, images, "promo-list", scheduleDraftPreview);
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

    function pushHomepagePromoPreview(reloadFrame) {
      promosData = syncPromoPlacement(panel, promosData, "homepage");
      if (window.WSConfig) WSConfig.savePreview("promos", promosData);
      const iframe = panel.querySelector("#homepage-preview-iframe");
      if (iframe && reloadFrame) {
        iframe.src = `index.html?promoPreview=1#promo-happenings&_=${Date.now()}`;
      }
    }

    function scheduleHomepagePromoPreview() {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => pushHomepagePromoPreview(false), 500);
    }

    panel.innerHTML = `
      <p class="admin-note">Everything on the homepage: <strong>Weekly &amp; monthly happenings</strong>, <strong>Main Street vibes</strong>, <strong>Signature favorites</strong>, and <strong>Good to know</strong>. Swap photos, remove rows, or add new ones — click <em>Save changes</em> when done. Hero photos are under <strong>Hero Images</strong>; events-page promos under <strong>Events Promos</strong>.</p>
      <div class="admin-page-split">
        <div class="admin-editor-col">
          <div class="admin-card">
            <h3>Homepage welcome text</h3>
            <div class="admin-form-grid">
              ${field("Location line", `<input data-field="heroes.index.eyebrow" value="${esc(site.heroes?.index?.eyebrow)}" />`)}
              ${field("Intro paragraph", `<textarea data-field="heroes.index.lead" rows="3">${esc(site.heroes?.index?.lead)}</textarea>`)}
            </div>
          </div>
          <div class="admin-card">
            <div class="admin-list-item-head" style="margin-bottom:0.75rem">
              <h3 style="margin:0">Weekly &amp; monthly happenings</h3>
            </div>
            <p style="color:var(--text-muted);font-size:0.88rem;margin:0 0 1rem">${esc(PROMO_PLACEMENTS.homepage.hint)}</p>
            <div id="homepage-promo-list"></div>
            <button type="button" class="btn btn-outline" id="add-homepage-promo" style="margin-top:0.75rem">+ Add promo card</button>
          </div>
          <div class="admin-card">
            <div class="admin-list-item-head" style="margin-bottom:0.75rem">
              <h3 style="margin:0">Main Street vibes — photo gallery</h3>
            </div>
            <div id="gallery-rows">${(hp.gallery || []).map((g, i) => galleryRow(g, i, images)).join("")}</div>
            <button type="button" class="btn btn-outline" id="add-gallery" style="margin-top:0.75rem">+ Add gallery photo</button>
          </div>
          <div class="admin-card">
            <div class="admin-list-item-head" style="margin-bottom:0.75rem">
              <h3 style="margin:0">Signature favorites</h3>
            </div>
            <div id="sig-rows">${(hp.signatureCards || []).map((c, i) => sigRow(c, i, images)).join("")}</div>
            <button type="button" class="btn btn-outline" id="add-sig" style="margin-top:0.75rem">+ Add signature card</button>
          </div>
          <div class="admin-card">
            <h3>Good to know — FAQ</h3>
            <div id="faq-rows">${(hp.faq || []).map((f, i) => faqRow(f, i)).join("")}</div>
            <button type="button" class="btn btn-outline" id="add-faq" style="margin-top:0.75rem">+ Add FAQ</button>
          </div>
        </div>
        <div class="admin-preview-col">
          <p class="admin-preview-label">Homepage sections preview</p>
          <p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 0.75rem">Scroll the homepage below after saving, or use Open full page.</p>
          <iframe id="homepage-preview-iframe" class="admin-preview-frame" title="Homepage preview" src="index.html?promoPreview=1#promo-happenings"></iframe>
          <a href="index.html" target="_blank" rel="noopener" class="btn btn-outline admin-btn-sm" style="margin-top:0.75rem">Open full page ↗</a>
        </div>
      </div>`;

    renderPromoList(
      panel,
      promosData,
      "homepage",
      images,
      "homepage-promo-list",
      scheduleHomepagePromoPreview
    );
    panel.querySelector("#add-homepage-promo")?.addEventListener("click", () => {
      promosData.homepageFeatured = promosData.homepageFeatured || [];
      promosData.homepageFeatured.push({
        id: `new-${Date.now()}`,
        title: "",
        summary: "",
        tag: "",
        tagClass: "",
        layout: "standard",
        image: "assets/gallery/WSGoodTimes.webp",
        mediaType: "image",
        alt: "",
        placement: "homepage",
      });
      renderPromoList(
        panel,
        promosData,
        "homepage",
        images,
        "homepage-promo-list",
        scheduleHomepagePromoPreview
      );
    });

    panel.querySelector("#add-gallery")?.addEventListener("click", () => {
      const rows = panel.querySelector("#gallery-rows");
      const i = rows.children.length;
      rows.insertAdjacentHTML(
        "beforeend",
        galleryRow({ caption: "", alt: "", image: "assets/gallery/WSGoodTimes.webp" }, i, images)
      );
      bindImagePickers(panel);
      bindRemove(panel);
    });
    panel.querySelector("#add-sig")?.addEventListener("click", () => {
      const rows = panel.querySelector("#sig-rows");
      const i = rows.children.length;
      rows.insertAdjacentHTML(
        "beforeend",
        sigRow(
          {
            title: "",
            summary: "",
            image: "assets/gallery/WSFood.webp",
            ctaLabel: "View menu",
            ctaHref: "menu.html",
          },
          i,
          images
        )
      );
      bindImagePickers(panel);
      bindRemove(panel);
    });
    panel.querySelector("#add-faq")?.addEventListener("click", () => {
      const rows = panel.querySelector("#faq-rows");
      const i = rows.children.length;
      rows.insertAdjacentHTML("beforeend", faqRow({ q: "", a: "" }, i));
      bindRemove(panel);
    });
    bindImagePickers(panel);
    bindRemove(panel);
    panel._getHomepagePromos = (base) => {
      promosData = syncPromoPlacement(panel, promosData, "homepage");
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
      heroesData[activePage].panels = [0, 1, 2, 3].map((i) => {
        const v = panel.querySelector(`[data-field="hero.${activePage}.${i}"]`);
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

    function renderEditor() {
      const pl = HERO_PAGES.find((p) => p.key === activePage);
      const panels = heroesData[activePage]?.panels || ["", "", "", ""];
      const col = panel.querySelector("#hero-editor-col");
      if (!col) return;
      col.innerHTML = `
        <div class="admin-card admin-hero-editor-card">
          <h3>${esc(pl.label)}</h3>
          ${[0, 1, 2, 3]
            .map(
              (i) => `
            <div class="admin-hero-photo-row">
              <label>Photo ${i + 1}</label>
              ${imagePicker(`hero.${activePage}.${i}`, panels[i] || "", images, ["hero", "gallery"])}
            </div>`
            )
            .join("")}
        </div>`;
      bindImagePickers(col, scheduleHeroPreview);
    }

    panel.innerHTML = `
      <p class="admin-note">Pick four hero photos per page. The preview on the right updates as you select thumbnails — click <em>Save changes</em> when done.</p>
      <div class="admin-placement-tabs" id="hero-page-tabs">
        ${HERO_PAGES.map(
          (p) =>
            `<button type="button" class="admin-placement-tab${p.key === activePage ? " is-active" : ""}" data-hero-page="${p.key}">${esc(p.label)}</button>`
        ).join("")}
      </div>
      <div class="admin-page-split admin-hero-page-split">
        <div class="admin-editor-col admin-hero-editor-col" id="hero-editor-col"></div>
        <div class="admin-preview-col admin-hero-preview-col">
          <p class="admin-preview-label">Live preview — ${esc(HERO_PAGES[0].label)}</p>
          <p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 0.75rem">Shows the real page hero as visitors see it.</p>
          <iframe id="hero-page-preview" class="admin-preview-frame admin-hero-preview-frame" title="Hero preview" src="index.html?heroPreview=1"></iframe>
          <a href="index.html" target="_blank" rel="noopener" class="btn btn-outline admin-btn-sm" id="hero-open-page" style="margin-top:0.75rem">Open full page ↗</a>
        </div>
      </div>`;

    panel.querySelectorAll("[data-hero-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        syncActivePage();
        activePage = btn.dataset.heroPage;
        panel.querySelectorAll("[data-hero-page]").forEach((b) => {
          b.classList.toggle("is-active", b.dataset.heroPage === activePage);
        });
        const pl = HERO_PAGES.find((p) => p.key === activePage);
        const label = panel.querySelector(".admin-hero-preview-col .admin-preview-label");
        if (label && pl) label.textContent = `Live preview — ${pl.label}`;
        renderEditor();
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

    renderEditor();
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
    panel.querySelectorAll("[data-remove-promo]").forEach((btn) => {
      btn.onclick = () => btn.closest("[data-promo-placement]")?.remove();
    });
    panel.querySelectorAll("[data-remove-gallery]").forEach((btn) => {
      btn.onclick = () => btn.closest("[data-gallery]")?.remove();
    });
    panel.querySelectorAll("[data-remove-sig]").forEach((btn) => {
      btn.onclick = () => btn.closest("[data-sig]")?.remove();
    });
  }

  return {
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
