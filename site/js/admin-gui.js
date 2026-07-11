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

  function addEventPanelHtml(dateStr, images) {
    const dow = dayOfWeekFromDate(dateStr);
    const defaultImage = "assets/live-music.webp";
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
            ${photoGroupHtml({
              groupId: "add-oneoff-image",
              fieldName: "add.oneoff.image",
              groupData: { image: defaultImage },
              imagesData: images,
              tags: ["events", "music", "gallery", "live-music"],
              label: "Event photo",
              skipAlt: true,
            })}
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
            ${photoGroupHtml({
              groupId: "add-weekly-image",
              fieldName: "add.weekly.image",
              groupData: { image: defaultImage },
              imagesData: images,
              tags: ["events", "music", "gallery", "community", "specials"],
              label: "Event photo",
              skipAlt: true,
            })}
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

  function normalizePhotoGroup(data) {
    const alt = data?.alt || data?.imageAlt || "";
    const excluded = Array.isArray(data?.excluded)
      ? [...data.excluded]
      : Array.isArray(data?.excludedPaths)
        ? [...data.excludedPaths]
        : [];
    if (data?.paths?.length) {
      return { paths: [...data.paths], active: data.active || data.src || data.image || data.paths[0] || "", alt, excluded };
    }
    const src = data?.src || data?.image || "";
    return { paths: src ? [src] : [], active: src, alt, excluded };
  }

  function getPhotoGroupVisiblePaths(paths, excluded, catalog) {
    const hidden = new Set(excluded || []);
    const custom = (paths || []).filter((p) => p && !hidden.has(p));
    const fromCatalog = catalog.map((c) => c.path).filter((p) => p && !hidden.has(p));
    return [...new Set([...custom, ...fromCatalog])];
  }

  function writePhotoGroupState(group, { paths, active, alt, excluded }) {
    group.querySelector("[data-photo-paths]").value = JSON.stringify(paths || []);
    group.querySelector("[data-photo-active]").value = active || "";
    const excludedEl = group.querySelector("[data-photo-excluded]");
    if (excludedEl) excludedEl.value = JSON.stringify(excluded || []);
    const altInput = group.querySelector('input[data-block-field$=".alt"], input[data-field$=".alt"]');
    if (altInput && alt !== undefined) altInput.value = alt;
  }

  async function resolvePhotoGroupImages(group) {
    if (!group || !window.WSConfig?.resolveMediaSrc) return;
    await Promise.all(
      [...group.querySelectorAll(".admin-img-option img")].map(async (img) => {
        const btn = img.closest(".admin-img-option");
        const resolved = await WSConfig.resolveMediaSrc(btn?.dataset.path);
        if (resolved) img.src = resolved;
      })
    );
  }

  function photoGroupHtml(opts) {
    const {
      groupId,
      fieldName,
      groupData,
      imagesData,
      tags,
      label = "Photo",
      skipAlt = false,
      altBlockField,
      altDataField,
    } = opts;
    const g = normalizePhotoGroup(groupData);
    const catalog = getCatalog(imagesData).filter(
      (img) => !tags?.length || tags.some((t) => img.tags?.includes(t))
    );
    const paths = getPhotoGroupVisiblePaths(g.paths, g.excluded, catalog);
    const pickerButtons = paths
      .map((path) => {
        const cat = catalog.find((c) => c.path === path);
        const selected = path === g.active ? " is-selected" : "";
        return `
          <button type="button" class="admin-img-option${selected}" data-path="${esc(path)}" title="${esc(cat?.label || path)}">
            <img src="${esc(path)}" alt="" loading="lazy" draggable="false" />
          </button>`;
      })
      .join("");
    const altFieldHtml = skipAlt
      ? ""
      : altBlockField
        ? field("Alt text", `<input data-block-field="${esc(altBlockField)}" value="${esc(g.alt)}" />`)
        : altDataField
          ? field("Alt text", `<input data-field="${esc(altDataField)}" value="${esc(g.alt)}" />`)
          : field("Alt text", `<input data-block-field="${esc(fieldName)}.alt" value="${esc(g.alt)}" />`);
    return `
      <div class="admin-photo-group" data-photo-group="${esc(groupId)}" data-photo-field="${esc(fieldName)}" data-photo-tags="${esc(JSON.stringify(tags || []))}">
        <div class="admin-list-item-head">
          <strong class="admin-photo-label">${esc(label)}</strong>
          <label class="admin-photo-remove-pick">
            <input type="checkbox" class="admin-photo-group-remove-arm" />
            <span>Select to remove</span>
          </label>
        </div>
        <div class="admin-photo-group-actions">
          <label class="btn btn-outline admin-btn-sm admin-photo-upload-label">
            Upload image(s)
            <input type="file" class="admin-photo-upload-input" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden />
          </label>
          <button type="button" class="btn btn-primary admin-btn-sm admin-photo-group-remove-confirm is-hidden" disabled>
            OK — remove selected
          </button>
        </div>
        <div class="admin-img-picker" data-picker="${esc(fieldName)}">${pickerButtons}</div>
        <input type="hidden" data-photo-active data-field="${esc(fieldName)}" value="${esc(g.active)}" />
        <input type="hidden" data-photo-paths value="${esc(JSON.stringify(g.paths))}" />
        <input type="hidden" data-photo-excluded value="${esc(JSON.stringify(g.excluded))}" />
        ${altFieldHtml}
      </div>`;
  }

  function resolvePhotoGroupMount(el) {
    if (!el) return el;
    if (el.classList?.contains("admin-modal__body")) return el;
    return el.querySelector?.(".admin-modal__body") || el;
  }

  function readPhotoGroup(groupEl) {
    if (!groupEl) return { paths: [], active: "", alt: "", excluded: [] };
    const paths = JSON.parse(groupEl.querySelector("[data-photo-paths]")?.value || "[]");
    const excluded = JSON.parse(groupEl.querySelector("[data-photo-excluded]")?.value || "[]");
    const active = groupEl.querySelector("[data-photo-active]")?.value.trim() || paths[0] || "";
    const alt =
      groupEl.querySelector('input[data-block-field$=".alt"], input[data-field$=".alt"]')?.value.trim() || "";
    return { paths, active, alt, excluded };
  }

  function updatePhotoGroupRemoveUI(group) {
    if (!group) return;
    const armed = group.querySelector(".admin-photo-group-remove-arm")?.checked;
    const confirmBtn = group.querySelector(".admin-photo-group-remove-confirm");
    const { active } = readPhotoGroup(group);
    group.classList.toggle("is-remove-mode", !!armed);
    group.querySelectorAll(".admin-img-option.is-marked-remove").forEach((btn) => {
      if (active && btn.dataset.path === active) btn.classList.remove("is-marked-remove");
    });
    group.querySelectorAll(".admin-img-option").forEach((btn) => {
      const isActive = !!active && btn.dataset.path === active;
      btn.classList.toggle("is-active-locked", !!armed && isActive);
      if (armed && isActive) {
        btn.setAttribute("aria-disabled", "true");
        btn.title = "Currently selected for this slot — choose a different image first";
      } else if (btn.dataset.path) {
        btn.removeAttribute("aria-disabled");
      }
    });
    const marked = [...group.querySelectorAll(".admin-img-option.is-marked-remove")].filter(
      (btn) => btn.dataset.path !== active
    );
    const canRemove = !!armed && marked.length > 0;
    if (confirmBtn) {
      confirmBtn.classList.toggle("is-hidden", !canRemove);
      confirmBtn.disabled = !canRemove;
      confirmBtn.setAttribute("aria-hidden", canRemove ? "false" : "true");
    }
  }

  function refreshPhotoGroupPicker(group, imagesData, tags) {
    const { paths, active, excluded } = readPhotoGroup(group);
    const catalog = getCatalog(imagesData).filter(
      (img) => !tags?.length || tags.some((t) => img.tags?.includes(t))
    );
    const allPaths = getPhotoGroupVisiblePaths(paths, excluded, catalog);
    const picker = group.querySelector(".admin-img-picker");
    if (!picker) return;
    const marked = new Set(
      [...picker.querySelectorAll(".admin-img-option.is-marked-remove")].map((b) => b.dataset.path)
    );
    picker.innerHTML = allPaths
      .map((path) => {
        const cat = catalog.find((c) => c.path === path);
        let cls = "";
        if (path === active) cls += " is-selected";
        if (marked.has(path)) cls += " is-marked-remove";
        return `
          <button type="button" class="admin-img-option${cls}" data-path="${esc(path)}" title="${esc(cat?.label || path)}">
            <img src="${esc(path)}" alt="" loading="lazy" draggable="false" />
          </button>`;
      })
      .join("");
    updatePhotoGroupRemoveUI(group);
    resolvePhotoGroupImages(group);
  }

  function bindPhotoGroups(mountEl, imagesData, onChange, defaultTags = ["gallery", "food", "hero"]) {
    const root = resolvePhotoGroupMount(mountEl);
    if (!root || root.dataset.photoGroupsBound) return;
    root.dataset.photoGroupsBound = "1";

    root.addEventListener("change", (e) => {
      if (e.target.classList.contains("admin-photo-group-remove-arm")) {
        const group = e.target.closest("[data-photo-group]");
        if (!e.target.checked) {
          group?.querySelectorAll(".admin-img-option.is-marked-remove").forEach((btn) => {
            btn.classList.remove("is-marked-remove");
          });
        }
        updatePhotoGroupRemoveUI(group);
      }
    });

    root.addEventListener("click", async (e) => {
      const group = e.target.closest("[data-photo-group]");
      if (!group) return;

      if (e.target.closest(".admin-photo-group-remove-confirm")) {
        e.preventDefault();
        let { paths, active, alt, excluded } = readPhotoGroup(group);
        const marked = [...group.querySelectorAll(".admin-img-option.is-marked-remove")].filter(
          (btn) => btn.dataset.path !== active
        );
        if (!marked.length) return;
        const count = marked.length;
        const msg =
          count === 1
            ? "Remove 1 selected image from this photo group only? Other photo groups on this page will not be changed."
            : `Remove ${count} selected images from this photo group only? Other photo groups on this page will not be changed.`;
        if (!window.confirm(msg)) return;

        const removePaths = new Set(marked.map((b) => b.dataset.path));
        excluded = [...new Set([...(excluded || []), ...removePaths])];
        paths = paths.filter((p) => !removePaths.has(p));
        const tags = group.dataset.photoTags ? JSON.parse(group.dataset.photoTags) : defaultTags;
        const catalog = getCatalog(imagesData).filter(
          (img) => !tags?.length || tags.some((t) => img.tags?.includes(t))
        );
        const visible = getPhotoGroupVisiblePaths(paths, excluded, catalog);
        if (!visible.includes(active)) active = visible[0] || "";
        writePhotoGroupState(group, { paths, active, alt, excluded });
        group.querySelector(".admin-photo-group-remove-arm").checked = false;
        refreshPhotoGroupPicker(group, imagesData, tags);
        onChange?.();
        return;
      }

      const imgBtn = e.target.closest(".admin-img-option");
      if (!imgBtn || !group.contains(imgBtn)) return;

      const armed = group.querySelector(".admin-photo-group-remove-arm")?.checked;
      if (armed) {
        e.preventDefault();
        e.stopPropagation();
        const active = readPhotoGroup(group).active;
        if (active && imgBtn.dataset.path === active) return;
        imgBtn.classList.toggle("is-marked-remove");
        updatePhotoGroupRemoveUI(group);
        return;
      }

      e.preventDefault();
      group.querySelectorAll(".admin-img-option").forEach((b) => {
        b.classList.remove("is-selected", "is-marked-remove");
      });
      imgBtn.classList.add("is-selected");
      group.querySelector("[data-photo-active]").value = imgBtn.dataset.path;
      let { paths } = readPhotoGroup(group);
      if (!paths.includes(imgBtn.dataset.path)) {
        paths.push(imgBtn.dataset.path);
        group.querySelector("[data-photo-paths]").value = JSON.stringify(paths);
      }
      onChange?.();
    });

    root.addEventListener("change", async (e) => {
      if (!e.target.classList.contains("admin-photo-upload-input")) return;
      const group = e.target.closest("[data-photo-group]");
      if (!group || !e.target.files?.length) return;
      const tags = group.dataset.photoTags ? JSON.parse(group.dataset.photoTags) : defaultTags;
      let { paths, active, excluded } = readPhotoGroup(group);
      for (const file of e.target.files) {
        try {
          const uploaded = window.WSConfig ? await WSConfig.saveUpload(file) : null;
          const path = uploaded?.ref || URL.createObjectURL(file);
          if (uploaded && imagesData && !Array.isArray(imagesData)) {
            imagesData.catalog = imagesData.catalog || [];
            imagesData.catalog.push({
              path,
              label: file.name,
              tags: [...tags, "upload"],
            });
          }
          excluded = (excluded || []).filter((p) => p !== path);
          if (!paths.includes(path)) paths.push(path);
          active = path;
        } catch (err) {
          window.alert(err.message || "Upload failed.");
        }
      }
      writePhotoGroupState(group, { paths, active, excluded });
      refreshPhotoGroupPicker(group, imagesData, tags);
      e.target.value = "";
      onChange?.();
    });

    root.querySelectorAll("[data-photo-group]").forEach((group) => {
      const tags = group.dataset.photoTags ? JSON.parse(group.dataset.photoTags) : defaultTags;
      refreshPhotoGroupPicker(group, imagesData, tags);
    });
  }

  function bindImagePickers(root, onChange) {
    root.querySelectorAll("[data-picker]").forEach((picker) => {
      if (picker.closest("[data-photo-group]")) return;
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

  function sectionAddPhotoToolbarHtml(addId) {
    return `
      <div class="admin-photo-toolbar">
        <button type="button" class="btn btn-outline admin-btn-sm" id="${addId}">+ Add photo</button>
      </div>`;
  }

  function splitPhotoRow(img, i, images, tags = ["gallery", "food", "hero"]) {
    return `
      <div class="admin-list-item" data-block-split-photo="${i}">
        ${photoGroupHtml({
          groupId: `split-${i}`,
          fieldName: `splitImage.${i}`,
          groupData: img,
          imagesData: images,
          tags,
          label: `Photo ${Number(i) + 1}`,
          altBlockField: `images.${i}.alt`,
        })}
      </div>`;
  }

  function collectSplitPhotosFromRoot(root) {
    return [...root.querySelectorAll("[data-block-split-photo]")].map((row) => {
      const group = row.querySelector("[data-photo-group]");
      const { paths, active, alt, excluded } = readPhotoGroup(group);
      return { src: active, alt, paths, excludedPaths: excluded, active };
    });
  }

  function collectGalleryBlockPhotosFromRoot(root, prefix) {
    return [...root.querySelectorAll("[data-block-gallery]")].map((row, i) => {
      const group = row.querySelector("[data-photo-group]");
      const { active, alt, paths, excluded } = readPhotoGroup(group);
      return {
        caption: row.querySelector(`[data-block-field="${prefix}.items.${i}.caption"]`)?.value.trim() || "",
        alt,
        image: active,
        paths,
        excludedPaths: excluded,
      };
    });
  }

  function bindPhotoSectionAdd(root, opts) {
    const { rowsEl, addBtnId, renderRow, defaultRow, imagesData, onChanged } = opts;
    root.querySelector(`#${addBtnId}`)?.addEventListener("click", () => {
      const count = rowsEl.querySelectorAll("[data-block-split-photo], [data-block-gallery]").length;
      rowsEl.insertAdjacentHTML("beforeend", renderRow(defaultRow(), count));
      const newGroup = rowsEl.lastElementChild?.querySelector("[data-photo-group]");
      if (newGroup) {
        const tags = newGroup.dataset.photoTags ? JSON.parse(newGroup.dataset.photoTags) : ["gallery", "food", "hero"];
        refreshPhotoGroupPicker(newGroup, imagesData, tags);
        if (window.WSConfig?.resolveMediaSrc) {
          newGroup.querySelectorAll(".admin-img-option img").forEach(async (img) => {
            const btn = img.closest(".admin-img-option");
            const resolved = await WSConfig.resolveMediaSrc(btn.dataset.path);
            if (resolved) img.src = resolved;
          });
        }
      }
      onChanged?.();
    });
  }

  function bindPhotoSectionToolbar(root, opts) {
    bindPhotoSectionAdd(root, opts);
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
      label: "Events page (legacy)",
      hint: "Legacy — recurring favorites on the events page now come from Weekly recurring nights in events.json.",
      previewPage: "events.html",
    },
  };

  function readPromoRow(row) {
    const group = row.querySelector('[data-photo-group="promo-image"]');
    const img = group
      ? readPhotoGroup(group)
      : { active: rowVal(row, "image"), paths: [], excluded: [] };
    return {
      title: rowVal(row, "title"),
      summary: rowVal(row, "summary"),
      tag: rowVal(row, "tag"),
      tagClass: rowVal(row, "tagClass"),
      layout: rowVal(row, "layout") || "standard",
      image: img.active || rowVal(row, "image"),
      imagePaths: img.paths,
      excludedPaths: img.excluded,
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
  function renderEvents(panel, data, images, promos, site) {
    let eventsData = JSON.parse(JSON.stringify(data || { performances: [], recurring: [] }));
    let promosData = JSON.parse(JSON.stringify(promos || { homepageFeatured: [], eventsPageFeatured: [] }));
    let siteData = JSON.parse(JSON.stringify(site || {}));
    siteData.pages = siteData.pages || {};
    siteData.pages.events = siteData.pages.events || {
      recurringSection: { title: "Recurring favorites", lead: "" },
      liveMusicSidebar: { image: "", imageAlt: "", title: "", body: "", bullets: [] },
      gallery: [],
    };
    siteData.heroes = siteData.heroes || {};
    siteData.heroes.events = siteData.heroes.events || { panels: ["", "", "", ""] };
    const baseSite = JSON.parse(JSON.stringify(siteData));
    eventsData.performances = eventsData.performances || [];
    eventsData.recurring = eventsData.recurring || [];
    let previewTimer = null;
    let nextPerfId = 1;

    let campaignDraft = null;
    try {
      const raw = sessionStorage.getItem("ws_event_draft_from_campaign");
      if (raw) campaignDraft = JSON.parse(raw);
    } catch (_) {}

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
      if (p.image) item.image = p.image;
      if (p.imagePaths?.length) item.imagePaths = p.imagePaths;
      if (p.excludedPaths?.length) item.excludedPaths = p.excludedPaths;
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
      const modalRoot = document.getElementById("admin-modal-root");
      if (modalRoot) syncEventPhotosFromRoot(modalRoot);
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
      if (window.WSAdminPreviewFrame) {
        WSAdminPreviewFrame.setSrc(iframe, "events.html", "preview=1&promoPreview=1");
      } else {
        iframe.src = `${window.WSAdminPreviewFrame?.normalizePreviewUrl("events.html") || "events"}?preview=1&promoPreview=1&adminFrame=events-page-iframe&_=${Date.now()}`;
      }
    }

    function pushEventsDraft(reloadFrame) {
      if (window.WSConfig) {
        WSConfig.savePreview("events", collectFromPanel());
        WSConfig.savePreview("promos", promosData);
        WSConfig.savePreview("site", collectEventsSite());
      }
      if (reloadFrame) refreshEventsPreview();
    }

    function scheduleEventsPreview() {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => pushEventsDraft(true), 300);
    }

    const eventsPageModalMap = {
      "hero-text": { title: "Events hero text", id: "events-hero-text-editor" },
      "hero-photos": { title: "Events hero photos", id: "events-hero-photos-editor" },
      recurring: { title: "Recurring favorites", id: "events-recurring-editor" },
      "one-off": { title: "Coming up — section intro", id: "events-one-off-editor" },
      gallery: { title: "Events photo gallery", id: "events-gallery-editor" },
    };

    function eventsBulletRow(b, i) {
      return `
        <div class="admin-list-item" data-events-bullet="${i}">
          <div class="admin-form-grid cols-2">
            ${field("Day label", `<input data-field="evBullet.${i}.label" value="${esc(b.label)}" />`)}
            ${field("Description", `<input data-field="evBullet.${i}.text" value="${esc(b.text)}" />`)}
          </div>
          <button type="button" class="btn btn-outline admin-btn-sm" data-remove-events-bullet style="margin-top:0.5rem">Remove</button>
        </div>`;
    }

    function syncEventsPageFromScope(scope = panel) {
      const ep = siteData.pages.events;
      ep.recurringSection = ep.recurringSection || {};
      ep.recurringSection.title =
        scope.querySelector('[data-field="events.recurring.title"]')?.value.trim() ||
        ep.recurringSection.title ||
        "";
      ep.recurringSection.lead =
        scope.querySelector('[data-field="events.recurring.lead"]')?.value.trim() ||
        ep.recurringSection.lead ||
        "";

      ep.oneOffSection = ep.oneOffSection || {};
      ep.oneOffSection.title =
        scope.querySelector('[data-field="events.oneOff.title"]')?.value.trim() ||
        ep.oneOffSection.title ||
        "";
      ep.oneOffSection.lead =
        scope.querySelector('[data-field="events.oneOff.lead"]')?.value.trim() ||
        ep.oneOffSection.lead ||
        "";

      const gallery = [];
      scope.querySelectorAll("[data-events-gallery]").forEach((row) => {
        const i = row.dataset.eventsGallery;
        const group = row.querySelector("[data-photo-group]");
        const caption = row.querySelector(`[data-field="evGal.${i}.caption"]`)?.value.trim() || "";
        const alt = row.querySelector(`[data-field="evGal.${i}.alt"]`)?.value.trim() || "";
        if (group) {
          const g = readPhotoGroup(group);
          gallery.push({
            caption,
            alt,
            image: g.active,
            paths: g.paths,
            excludedPaths: g.excluded,
          });
        } else {
          gallery.push({
            caption,
            alt,
            image: row.querySelector(`[data-field="evGal.${i}.image"]`)?.value.trim() || "",
          });
        }
      });
      if (gallery.length) ep.gallery = gallery.filter((g) => g.image);

      siteData.heroes.events = siteData.heroes.events || { panels: ["", "", "", ""] };
      siteData.heroes.events.eyebrow =
        scope.querySelector('[data-field="heroes.events.eyebrow"]')?.value.trim() ||
        siteData.heroes.events.eyebrow ||
        "";
      siteData.heroes.events.titleLine1 =
        scope.querySelector('[data-field="heroes.events.titleLine1"]')?.value.trim() ||
        siteData.heroes.events.titleLine1 ||
        "";
      siteData.heroes.events.lead =
        scope.querySelector('[data-field="heroes.events.lead"]')?.value.trim() || siteData.heroes.events.lead || "";
      siteData.heroes.events.panels = [0, 1, 2, 3].map((i) => readHeroPanelValue(scope, "events", i));
      syncHeroPhotoMeta("events", scope, siteData.heroes.events);
    }

    function collectEventsSite() {
      syncEventsPageFromScope();
      const out = JSON.parse(JSON.stringify(baseSite));
      out.pages = siteData.pages;
      out.heroes = { ...out.heroes, events: siteData.heroes.events };
      return out;
    }

    function eventsGalleryRow(g, i, imgs) {
      return `
        <div class="admin-list-item" data-events-gallery="${i}">
          <div class="admin-list-item-head">
            <strong>Gallery photo ${Number(i) + 1}</strong>
            <button type="button" class="btn btn-outline admin-btn-sm" data-remove-events-gallery>Remove</button>
          </div>
          <div class="admin-form-grid cols-2">
            ${field("Caption", `<input data-field="evGal.${i}.caption" value="${esc(g.caption)}" />`)}
            ${field("Alt text", `<input data-field="evGal.${i}.alt" value="${esc(g.alt)}" />`)}
          </div>
          ${photoGroupHtml({
            groupId: `ev-gal-${i}`,
            fieldName: `evGal.${i}.image`,
            groupData: { image: g.image, paths: g.paths, excludedPaths: g.excludedPaths },
            imagesData: imgs,
            tags: ["gallery", "events"],
            label: "Photo",
            skipAlt: true,
          })}
        </div>`;
    }

    function openEventsPageModal(sectionKey) {
      const cfg = eventsPageModalMap[sectionKey];
      if (!cfg) return;
      const block = panel.querySelector(`#${cfg.id}`);
      if (!block) return;
      openAdminModal({
        title: cfg.title,
        wide: true,
        bodyHtml: block.innerHTML,
        footerHtml: `<button type="button" class="btn btn-primary admin-btn-sm" data-admin-modal-close>Done</button>`,
        onMount: (root) => {
          bindPhotoGroups(root, images, () => scheduleEventsPreview());
          bindImagePickers(root, () => scheduleEventsPreview());
          bindRemove(root);
          root.querySelectorAll("[data-remove-events-bullet]").forEach((btn) => {
            btn.onclick = () => {
              btn.closest("[data-events-bullet]")?.remove();
              scheduleEventsPreview();
            };
          });
          root.querySelectorAll("[data-remove-events-gallery]").forEach((btn) => {
            btn.onclick = () => {
              btn.closest("[data-events-gallery]")?.remove();
              scheduleEventsPreview();
            };
          });
          root.addEventListener("input", (e) => {
            if (e.target.matches("[data-field]")) scheduleEventsPreview();
          });
          root.querySelector("#add-events-bullet")?.addEventListener("click", () => {
            const rows = root.querySelector("#events-bullet-rows");
            const i = rows.children.length;
            rows.insertAdjacentHTML("beforeend", eventsBulletRow({ label: "", text: "" }, i));
          });
          root.querySelector("#add-events-gallery")?.addEventListener("click", () => {
            const rows = root.querySelector("#events-gallery-rows");
            const i = rows.children.length;
            rows.insertAdjacentHTML(
              "beforeend",
              eventsGalleryRow({ caption: "", alt: "", image: "assets/gallery/WSGoodTimes.webp" }, i, images)
            );
            const newGroup = rows.lastElementChild?.querySelector("[data-photo-group]");
            if (newGroup) {
              const tags = newGroup.dataset.photoTags ? JSON.parse(newGroup.dataset.photoTags) : ["gallery", "events"];
              refreshPhotoGroupPicker(newGroup, images, tags);
            }
            bindRemove(root);
          });
        },
        onClose: () => {
          const modalRoot = document.getElementById("admin-modal-root");
          const body = modalRoot?.querySelector(".admin-modal__body");
          if (body) block.innerHTML = body.innerHTML;
          bindImagePickers(panel);
          syncEventsPageFromScope();
          pushEventsDraft(true);
        },
      });
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

    function recurringEditorFieldsHtml(ev, index) {
      return `
        <div class="admin-form-grid cols-2">
          ${field("Event name", `<input data-recurring-field="title" value="${esc(ev.title || "")}" />`)}
          ${eventCategoryField("category", ev.category || "community", "data-recurring-field")}
          ${daysOfWeekField(ev.dayOfWeek || [], "data-recurring-field")}
          ${field("Summary", `<textarea data-recurring-field="summary" rows="2">${esc(ev.summary || "")}</textarea>`)}
          ${field("Start time", `<input type="time" data-recurring-field="startTime" value="${esc(ev.startTime || "")}" />`)}
          ${field("End time (optional)", `<input type="time" data-recurring-field="endTime" value="${esc(ev.endTime || "")}" />`)}
          ${weekOfMonthField("weekOfMonth", ev.weekOfMonth || "", "data-recurring-field")}
        </div>
        ${photoGroupHtml({
          groupId: `recurring-${index}`,
          fieldName: `recurring.${index}.image`,
          groupData: { image: ev.image, paths: ev.imagePaths, excludedPaths: ev.excludedPaths },
          imagesData: images,
          tags: ["events", "music", "gallery", "community"],
          label: "Event photo",
          skipAlt: true,
        })}`;
    }

    function syncRecurringPhotosFromRoot(root) {
      root.querySelectorAll("[data-modal-recurring]").forEach((block) => {
        const index = Number(block.dataset.modalRecurring);
        const ev = eventsData.recurring?.[index];
        if (!ev) return;
        const group = block.querySelector("[data-photo-group]");
        if (!group) return;
        const g = readPhotoGroup(group);
        ev.image = g.active;
        ev.imagePaths = g.paths;
        ev.excludedPaths = g.excluded;
      });
    }

    function syncPerformancePhotosFromRoot(root) {
      root.querySelectorAll("[data-modal-perf]").forEach((block) => {
        const perf = performanceById(block.dataset.modalPerf);
        if (!perf) return;
        const group = block.querySelector("[data-photo-group]");
        if (!group) return;
        const g = readPhotoGroup(group);
        perf.image = g.active;
        perf.imagePaths = g.paths;
        perf.excludedPaths = g.excluded;
      });
    }

    function syncEventPhotosFromRoot(root) {
      syncRecurringPhotosFromRoot(root);
      syncPerformancePhotosFromRoot(root);
    }

    function readAddPanelImage(root, type) {
      const group = root.querySelector(
        `[data-photo-group="${type === "weekly" ? "add-weekly-image" : "add-oneoff-image"}"]`
      );
      return group ? readPhotoGroup(group).active : "assets/live-music.webp";
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
        </div>
        ${photoGroupHtml({
          groupId: `perf-${perf.__adminId || "new"}`,
          fieldName: `perf.${perf.__adminId || "new"}.image`,
          groupData: { image: perf.image, paths: perf.imagePaths, excludedPaths: perf.excludedPaths },
          imagesData: images,
          tags: ["events", "music", "gallery", "live-music"],
          label: "Event photo",
          skipAlt: true,
        })}`;
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
          const image = readAddPanelImage(root, "one-off");
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
            image,
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
          image: readAddPanelImage(root, "weekly"),
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
                  ${recurringEditorFieldsHtml(ev, index)}
                </div>`;
            })
            .join("")
        : `<p class="admin-events-empty admin-events-empty--subtle">No weekly events on this day.</p>`;

      const recurringHtml = `<div class="admin-modal-day-section">
            ${modalSectionHead("Weekly events on this day", { btnId: "modal-toggle-add-event", btnLabel: "+ Add event" })}
            ${addEventPanelHtml(editingDate, images)}
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
          bindPhotoGroups(root, images, () => {
            syncEventPhotosFromRoot(root);
            scheduleEventsPreview();
            panel._markUnsaved?.();
          });

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

    let promoWorkflow = null;

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
        else openEventsDayModal(payload.date, { focusId: null });
        return;
      }
      if (payload.type === "recurring") {
        const ev = (eventsData.recurring || []).find((r) => r.id === payload.id);
        if (ev) {
          const today = new Date();
          let dateStr = today.toISOString().slice(0, 10);
          for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            if ((ev.dayOfWeek || []).includes(d.getDay())) {
              dateStr = d.toISOString().slice(0, 10);
              break;
            }
          }
          openEventsDayModal(dateStr, { recurringPayload: { id: ev.id, recurring: true } });
        }
        return;
      }
      if (payload.type === "promo" && promoWorkflow) {
        promoWorkflow.openEditor(payload.id || null);
        return;
      }
      if (payload.type === "section" && payload.section) {
        openEventsPageModal(payload.section);
      }
    }

    const ep = siteData.pages.events;
    const evHero = siteData.heroes.events || {};

    panel.innerHTML = `
      ${campaignDraft ? `<div class="admin-campaign-promote-banner" role="note"><strong>From Campaign Calendar:</strong> “${esc(campaignDraft.title)}” is ready to schedule. <button type="button" class="btn btn-primary btn-sm" id="apply-campaign-draft">Add as performance</button><button type="button" class="btn btn-secondary btn-sm" id="dismiss-campaign-draft">Dismiss</button></div>` : ""}
      <p class="admin-note">Click anything in the preview to edit it. <strong>Month at a glance</strong> is the full calendar. <strong>Recurring favorites</strong> and <strong>Coming up</strong> are photo cards from weekly nights and one-off performances. <em>Save draft</em> then <em>Publish live</em> when ready.</p>
      <div class="admin-draft-full">
        <div class="admin-draft-full__toolbar">
          <div>
            <p class="admin-preview-label">Events page draft</p>
          </div>
          <div class="admin-draft-full__toolbar-actions">
            <button type="button" class="btn btn-primary admin-btn-sm" id="add-perf">+ Add performance</button>
            <button type="button" class="btn btn-primary admin-btn-sm" id="events-add-weekly">+ Add weekly event</button>
          </div>
        </div>
        <iframe id="events-page-iframe" class="admin-preview-frame admin-events-preview-frame" title="Events page draft preview" src="about:blank"></iframe>
      </div>
      <div id="events-hidden-editors" hidden>
        <div id="events-hero-text-editor">
          <div class="admin-form-grid">
            ${field("Eyebrow", `<input data-field="heroes.events.eyebrow" value="${esc(evHero.eyebrow)}" />`)}
            ${field("Headline", `<input data-field="heroes.events.titleLine1" value="${esc(evHero.titleLine1)}" />`)}
            ${field("Intro", `<textarea data-field="heroes.events.lead" rows="3">${esc(evHero.lead)}</textarea>`)}
          </div>
        </div>
        <div id="events-hero-photos-editor">
          ${heroPanelsEditorHtml("events", { events: evHero }, images, ["hero", "gallery", "events"])}
        </div>
        <div id="events-recurring-editor">
          <div class="admin-form-grid">
            ${field("Section title", `<input data-field="events.recurring.title" value="${esc(ep.recurringSection?.title)}" />`)}
            ${field("Section intro", `<textarea data-field="events.recurring.lead" rows="2">${esc(ep.recurringSection?.lead)}</textarea>`)}
          </div>
          <p class="admin-note" style="margin-top:0.75rem">Photo cards below are built from <strong>Weekly recurring</strong> nights — click a card in the preview to edit that event, or use <em>+ Add weekly event</em>.</p>
        </div>
        <div id="events-one-off-editor">
          <div class="admin-form-grid">
            ${field("Section title", `<input data-field="events.oneOff.title" value="${esc(ep.oneOffSection?.title || "Coming up")}" />`)}
            ${field("Section intro", `<textarea data-field="events.oneOff.lead" rows="2">${esc(ep.oneOffSection?.lead || "Special dates, featured acts, and one-time happenings.")}</textarea>`)}
          </div>
          <p class="admin-note" style="margin-top:0.75rem">Photo cards are built from one-off performances — click a card in the preview to edit, or use <em>+ Add performance</em>.</p>
        </div>
        <div id="events-gallery-editor">
          <div id="events-gallery-rows">${(ep.gallery || []).map((g, i) => eventsGalleryRow(g, i, images)).join("")}</div>
          <button type="button" class="btn btn-outline admin-btn-sm" id="add-events-gallery" style="margin-top:0.75rem">+ Add gallery photo</button>
        </div>
      </div>`;

    panel.querySelectorAll("[data-events-modal]").forEach((btn) => {
      btn.addEventListener("click", () => openEventsPageModal(btn.dataset.eventsModal));
    });

    panel.querySelector("#add-perf")?.addEventListener("click", () =>
      openEventsDayModal(new Date().toISOString().slice(0, 10), { expandAdd: true, addType: "one-off" })
    );
    panel.querySelector("#events-add-weekly")?.addEventListener("click", () =>
      openEventsDayModal(new Date().toISOString().slice(0, 10), { expandAdd: true, addType: "weekly" })
    );

    panel.querySelector("#apply-campaign-draft")?.addEventListener("click", () => {
      if (!campaignDraft) return;
      const perf = {
        __adminId: `perf-${nextPerfId++}`,
        date: "",
        title: campaignDraft.title || "Campaign event",
        startTime: campaignDraft.time?.replace(/\s*(AM|PM)/i, "") ? "18:00" : "18:30",
        endTime: "21:30",
        category: campaignDraft.category || "special",
        note: campaignDraft.description || "",
      };
      eventsData.performances.push(perf);
      sessionStorage.removeItem("ws_event_draft_from_campaign");
      campaignDraft = null;
      panel.querySelector(".admin-campaign-promote-banner")?.remove();
      panel._markUnsaved?.();
      openEventsDayModal(new Date().toISOString().slice(0, 10), { expandAdd: true, addType: "one-off" });
      pushEventsDraft();
    });

    panel.querySelector("#dismiss-campaign-draft")?.addEventListener("click", () => {
      sessionStorage.removeItem("ws_event_draft_from_campaign");
      campaignDraft = null;
      panel.querySelector(".admin-campaign-promote-banner")?.remove();
    });

    panel._getEvents = collectFromPanel;
    panel._getPromos = (base) => {
      const out = JSON.parse(JSON.stringify(base || promosData));
      out.eventsPageFeatured = promosData.eventsPageFeatured || [];
      if (base?.homepageFeatured) out.homepageFeatured = base.homepageFeatured;
      return out;
    };
    panel._collectEventsSite = (siteBase) => {
      syncEventsPageFromScope();
      const out = JSON.parse(JSON.stringify(siteBase || baseSite));
      out.pages = siteData.pages;
      out.heroes = { ...out.heroes, events: siteData.heroes.events };
      return out;
    };
    panel._refreshPagePreview = refreshEventsPreview;
    window.addEventListener("message", handlePreviewMessage);
    if (window.WSAdminPreviewFrame) WSAdminPreviewFrame.bind(panel.querySelector("#events-page-iframe"));
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
  function renderMenus(panel, data, images) {
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
      const scope =
        modalRoot?.querySelector("#menu-items") || modalRoot?.querySelector("[data-photo-group^='menu-panel-']")
          ? modalRoot
          : panel;
      if (!scope.querySelector("#menu-items") && !scope.querySelector("[data-photo-group^='menu-panel-']")) return;
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
        subtitle: "Edit section photo and menu items. The draft preview updates as you type.",
        wide: true,
        bodyHtml: `
          ${photoGroupHtml({
            groupId: `menu-panel-${menuIdx}`,
            fieldName: `menu.${menuIdx}.image`,
            groupData: { image: menu.image, paths: menu.imagePaths, excludedPaths: menu.excludedPaths },
            imagesData: images,
            tags: ["food", "menu", "gallery", "drinks", "bar"],
            label: "Menu section photo",
            skipAlt: true,
          })}
          <div id="menu-items"></div>`,
        footerHtml: `
          <button type="button" class="btn btn-outline admin-btn-sm" id="modal-add-menu-item">+ Add item</button>
          <button type="button" class="btn btn-primary admin-btn-sm" data-admin-modal-close>Done</button>`,
        onMount: (root) => {
          bindPhotoGroups(root, images, scheduleMenuPreview);
          const container = root.querySelector("#menu-items");
          container.innerHTML = (cat.items || []).map((item, i) =>
            menuItemRow({ ...item, __rowKey: item.__rowKey || `ex-${i}` }, images)
          ).join("");
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
            container.insertAdjacentHTML(
              "afterbegin",
              menuItemRow({ name: "", desc: "", price: "", __rowKey: `new-${Date.now()}` }, images)
            );
            bindRemove(root);
            root.querySelectorAll("[data-remove-item]").forEach((btn) => {
              btn.onclick = () => {
                btn.closest("[data-menu-item]")?.remove();
                renderMenuDraftPreview();
                panel._markUnsaved?.();
              };
            });
            const row = container.firstElementChild;
            row?.querySelector('[data-field="name"]')?.focus();
            row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
            renderMenuDraftPreview();
          });
          panel.dataset.syncedMenuIdx = String(menuIdx);
          panel.dataset.syncedCatIdx = String(catIdx);
        },
        onClose: () => {
          const modalRoot = document.getElementById("admin-modal-root");
          const modalBody = modalRoot?.querySelector(".admin-modal__body");
          if (modalBody) {
            menusData = syncMenuSection(modalBody, menusData, menuIdx, catIdx);
            menus = menusData.menus;
          }
          const modalItems = modalRoot?.querySelector("#menu-items");
          if (modalItems) {
            const cat = menus[menuIdx]?.categories?.[catIdx];
            if (cat) {
              const items = [];
              modalItems.querySelectorAll("[data-menu-item]").forEach((row) => {
                const item = readMenuItemFromRow(row);
                if (item) items.push(item);
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
      <p class="admin-note">Update item names, descriptions, and prices. <strong>Legacy editor</strong> — Toast will sync menu prices later. Click a menu item in the preview to edit it. <em>Save changes</em> keeps the draft on this device; <em>Publish live</em> updates the public site.</p>
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

  function menuItemRow(item, images) {
    const rowKey = item.__rowKey || `row-${Math.random().toString(36).slice(2, 9)}`;
    const photoHtml = images
      ? photoGroupHtml({
          groupId: `menu-item-${rowKey}`,
          fieldName: `menuItem.${rowKey}.image`,
          groupData: {
            image: item.image,
            paths: item.imagePaths,
            excludedPaths: item.excludedPaths,
          },
          imagesData: images,
          tags: ["food", "menu", "gallery", "drinks", "bar"],
          label: "Thumbnail (optional)",
          skipAlt: true,
        })
      : "";
    return `
      <div class="admin-list-item admin-menu-item-row" data-menu-item>
        <div class="admin-list-item-head">
          <strong>${esc(item.name || "New item")}</strong>
          <button type="button" class="btn btn-outline admin-btn-sm" data-remove-item>Remove</button>
        </div>
        <div class="admin-form-grid cols-2">
          ${field("Name", `<input data-field="name" value="${esc(item.name)}" />`)}
          ${field("Price", `<input data-field="price" value="${esc(item.price || "")}" placeholder="$9.90" />`)}
          ${field("Description", `<textarea data-field="desc" rows="2">${esc(item.desc || "")}</textarea>`)}
        </div>
        ${photoHtml}
      </div>`;
  }

  function readMenuItemFromRow(row) {
    const name = rowVal(row, "name");
    if (!name) return null;
    const item = { name };
    const desc = rowVal(row, "desc");
    const price = rowVal(row, "price");
    if (desc) item.desc = desc;
    if (price) item.price = price;
    const group = row.querySelector("[data-photo-group]");
    if (group) {
      const g = readPhotoGroup(group);
      if (g.active) item.image = g.active;
      if (g.paths?.length) item.imagePaths = g.paths;
      if (g.excluded?.length) item.excludedPaths = g.excluded;
    }
    return item;
  }

  function syncMenuSection(scope, menus, menuIdx, catIdx) {
    const out = JSON.parse(JSON.stringify(menus));
    if (!scope?.querySelector("#menu-items") && !scope?.querySelector("[data-photo-group^='menu-panel-']")) return out;
    const mIdx = menuIdx ?? Number(scope.querySelector("#menu-select")?.value || 0);
    const cIdx = catIdx ?? Number(scope.querySelector("#cat-select")?.value || 0);
    const menuPanelGroup = scope.querySelector(`[data-photo-group="menu-panel-${mIdx}"]`);
    if (menuPanelGroup && out.menus?.[mIdx]) {
      const g = readPhotoGroup(menuPanelGroup);
      out.menus[mIdx].image = g.active;
      out.menus[mIdx].imagePaths = g.paths;
      out.menus[mIdx].excludedPaths = g.excluded;
    }
    const cat = out.menus?.[mIdx]?.categories?.[cIdx];
    if (!cat || !scope.querySelector("#menu-items")) return out;

    const items = [];
    scope.querySelectorAll("#menu-items [data-menu-item]").forEach((row) => {
      const item = readMenuItemFromRow(row);
      if (item) items.push(item);
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
        ${photoGroupHtml({
          groupId: "promo-image",
          fieldName: "image",
          groupData: { image: p.image, paths: p.imagePaths, excludedPaths: p.excludedPaths },
          imagesData: imagesData,
          tags: PROMO_IMAGE_TAGS,
          label: "Photo",
          skipAlt: true,
        })}
        <input type="hidden" data-field="mediaType" value="${esc(p.mediaType || "image")}" />
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
      imagePaths: draft.imagePaths || orig.imagePaths,
      excludedPaths: draft.excludedPaths || orig.excludedPaths,
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
          bindPhotoGroups(root, images, onChange);
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
      iframe.src = `events.html?promoPreview=1&_=${Date.now()}`;
    }

    panel.innerHTML = `
      <p class="admin-note"><strong>Featured promo cards</strong> on the events page — photo tiles for weekly/monthly happenings. The preview shows the full events page; scroll to recurring favorites or use <em>Manage promo cards</em> to edit.</p>
      <p style="color:var(--text-muted);font-size:0.9rem;margin:0.75rem 0 1rem">${esc(PROMO_PLACEMENTS.events.hint)}</p>
      <div class="admin-draft-full">
        <div class="admin-draft-full__toolbar">
          <div>
            <p class="admin-preview-label">Events page preview</p>
            <p>Promo cards appear in Recurring favorites — same page as the calendar.</p>
          </div>
          <div class="admin-draft-full__toolbar-actions">
            <button type="button" class="btn btn-outline admin-btn-sm" id="manage-promos">Manage promo cards</button>
            <button type="button" class="btn btn-primary admin-btn-sm" id="add-promo">+ Add promo card</button>
          </div>
        </div>
        <iframe id="promo-page-iframe" class="admin-preview-frame" title="Events page preview" src="events.html?promoPreview=1"></iframe>
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
    const siteBase = JSON.parse(JSON.stringify(site));
    let promosData = JSON.parse(JSON.stringify(promos || { homepageFeatured: [], eventsPageFeatured: [] }));
    let previewTimer = null;

    const homepageModalMap = {
      welcome: { title: "Homepage welcome text", id: "homepage-welcome-editor" },
      promos: { title: "Weekly & monthly happenings", id: "homepage-promos-editor" },
      gallery: { title: "Main Street vibes — gallery", id: "homepage-gallery-editor" },
      signatures: { title: "Signature favorites", id: "homepage-signatures-editor" },
      faq: { title: "Good to know — FAQ", id: "homepage-faq-editor" },
    };

    function syncOpenHomepageModalToPanel() {
      const modalBody = document.getElementById("admin-modal-root")?.querySelector(".admin-modal__body");
      if (!modalBody) return;
      for (const cfg of Object.values(homepageModalMap)) {
        const block = panel.querySelector(`#${cfg.id}`);
        if (!block) continue;
        const isOpen =
          cfg.id === "homepage-welcome-editor"
            ? modalBody.querySelector('[data-field="heroes.index.eyebrow"]')
            : modalBody.querySelector("#gallery-rows, #sig-rows, #faq-rows, #homepage-promo-list, #homepage-promo-editor");
        if (isOpen) {
          block.innerHTML = modalBody.innerHTML;
          break;
        }
      }
    }

    function notifyHomepagePromoFrame(iframe) {
      if (!iframe?.contentWindow) return false;
      try {
        iframe.contentWindow.postMessage({ type: "ws-promo-preview-refresh" }, window.location.origin);
        return true;
      } catch {
        return false;
      }
    }

    function pushHomepagePreview(reloadFrame) {
      syncOpenHomepageModalToPanel();
      const draft = collectHomepage(panel, siteBase);
      if (window.WSConfig) {
        WSConfig.savePreview("site", draft);
        WSConfig.savePreview("promos", promosData);
      }
      const iframe = panel.querySelector("#homepage-preview-iframe");
      if (!iframe || !reloadFrame) return;
      notifyHomepagePromoFrame(iframe);
      if (window.WSAdminPreviewFrame) WSAdminPreviewFrame.setSrc(iframe, "index.html", "homepagePreview=1&promoPreview=1");
      else iframe.src = `${window.WSAdminPreviewFrame?.normalizePreviewUrl("index.html") || "index.html"}?homepagePreview=1&promoPreview=1&adminFrame=homepage-preview-iframe&_=${Date.now()}`;
    }

    function scheduleHomepagePreview(immediate) {
      clearTimeout(previewTimer);
      if (immediate) {
        pushHomepagePreview(true);
        return;
      }
      previewTimer = setTimeout(() => pushHomepagePreview(true), 300);
    }

    panel.innerHTML = `
      <p class="admin-note">Edit homepage sections from the toolbar — the full-page preview below updates as you work. <em>Save changes</em> keeps the draft on this device; <em>Publish live</em> updates the public site.</p>
      <div class="admin-draft-full">
        <div class="admin-draft-full__toolbar">
          <div>
            <p class="admin-preview-label">Homepage preview</p>
            <p>Scroll the full page while you edit welcome text, happenings, gallery, signatures, and FAQ.</p>
          </div>
          <div class="admin-draft-full__toolbar-actions">
            <button type="button" class="btn btn-outline admin-btn-sm" data-homepage-modal="welcome">Welcome text</button>
            <button type="button" class="btn btn-outline admin-btn-sm" data-homepage-modal="promos">Happenings</button>
            <button type="button" class="btn btn-outline admin-btn-sm" data-homepage-modal="gallery">Gallery</button>
            <button type="button" class="btn btn-outline admin-btn-sm" data-homepage-modal="signatures">Signatures</button>
            <button type="button" class="btn btn-outline admin-btn-sm" data-homepage-modal="faq">FAQ</button>
          </div>
        </div>
        <iframe id="homepage-preview-iframe" class="admin-preview-frame" title="Homepage preview" src="about:blank"></iframe>
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

    const homepagePromoWorkflow = mountPromoEditorWorkflow(
      panel,
      promosData,
      "homepage",
      images,
      "homepage-promo-list",
      "homepage-promo-editor",
      "add-homepage-promo",
      scheduleHomepagePreview
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
            bindPhotoGroups(root, images, () => scheduleHomepagePreview(false));
            bindImagePickers(root, () => scheduleHomepagePreview(false));
            bindRemove(root);
            root.addEventListener("input", (e) => {
              if (e.target.matches("[data-field]")) scheduleHomepagePreview(false);
            });
            root.addEventListener("change", (e) => {
              if (e.target.matches("[data-field]")) scheduleHomepagePreview(false);
            });
            root.querySelector("#add-gallery")?.addEventListener("click", () => {
              const rows = root.querySelector("#gallery-rows");
              rows.insertAdjacentHTML(
                "beforeend",
                galleryRow({ caption: "", alt: "", image: "assets/gallery/WSGoodTimes.webp" }, rows.children.length, images)
              );
              const newGroup = rows.lastElementChild?.querySelector("[data-photo-group]");
              if (newGroup) {
                const tags = newGroup.dataset.photoTags ? JSON.parse(newGroup.dataset.photoTags) : ["gallery", "food", "drinks", "music", "ambiance"];
                refreshPhotoGroupPicker(newGroup, images, tags);
              }
              bindRemove(root);
            });
            root.querySelector("#add-sig")?.addEventListener("click", () => {
              const rows = root.querySelector("#sig-rows");
              rows.insertAdjacentHTML(
                "beforeend",
                sigRow({ title: "", summary: "", image: "assets/gallery/WSFood.webp", ctaLabel: "View menu", ctaHref: "menu.html" }, rows.children.length, images)
              );
              const newGroup = rows.lastElementChild?.querySelector("[data-photo-group]");
              if (newGroup) {
                const tags = newGroup.dataset.photoTags ? JSON.parse(newGroup.dataset.photoTags) : ["food", "gallery", "menu", "signature"];
                refreshPhotoGroupPicker(newGroup, images, tags);
              }
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
            bindPhotoGroups(panel, images, () => scheduleHomepagePreview(false));
            bindImagePickers(panel);
            bindRemove(panel);
            scheduleHomepagePreview(true);
          },
        });
      });
    });

    bindPhotoGroups(panel, images, () => scheduleHomepagePreview(false));
    bindImagePickers(panel);
    bindRemove(panel);
    panel._getHomepagePromos = (base) => {
      const out = JSON.parse(JSON.stringify(base || promosData));
      out.homepageFeatured = promosData.homepageFeatured || [];
      return out;
    };
    panel._refreshPagePreview = () => pushHomepagePreview(true);
    if (window.WSAdminPreviewFrame) WSAdminPreviewFrame.bind(panel.querySelector("#homepage-preview-iframe"));
    pushHomepagePreview(true);
  }

  function galleryRow(g, i, images) {
    return `
      <div class="admin-list-item" data-gallery="${i}">
        <div class="admin-form-grid cols-2">
          ${field("Caption", `<input data-field="gal.${i}.caption" value="${esc(g.caption)}" />`)}
        </div>
        ${photoGroupHtml({
          groupId: `hp-gal-${i}`,
          fieldName: `gal.${i}.image`,
          groupData: { image: g.image, alt: g.alt, paths: g.paths, excludedPaths: g.excludedPaths },
          imagesData: images,
          tags: ["gallery", "food", "drinks", "music", "ambiance"],
          label: `Gallery photo ${Number(i) + 1}`,
          altDataField: `gal.${i}.alt`,
        })}
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
        ${photoGroupHtml({
          groupId: `hp-sig-${i}`,
          fieldName: `sig.${i}.image`,
          groupData: { image: c.image, alt: c.title, paths: c.imagePaths, excludedPaths: c.excludedPaths },
          imagesData: images,
          tags: ["food", "gallery", "menu", "signature"],
          label: "Photo",
          altDataField: `sig.${i}.alt`,
        })}
      </div>`;
  }

  function statsRow(s, i) {
    return `
      <div class="admin-list-item" data-stat="${i}">
        <div class="admin-list-item-head"><strong>Stat ${Number(i) + 1}</strong></div>
        ${field("Value", `<input data-field="stats.${i}.value" value="${esc(s.value)}" />`)}
        ${field("Label", `<input data-field="stats.${i}.label" value="${esc(s.label)}" />`)}
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
    out.heroes.index.titleLine1 = val(panel, "heroes.index.titleLine1");
    out.heroes.index.titleLine2 = val(panel, "heroes.index.titleLine2");
    out.heroes.index.tagline = val(panel, "heroes.index.tagline");
    out.heroes.index.lead = val(panel, "heroes.index.lead");
    ["happyHour", "contact"].forEach((key) => {
      out.heroes[key] = out.heroes[key] || {};
      ["eyebrow", "titleLine1", "lead"].forEach((field) => {
        const el = panel.querySelector(`[data-field="heroes.${key}.${field}"]`);
        if (el) out.heroes[key][field] = el.value.trim();
      });
    });
    out.homepage = out.homepage || {};

    out.stats = [];
    panel.querySelectorAll("[data-stat]").forEach((row) => {
      const i = row.dataset.stat;
      const base = (site.stats || [])[i] || {};
      out.stats.push({
        id: base.id || `stat-${i}`,
        value: val(panel, `stats.${i}.value`),
        label: val(panel, `stats.${i}.label`),
      });
    });
    if (!out.stats.length && site.stats?.length) out.stats = JSON.parse(JSON.stringify(site.stats));

    if (site.pages) {
      out.pages = JSON.parse(JSON.stringify({ ...(out.pages || {}), ...site.pages }));
    }

    out.homepage.gallery = [];
    panel.querySelectorAll("[data-gallery]").forEach((row) => {
      const i = row.dataset.gallery;
      const caption = val(panel, `gal.${i}.caption`);
      if (!caption) return;
      const group = row.querySelector("[data-photo-group]");
      const g = group ? readPhotoGroup(group) : { active: val(panel, `gal.${i}.image`), paths: [], excluded: [] };
      out.homepage.gallery.push({
        image: g.active,
        paths: g.paths,
        excludedPaths: g.excluded,
        caption,
        alt: val(panel, `gal.${i}.alt`) || caption,
      });
    });

    out.homepage.signatureCards = [];
    panel.querySelectorAll("[data-sig]").forEach((row) => {
      const i = row.dataset.sig;
      const title = val(panel, `sig.${i}.title`);
      if (!title) return;
      const group = row.querySelector("[data-photo-group]");
      const g = group ? readPhotoGroup(group) : { active: val(panel, `sig.${i}.image`), paths: [], excluded: [] };
      out.homepage.signatureCards.push({
        title,
        summary: val(panel, `sig.${i}.summary`),
        image: g.active,
        imagePaths: g.paths,
        excludedPaths: g.excluded,
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
      const inModal =
        modalRoot?.querySelector(`[data-photo-group="hero-${activePage}-0"]`) ||
        modalRoot?.querySelector(`[data-field="hero.${activePage}.0"]`);
      const scope = inModal ? modalRoot : panel;
      heroesData[activePage].panels = [0, 1, 2, 3].map((i) => readHeroPanelValue(scope, activePage, i));
      syncHeroPhotoMeta(activePage, scope, heroesData[activePage]);
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
      const pageUrl = window.WSAdminPreviewFrame?.normalizePreviewUrl(pl.url) || pl.url;
      const base = `${pageUrl}?heroPreview=1`;
      if (openLink) openLink.href = pl.url;
      if (reload) iframe.src = `${base}&_=${Date.now()}`;
    }

    function openHeroEditorModal() {
      const pl = HERO_PAGES.find((p) => p.key === activePage);
      openAdminModal({
        title: `${pl?.label || "Page"} hero photos`,
        subtitle: "Pick four rotating hero images for this page",
        wide: true,
        bodyHtml: heroPanelsEditorHtml(activePage, heroesData, images),
        footerHtml: `<button type="button" class="btn btn-primary admin-btn-sm" data-admin-modal-close>Done</button>`,
        onMount: (root) => {
          bindPhotoGroups(root, images, scheduleHeroPreview);
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
      out.heroes[key].panels = [0, 1, 2, 3].map((i) => readHeroPanelValue(panel, key, i));
      syncHeroPhotoMeta(key, panel, out.heroes[key]);
    });
    return out;
  }

  /* ——— Other pages (click-to-edit draft preview) ——— */
  const EDIT_PAGES = [
    { id: "index", label: "Homepage", url: "index.html", query: "pageEditPreview=1&homepagePreview=1&promoPreview=1" },
    { id: "order", label: "Order", url: "order.html", query: "pageEditPreview=1" },
    { id: "happyHour", label: "Happy Hour", url: "happy-hour.html", query: "pageEditPreview=1", heroKey: "happyHour" },
    { id: "about", label: "Our Story", url: "about.html", query: "pageEditPreview=1" },
    { id: "contact", label: "Visit / Contact", url: "contact.html", query: "pageEditPreview=1", heroKey: "contact" },
    { id: "menu", label: "Menu page", url: "menu.html", query: "pageEditPreview=1", heroKey: "menu" },
    { id: "privateEvents", label: "Private Events", url: "private-events.html", query: "pageEditPreview=1" },
  ];

  function heroTextEditorHtml(heroKey, hero) {
    return `
      <div class="admin-form-grid">
        ${field("Eyebrow", `<input data-field="heroes.${heroKey}.eyebrow" value="${esc(hero?.eyebrow || "")}" />`)}
        ${field("Headline", `<input data-field="heroes.${heroKey}.titleLine1" value="${esc(hero?.titleLine1 || "")}" />`)}
        ${field("Intro", `<textarea data-field="heroes.${heroKey}.lead" rows="3">${esc(hero?.lead || "")}</textarea>`)}
      </div>`;
  }

  const PAGE_SECTION_MODALS = {
    "hero-text": { title: "Welcome text", blockId: "pages-welcome-editor" },
    stats: { title: "Homepage stats bar", blockId: "pages-stats-editor" },
    promos: { title: "Weekly & monthly happenings", blockId: "pages-promos-editor" },
    gallery: { title: "Main Street vibes — gallery", blockId: "pages-gallery-editor" },
    signatures: { title: "Signature favorites", blockId: "pages-signatures-editor" },
    faq: { title: "Good to know — FAQ", blockId: "pages-faq-editor" },
  };

  function heroPhotoGroupHtml(heroKey, index, src, images, tags = ["hero", "gallery"], heroEntry = {}) {
    const panelPaths = heroEntry.panelPaths?.[index];
    const panelExcluded = heroEntry.panelExcluded?.[index];
    return photoGroupHtml({
      groupId: `hero-${heroKey}-${index}`,
      fieldName: `hero.${heroKey}.${index}`,
      groupData: {
        src: src || "",
        paths: panelPaths?.length ? panelPaths : src ? [src] : [],
        excluded: panelExcluded || [],
      },
      imagesData: images,
      tags,
      label: `Photo ${Number(index) + 1}`,
      skipAlt: true,
    });
  }

  function heroPanelsEditorHtml(heroKey, heroes, images, tags = ["hero", "gallery"]) {
    const entry = heroes[heroKey] || {};
    const panels = entry.panels || ["", "", "", ""];
    return [0, 1, 2, 3].map((i) => heroPhotoGroupHtml(heroKey, i, panels[i] || "", images, tags, entry)).join("");
  }

  function readHeroPhotoGroup(scope, heroKey, index) {
    const group = scope.querySelector(`[data-photo-group="hero-${heroKey}-${index}"]`);
    if (group) return readPhotoGroup(group);
    return {
      active: scope.querySelector(`[data-field="hero.${heroKey}.${index}"]`)?.value.trim() || "",
      paths: [],
      excluded: [],
      alt: "",
    };
  }

  function readHeroPanelValue(scope, heroKey, index) {
    return readHeroPhotoGroup(scope, heroKey, index).active;
  }

  function syncHeroPhotoMeta(heroKey, scope, target) {
    target.panelPaths = [0, 1, 2, 3].map((i) => readHeroPhotoGroup(scope, heroKey, i).paths);
    target.panelExcluded = [0, 1, 2, 3].map((i) => readHeroPhotoGroup(scope, heroKey, i).excluded);
  }

  function renderPages(panel, site, images, promos) {
    const activePageId = panel.dataset.activePageId || "index";
    const siteBase = JSON.parse(JSON.stringify(site));
    let siteData = JSON.parse(JSON.stringify(site));
    siteData.pages = siteData.pages || {};
    let promosData = JSON.parse(JSON.stringify(promos || { homepageFeatured: [], eventsPageFeatured: [] }));
    let previewTimer = null;
    let pagesPromoWorkflow = null;
    const hp = siteData.homepage || {};
    const heroes = siteData.heroes || {};

    function syncHeroKey(heroKey, scope = panel) {
      if (!heroKey) return;
      siteData.heroes = siteData.heroes || {};
      siteData.heroes[heroKey] = siteData.heroes[heroKey] || { panels: ["", "", "", ""] };
      siteData.heroes[heroKey].panels = [0, 1, 2, 3].map((i) => readHeroPanelValue(scope, heroKey, i));
      syncHeroPhotoMeta(heroKey, scope, siteData.heroes[heroKey]);
    }

    function syncAllHeroes(scope = panel) {
      ["index", "happyHour", "contact", "menu"].forEach((key) => syncHeroKey(key, scope));
    }

    function pushPagePreview(reloadFrame) {
      syncAllHeroes();
      const draftSite = collectHomepage(panel, {
        ...siteBase,
        heroes: siteData.heroes,
        pages: siteData.pages,
        stats: siteData.stats || siteBase.stats,
      });
      if (window.WSConfig) {
        WSConfig.savePreview("site", draftSite);
        WSConfig.savePreview("promos", promosData);
      }
      const iframe = panel.querySelector("#other-page-iframe");
      if (!iframe || !reloadFrame) return;
      try {
        iframe.contentWindow?.postMessage({ type: "ws-promo-preview-refresh" }, window.location.origin);
      } catch {
        /* ignore */
      }
      const cfg = EDIT_PAGES.find((p) => p.id === (panel.dataset.activePageId || "index")) || EDIT_PAGES[0];
      if (window.WSAdminPreviewFrame) WSAdminPreviewFrame.setSrc(iframe, cfg.url, cfg.query);
    }

    function schedulePagePreview(immediate) {
      clearTimeout(previewTimer);
      if (immediate) pushPagePreview(true);
      else previewTimer = setTimeout(() => pushPagePreview(true), 300);
    }

    function openHomepageBlock(blockId, title, onMountExtra) {
      const block = panel.querySelector(`#${blockId}`);
      if (!block) return;
      openAdminModal({
        title,
        wide: true,
        bodyHtml: block.innerHTML,
        footerHtml: `<button type="button" class="btn btn-primary admin-btn-sm" data-admin-modal-close>Done</button>`,
        onMount: (root) => {
          bindPhotoGroups(root, images, () => schedulePagePreview(false));
          bindImagePickers(root, () => schedulePagePreview(false));
          bindRemove(root);
          root.addEventListener("input", (e) => {
            if (e.target.matches("[data-field]")) schedulePagePreview(false);
          });
          onMountExtra?.(root);
        },
        onClose: () => {
          const body = document.getElementById("admin-modal-root")?.querySelector(".admin-modal__body");
          if (body) block.innerHTML = body.innerHTML;
          bindPhotoGroups(panel, images, () => schedulePagePreview(false));
          bindImagePickers(panel);
          bindRemove(panel);
          schedulePagePreview(true);
        },
      });
    }

    function openHeroPhotosModal(heroKey, label) {
      const block = panel.querySelector(`#pages-hero-editor-${heroKey}`);
      if (!block) return;
      openAdminModal({
        title: `${label} — hero photos`,
        subtitle: "Pick four rotating hero images",
        wide: true,
        bodyHtml: block.innerHTML,
        footerHtml: `<button type="button" class="btn btn-primary admin-btn-sm" data-admin-modal-close>Done</button>`,
        onMount: (root) => bindPhotoGroups(root, images, () => schedulePagePreview(false)),
        onClose: () => {
          const body = document.getElementById("admin-modal-root")?.querySelector(".admin-modal__body");
          if (body) block.innerHTML = body.innerHTML;
          syncHeroKey(heroKey);
          schedulePagePreview(true);
        },
      });
    }

    function openPageHeroModal(pageId, label) {
      const hero = siteData.pages[pageId]?.hero || siteBase.pages?.[pageId]?.hero || {};
      openAdminModal({
        title: `${label} — page hero`,
        bodyHtml: `
          ${field("Eyebrow (optional)", `<input data-field="pages.${pageId}.hero.eyebrow" value="${esc(hero.eyebrow || "")}" />`)}
          ${field("Title", `<input data-field="pages.${pageId}.hero.title" value="${esc(hero.title || "")}" />`)}
          ${field("Intro", `<textarea data-field="pages.${pageId}.hero.lead" rows="3">${esc(hero.lead || "")}</textarea>`)}`,
        footerHtml: `<button type="button" class="btn btn-primary admin-btn-sm" data-admin-modal-close>Done</button>`,
        onMount: (root) => {
          root.addEventListener("input", (e) => {
            if (!e.target.matches("[data-field]")) return;
            siteData.pages[pageId] = siteData.pages[pageId] || {};
            siteData.pages[pageId].hero = siteData.pages[pageId].hero || {};
            const field = e.target.dataset.field.split(".").pop();
            siteData.pages[pageId].hero[field] = e.target.value.trim();
            schedulePagePreview(false);
          });
        },
        onClose: () => schedulePagePreview(true),
      });
    }

    function getBlockData(pageId, blockId) {
      siteData.pages[pageId] = siteData.pages[pageId] || {};
      siteData.pages[pageId].blocks = siteData.pages[pageId].blocks || {};
      if (siteData.pages[pageId].blocks[blockId]) {
        return JSON.parse(JSON.stringify(siteData.pages[pageId].blocks[blockId]));
      }
      const iframe = panel.querySelector("#other-page-iframe");
      try {
        const el = iframe?.contentDocument?.querySelector(`[data-admin-block="${blockId}"]`);
        const scraped = el && iframe.contentWindow.WSPageBlocks?.scrapeBlock(el, blockId);
        if (scraped) {
          siteData.pages[pageId].blocks[blockId] = scraped;
          return JSON.parse(JSON.stringify(scraped));
        }
      } catch {
        /* iframe not ready */
      }
      return {};
    }

    function saveBlockData(pageId, blockId, data) {
      siteData.pages[pageId] = siteData.pages[pageId] || {};
      siteData.pages[pageId].blocks = siteData.pages[pageId].blocks || {};
      siteData.pages[pageId].blocks[blockId] = data;
    }

    const BLOCK_LABELS = {
      intro: "Section heading",
      stats: "Stats row",
      feature: "Feature block",
      card: "Card",
      orderCard: "Partner card",
      split: "Text & photos",
      gallery: "Photo gallery",
      detail: "Info block",
      fine: "Note text",
      cta: "Call to action",
      section: "Section",
    };

    function pageBlockStatsEditor(data, prefix) {
      const items = data.items || [{ value: "", label: "" }];
      return items
        .map(
          (s, i) => `
        <div class="admin-list-item" data-block-stat="${i}">
          ${field("Value", `<input data-block-field="${prefix}.items.${i}.value" value="${esc(s.value || "")}" />`)}
          ${field("Label", `<input data-block-field="${prefix}.items.${i}.label" value="${esc(s.label || "")}" />`)}
        </div>`
        )
        .join("");
    }

    function galleryRowWithPrefix(g, i, images, prefix) {
      return `
      <div class="admin-list-item" data-block-gallery="${i}">
        ${field("Caption", `<input data-block-field="${prefix}.items.${i}.caption" value="${esc(g.caption || "")}" />`)}
        ${photoGroupHtml({
          groupId: `gallery-${i}`,
          fieldName: `${prefix}.items.${i}.image`,
          groupData: { image: g.image, alt: g.alt, paths: g.paths, excludedPaths: g.excludedPaths },
          imagesData: images,
          tags: ["gallery", "food", "hero"],
          label: `Photo ${Number(i) + 1}`,
          altBlockField: `${prefix}.items.${i}.alt`,
        })}
      </div>`;
    }

    function openPageBlockModal(pageId, blockId, blockType) {
      const cfg = EDIT_PAGES.find((p) => p.id === pageId) || EDIT_PAGES[0];
      const type = blockType || "section";
      const data = getBlockData(pageId, blockId);
      const label = BLOCK_LABELS[type] || "Section";
      let bodyHtml = "";

      if (type === "intro" || type === "cta" || type === "section") {
        bodyHtml = `
          ${field("Heading", `<input data-block-field="title" value="${esc(data.title || "")}" />`)}
          ${field("Body", `<textarea data-block-field="body" rows="4">${esc(data.body || "")}</textarea>`)}`;
      } else if (type === "stats") {
        bodyHtml = `<div id="block-stats-rows">${pageBlockStatsEditor(data, "stats")}</div>`;
      } else if (type === "feature") {
        bodyHtml = `
          ${field("Tag", `<input data-block-field="tag" value="${esc(data.tag || "")}" />`)}
          ${field("Title", `<input data-block-field="title" value="${esc(data.title || "")}" />`)}
          ${field("Body", `<textarea data-block-field="body" rows="3">${esc(data.body || "")}</textarea>`)}
          ${field("Bullet points (one per line)", `<textarea data-block-field="bulletsText" rows="4">${esc((data.bullets || []).join("\n"))}</textarea>`)}
          ${photoGroupHtml({
            groupId: "feature",
            fieldName: "featureImage",
            groupData: { src: data.image, alt: data.imageAlt, paths: data.imagePaths, excludedPaths: data.excludedPaths },
            imagesData: images,
            tags: ["food", "gallery", "hero"],
            label: "Photo",
            altBlockField: "imageAlt",
          })}
          ${field("Button label", `<input data-block-field="ctaLabel" value="${esc(data.ctaLabel || "")}" />`)}
          ${field("Button link", `<input data-block-field="ctaHref" value="${esc(data.ctaHref || "")}" />`)}`;
      } else if (type === "card") {
        bodyHtml = `
          ${field("Title", `<input data-block-field="title" value="${esc(data.title || "")}" />`)}
          ${field("Body", `<textarea data-block-field="body" rows="3">${esc(data.body || "")}</textarea>`)}
          ${photoGroupHtml({
            groupId: "card",
            fieldName: "cardImage",
            groupData: { src: data.image, alt: data.imageAlt, paths: data.imagePaths, excludedPaths: data.excludedPaths },
            imagesData: images,
            tags: ["gallery", "food", "hero"],
            label: "Photo",
            altBlockField: "imageAlt",
          })}
          ${field("Button label", `<input data-block-field="ctaLabel" value="${esc(data.ctaLabel || "")}" />`)}
          ${field("Button link", `<input data-block-field="ctaHref" value="${esc(data.ctaHref || "")}" />`)}
          ${field("Tags (comma separated)", `<input data-block-field="tagsText" value="${esc((data.tags || []).join(", "))}" />`)}`;
      } else if (type === "orderCard") {
        bodyHtml = `
          ${field("Label", `<input data-block-field="label" value="${esc(data.label || "")}" />`)}
          ${field("Title", `<input data-block-field="title" value="${esc(data.title || "")}" />`)}
          ${field("Body", `<textarea data-block-field="body" rows="2">${esc(data.body || "")}</textarea>`)}
          ${field("Link URL", `<input data-block-field="href" value="${esc(data.href || "")}" />`)}
          ${field("Link text", `<input data-block-field="cta" value="${esc(data.cta || "")}" />`)}`;
      } else if (type === "split") {
        const imgs = data.images?.length ? data.images : [{ src: "", alt: "" }];
        bodyHtml = `
          ${field("Heading", `<input data-block-field="title" value="${esc(data.title || "")}" />`)}
          ${field("Body paragraphs (blank line between)", `<textarea data-block-field="body" rows="5">${esc(data.body || "")}</textarea>`)}
          ${field("Bullet points (one per line)", `<textarea data-block-field="bulletsText" rows="4">${esc((data.bullets || []).join("\n"))}</textarea>`)}
          <div id="block-split-photo-rows">${imgs.map((img, i) => splitPhotoRow(img, i, images)).join("")}</div>
          ${sectionAddPhotoToolbarHtml("block-add-split-photo")}`;
      } else if (type === "gallery") {
        bodyHtml = `
          <div id="block-gallery-rows">${(data.items || []).map((g, i) => galleryRowWithPrefix(g, i, images, "gallery")).join("")}</div>
          ${sectionAddPhotoToolbarHtml("block-add-gallery")}`;
      } else if (type === "detail") {
        bodyHtml = `
          ${field("Heading", `<input data-block-field="title" value="${esc(data.title || "")}" />`)}
          ${field("Body", `<textarea data-block-field="body" rows="4">${esc(data.body || "")}</textarea>`)}`;
      } else if (type === "fine") {
        bodyHtml = field("Text (HTML allowed)", `<textarea data-block-field="body" rows="3">${esc(data.body || "")}</textarea>`);
      }

      function collectBlockFromForm(root, bType, base) {
        const out = { ...base };
        root.querySelectorAll("[data-block-field]").forEach((input) => {
          const key = input.dataset.blockField;
          if (key === "title") out.title = input.value.trim();
          else if (key === "body") out.body = input.value.trim();
          else if (key === "tag") out.tag = input.value.trim();
          else if (key === "imageAlt") out.imageAlt = input.value.trim();
          else if (key === "ctaLabel") out.ctaLabel = input.value.trim();
          else if (key === "ctaHref") out.ctaHref = input.value.trim();
          else if (key === "label") out.label = input.value.trim();
          else if (key === "href") out.href = input.value.trim();
          else if (key === "cta") out.cta = input.value.trim();
          else if (key === "bulletsText") out.bullets = input.value.split("\n").map((s) => s.trim()).filter(Boolean);
          else if (key === "tagsText") out.tags = input.value.split(",").map((s) => s.trim()).filter(Boolean);
          else if (key.startsWith("stats.items.")) {
            out.items = out.items || [];
            const m = key.match(/stats\.items\.(\d+)\.(\w+)/);
            if (m) {
              out.items[Number(m[1])] = out.items[Number(m[1])] || {};
              out.items[Number(m[1])][m[2]] = input.value.trim();
            }
          } else if (key.startsWith("gallery.items.")) {
            out.items = out.items || [];
            const m = key.match(/gallery\.items\.(\d+)\.(\w+)/);
            if (m) {
              out.items[Number(m[1])] = out.items[Number(m[1])] || {};
              out.items[Number(m[1])][m[2]] = input.value.trim();
            }
          } else if (key.startsWith("images.")) {
            out.images = out.images || [];
            const m = key.match(/images\.(\d+)\.(\w+)/);
            if (m) {
              out.images[Number(m[1])] = out.images[Number(m[1])] || {};
              out.images[Number(m[1])][m[2]] = input.value.trim();
            }
          }
        });
        const featureGroup = root.querySelector('[data-photo-group="feature"]');
        if (featureGroup) {
          const fg = readPhotoGroup(featureGroup);
          out.image = fg.active;
          out.imageAlt = fg.alt;
          out.imagePaths = fg.paths;
          out.excludedPaths = fg.excluded;
        }
        const cardGroup = root.querySelector('[data-photo-group="card"]');
        if (cardGroup) {
          const cg = readPhotoGroup(cardGroup);
          out.image = cg.active;
          out.imageAlt = cg.alt;
          out.imagePaths = cg.paths;
          out.excludedPaths = cg.excluded;
        }
        if (bType === "split") {
          out.images = collectSplitPhotosFromRoot(root).map(({ src, alt, paths, excludedPaths }) => ({
            src,
            alt,
            paths,
            excludedPaths,
          }));
        }
        if (bType === "gallery") {
          out.items = collectGalleryBlockPhotosFromRoot(root, "gallery");
        }
        if (bType === "stats") {
          out.items = out.items || [];
        }
        return out;
      }

      openAdminModal({
        title: `${cfg.label} — ${label}`,
        wide: type === "gallery" || type === "split" || type === "feature" || type === "card",
        bodyHtml,
        footerHtml: `<button type="button" class="btn btn-primary admin-btn-sm" data-admin-modal-close>Done</button>`,
        onMount: (root) => {
          const syncBlock = () => {
            saveBlockData(pageId, blockId, collectBlockFromForm(root, type, data));
            schedulePagePreview(false);
          };
          bindPhotoGroups(root, images, syncBlock);
          bindImagePickers(root, syncBlock);
          bindRemove(root);
          root.addEventListener("input", (e) => {
            if (!e.target.matches("[data-block-field], [data-field]")) return;
            syncBlock();
          });
          if (type === "split") {
            bindPhotoSectionToolbar(root, {
              rowsEl: root.querySelector("#block-split-photo-rows"),
              addBtnId: "block-add-split-photo",
              renderRow: (row, i) => splitPhotoRow(row, i, images),
              defaultRow: () => ({ src: "", alt: "", paths: [] }),
              imagesData: images,
              onChanged: syncBlock,
            });
          }
          if (type === "gallery") {
            bindPhotoSectionToolbar(root, {
              rowsEl: root.querySelector("#block-gallery-rows"),
              addBtnId: "block-add-gallery",
              renderRow: (row, i) => galleryRowWithPrefix(row, i, images, "gallery"),
              defaultRow: () => ({ caption: "", alt: "", image: "", paths: [] }),
              imagesData: images,
              onChanged: syncBlock,
            });
          }
        },
        onClose: () => {
          const root = document.getElementById("admin-modal-root")?.querySelector(".admin-modal__body");
          if (root) {
            saveBlockData(pageId, blockId, collectBlockFromForm(root, type, getBlockData(pageId, blockId)));
          }
          schedulePagePreview(true);
        },
      });
    }

    function openPageSectionContentModal(pageId, sectionIndex) {
      const cfg = EDIT_PAGES.find((p) => p.id === pageId) || EDIT_PAGES[0];
      siteData.pages[pageId] = siteData.pages[pageId] || {};
      siteData.pages[pageId].sections = siteData.pages[pageId].sections || [];
      const sec = siteData.pages[pageId].sections[sectionIndex] || { title: "", body: "" };
      openAdminModal({
        title: `${cfg.label} — section ${sectionIndex + 1}`,
        bodyHtml: `
          ${field("Heading", `<input data-field="pages.${pageId}.sections.${sectionIndex}.title" value="${esc(sec.title || "")}" />`)}
          ${field("Body", `<textarea data-field="pages.${pageId}.sections.${sectionIndex}.body" rows="5">${esc(sec.body || "")}</textarea>`)}`,
        footerHtml: `<button type="button" class="btn btn-primary admin-btn-sm" data-admin-modal-close>Done</button>`,
        onMount: (root) => {
          root.addEventListener("input", (e) => {
            if (!e.target.matches("[data-field]")) return;
            siteData.pages[pageId].sections[sectionIndex] = siteData.pages[pageId].sections[sectionIndex] || {};
            const field = e.target.dataset.field.endsWith(".title") ? "title" : "body";
            siteData.pages[pageId].sections[sectionIndex][field] = e.target.value.trim();
            schedulePagePreview(false);
          });
        },
        onClose: () => schedulePagePreview(true),
      });
    }

    function openPageSectionModal(section, pageId) {
      const cfg = EDIT_PAGES.find((p) => p.id === pageId) || EDIT_PAGES[0];
      if (section === "hero-photos") {
        const heroKey = cfg.heroKey || (pageId === "index" ? "index" : null);
        if (heroKey) openHeroPhotosModal(heroKey, cfg.label);
        return;
      }
      if (section === "hero-text") {
        const heroKey = cfg.heroKey || (pageId === "index" ? "index" : null);
        if (!heroKey) return;
        if (heroKey === "index") {
          openHomepageBlock("pages-welcome-editor", "Welcome text");
        } else {
          openHomepageBlock(`pages-hero-text-${heroKey}`, `${cfg.label} — hero text`);
        }
        return;
      }
      if (section === "page-hero") {
        openPageHeroModal(pageId, cfg.label);
        return;
      }
      const secMatch = section.match(/^page-section-(\d+)$/);
      if (secMatch) {
        openPageSectionContentModal(pageId, Number(secMatch[1]));
        return;
      }
      const modalCfg = PAGE_SECTION_MODALS[section];
      if (!modalCfg) return;
      openHomepageBlock(modalCfg.blockId, modalCfg.title, (root) => {
        if (section === "promos") {
          root.querySelector("#pages-add-promo")?.addEventListener("click", () => pagesPromoWorkflow.openEditor(null));
        }
        if (section === "gallery") {
          root.querySelector("#pages-add-gallery")?.addEventListener("click", () => {
            const rows = root.querySelector("#pages-gallery-rows");
            rows.insertAdjacentHTML(
              "beforeend",
              galleryRow({ caption: "", alt: "", image: "assets/gallery/WSGoodTimes.webp" }, rows.children.length, images)
            );
            const newGroup = rows.lastElementChild?.querySelector("[data-photo-group]");
            if (newGroup) {
              const tags = newGroup.dataset.photoTags ? JSON.parse(newGroup.dataset.photoTags) : ["gallery", "food", "drinks", "music", "ambiance"];
              refreshPhotoGroupPicker(newGroup, images, tags);
            }
            bindRemove(root);
          });
        }
        if (section === "signatures") {
          root.querySelector("#pages-add-sig")?.addEventListener("click", () => {
            const rows = root.querySelector("#pages-sig-rows");
            rows.insertAdjacentHTML(
              "beforeend",
              sigRow({ title: "", summary: "", image: "assets/gallery/WSFood.webp", ctaLabel: "View menu", ctaHref: "menu.html" }, rows.children.length, images)
            );
            const newGroup = rows.lastElementChild?.querySelector("[data-photo-group]");
            if (newGroup) {
              const tags = newGroup.dataset.photoTags ? JSON.parse(newGroup.dataset.photoTags) : ["food", "gallery", "menu", "signature"];
              refreshPhotoGroupPicker(newGroup, images, tags);
            }
            bindRemove(root);
          });
        }
        if (section === "faq") {
          root.querySelector("#pages-add-faq")?.addEventListener("click", () => {
            root.querySelector("#pages-faq-rows")?.insertAdjacentHTML("beforeend", faqRow({ q: "", a: "" }));
            bindRemove(root);
          });
        }
      });
    }

    function handlePagePreviewMessage(event) {
      if (!panel.isConnected) {
        window.removeEventListener("message", handlePagePreviewMessage);
        return;
      }
      if (event.origin !== window.location.origin || event.data?.source !== "ws-page-preview") return;
      const payload = event.data;
      if (payload.type === "recover-preview") {
        pushPagePreview(true);
        return;
      }
      if (payload.type === "admin-nav" && payload.target) {
        window.dispatchEvent(new CustomEvent("ws-admin-switch-tab", { detail: { tab: payload.target } }));
        return;
      }
      if (payload.type === "switch-page" && payload.pageId) {
        panel.dataset.activePageId = payload.pageId;
        const pageSelect = panel.querySelector("#edit-page-select");
        if (pageSelect) pageSelect.value = payload.pageId;
        pushPagePreview(true);
        return;
      }
      if (payload.type === "promo" && pagesPromoWorkflow) {
        pagesPromoWorkflow.openEditor(payload.id || null);
        return;
      }
      if (payload.type === "block" && payload.blockId) {
        openPageBlockModal(
          payload.pageId || panel.dataset.activePageId || "index",
          payload.blockId,
          payload.blockType
        );
        return;
      }
      if (payload.type === "section") {
        openPageSectionModal(payload.section, payload.pageId || panel.dataset.activePageId || "index");
      }
    }

    panel.innerHTML = `
      <p class="admin-note">Click anything in the preview to edit it. Use the site menu at the top of the preview to jump between pages — header and footer aren't editable here. <em>Save draft</em> then <em>Publish live</em>.</p>
      <div class="admin-field admin-page-picker" style="margin-bottom:1rem">
        <label for="edit-page-select">Page</label>
        <select id="edit-page-select">
          ${EDIT_PAGES.map(
            (p) => `<option value="${esc(p.id)}"${p.id === activePageId ? " selected" : ""}>${esc(p.label)}</option>`
          ).join("")}
        </select>
      </div>
      <div class="admin-draft-full">
        <iframe id="other-page-iframe" class="admin-preview-frame" title="Page draft preview" src="about:blank"></iframe>
      </div>
      <div id="pages-hidden-editors" hidden>
        <div id="pages-welcome-editor">
          <div class="admin-form-grid">
            ${field("Location line", `<input data-field="heroes.index.eyebrow" value="${esc(heroes.index?.eyebrow)}" />`)}
            ${field("Title line 1", `<input data-field="heroes.index.titleLine1" value="${esc(heroes.index?.titleLine1)}" />`)}
            ${field("Title line 2", `<input data-field="heroes.index.titleLine2" value="${esc(heroes.index?.titleLine2)}" />`)}
            ${field("Tagline", `<input data-field="heroes.index.tagline" value="${esc(heroes.index?.tagline)}" />`)}
            ${field("Intro paragraph", `<textarea data-field="heroes.index.lead" rows="3">${esc(heroes.index?.lead)}</textarea>`)}
          </div>
        </div>
        ${["index", "happyHour", "contact", "menu"]
          .map(
            (key) => `
        <div id="pages-hero-editor-${key}">${heroPanelsEditorHtml(key, heroes, images)}</div>`
          )
          .join("")}
        ${["happyHour", "contact"]
          .map(
            (key) => `
        <div id="pages-hero-text-${key}">${heroTextEditorHtml(key, heroes[key])}</div>`
          )
          .join("")}
        <div id="pages-stats-editor">
          <div id="pages-stats-rows">${(siteData.stats || site.stats || []).map((s, i) => statsRow(s, i)).join("")}</div>
        </div>
        <div id="pages-promos-editor">
          <p style="color:var(--text-muted);font-size:0.88rem;margin:0 0 1rem">${esc(PROMO_PLACEMENTS.homepage.hint)}</p>
          <button type="button" class="btn btn-outline admin-btn-sm" id="pages-add-promo">+ Add promo card</button>
          <div id="pages-promo-editor" hidden></div>
          <div id="pages-promo-list"></div>
        </div>
        <div id="pages-gallery-editor">
          <div id="pages-gallery-rows">${(hp.gallery || []).map((g, i) => galleryRow(g, i, images)).join("")}</div>
          <button type="button" class="btn btn-outline admin-btn-sm" id="pages-add-gallery" style="margin-top:0.75rem">+ Add gallery photo</button>
        </div>
        <div id="pages-signatures-editor">
          <div id="pages-sig-rows">${(hp.signatureCards || []).map((c, i) => sigRow(c, i, images)).join("")}</div>
          <button type="button" class="btn btn-outline admin-btn-sm" id="pages-add-sig" style="margin-top:0.75rem">+ Add signature card</button>
        </div>
        <div id="pages-faq-editor">
          <div id="pages-faq-rows">${(hp.faq || []).map((f, i) => faqRow(f, i)).join("")}</div>
          <button type="button" class="btn btn-outline admin-btn-sm" id="pages-add-faq" style="margin-top:0.75rem">+ Add FAQ</button>
        </div>
      </div>`;

    const select = panel.querySelector("#edit-page-select");
    select.addEventListener("change", () => {
      panel.dataset.activePageId = select.value;
      pushPagePreview(true);
    });

    pagesPromoWorkflow = mountPromoEditorWorkflow(
      panel,
      promosData,
      "homepage",
      images,
      "pages-promo-list",
      "pages-promo-editor",
      "pages-add-promo",
      schedulePagePreview
    );

    panel._getHomepagePromos = (base) => {
      const out = JSON.parse(JSON.stringify(base || promosData));
      out.homepageFeatured = promosData.homepageFeatured || [];
      return out;
    };
    panel._refreshPagePreview = () => pushPagePreview(true);
    panel._collectPagesDraft = (stateBase) => {
      syncAllHeroes();
      return {
        site: collectHomepage(panel, {
          ...(stateBase.site || siteBase),
          heroes: siteData.heroes,
          pages: siteData.pages,
          stats: siteData.stats || siteBase.stats,
        }),
        promos: panel._getHomepagePromos(stateBase.promos || promos),
      };
    };

    bindPhotoGroups(panel, images, () => schedulePagePreview(false));
    bindImagePickers(panel);
    bindRemove(panel);
    if (panel._pagePreviewMessageHandler) {
      window.removeEventListener("message", panel._pagePreviewMessageHandler);
    }
    panel._pagePreviewMessageHandler = handlePagePreviewMessage;
    window.addEventListener("message", panel._pagePreviewMessageHandler);
    const iframe = panel.querySelector("#other-page-iframe");
    if (window.WSAdminPreviewFrame) WSAdminPreviewFrame.bind(iframe);
    if (iframe && !iframe.dataset.pageEditGuard) {
      iframe.dataset.pageEditGuard = "1";
      iframe.addEventListener("load", () => {
        try {
          const qs = new URLSearchParams(iframe.contentWindow.location.search);
          if (!qs.has("pageEditPreview")) pushPagePreview(true);
        } catch {
          /* ignore */
        }
      });
    }

    const cfg = EDIT_PAGES.find((p) => p.id === select.value) || EDIT_PAGES[0];
    panel.dataset.activePageId = cfg.id;
    pushPagePreview(true);
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
    renderPages,
    collectHomepage,
    renderHeroes,
    collectHeroes,
  };
})();
