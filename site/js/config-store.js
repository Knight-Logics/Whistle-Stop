/* Whistle Stop — unified config loader with admin localStorage overlay */
(function (global) {
  const STORAGE_KEY = "ws-admin-v1";
  const PREVIEW_STORE_KEY = "ws-admin-preview-store";
  const SESSION_KEY = "ws-admin-session";
  const SESSION_HOURS = 12;
  const MENU_SAVE_ONLY_FLAG = "ws-menu-save-only-v1";
  const MENU_FULL_RESTORE_FLAG = "ws-menu-full-restore-v1";
  const PUBLISHED_RESTORE_FLAG = "ws-published-content-restore-v2";
  const EMPTY_OVERLAY_FIX_FLAG = "ws-overlay-empty-array-fix-v1";
  const CONTENT_SECTIONS = ["site", "events", "menus", "reviews", "promos", "socialManager"];

  const FILES = {
    site: "data/site.json",
    events: "data/events.json",
    menus: "data/menus.json",
    reviews: "data/reviews.json",
    promos: "data/promos.json",
    images: "data/images.json",
    socialManager: "data/social-manager.json",
  };

  const UPLOAD_PREFIX = "ws-upload:";
  const MEDIA_DB = "ws-admin-media-v1";
  const MEDIA_STORE = "uploads";
  const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

  const cache = {};
  const blobUrlCache = new Map();
  let overlay = null;

  function readOverlay() {
    if (overlay) return overlay;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      overlay = raw ? JSON.parse(raw) : {};
    } catch {
      overlay = {};
    }
    if (!overlay.data) overlay.data = {};
    return overlay;
  }

  function writeOverlay() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
  }

  async function sha256(text) {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text)
    );
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function fetchFile(section) {
    if (cache[section]) return structuredClone(cache[section]);
    const res = await fetch(FILES[section], { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${FILES[section]}`);
    const data = await res.json();
    cache[section] = data;
    return structuredClone(data);
  }

  async function get(section) {
    const base = await fetchFile(section);
    const o = readOverlay();
    if (o.data[section]) {
      return deepMerge(base, o.data[section]);
    }
    return base;
  }

  function deepMerge(base, patch) {
    if (patch === null || patch === undefined) return base;
    if (Array.isArray(patch)) {
      if (patch.length === 0 && Array.isArray(base) && base.length > 0) {
        return base.slice();
      }
      return patch.slice();
    }
    if (typeof patch !== "object" || typeof base !== "object" || Array.isArray(base)) {
      return patch;
    }
    const out = { ...base };
    Object.keys(patch).forEach((key) => {
      out[key] = deepMerge(base[key], patch[key]);
    });
    return out;
  }

  function save(section, data) {
    readOverlay();
    overlay.data[section] = data;
    writeOverlay();
    clearPreview(section);
    document.dispatchEvent(
      new CustomEvent("ws-config-updated", { detail: { section } })
    );
  }

  function readPreviewStore() {
    try {
      const raw = localStorage.getItem(PREVIEW_STORE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function writePreviewStore(store) {
    try {
      localStorage.setItem(PREVIEW_STORE_KEY, JSON.stringify(store));
    } catch {
      /* ignore quota errors */
    }
  }

  function savePreview(section, data) {
    const store = readPreviewStore();
    store[section] = data;
    writePreviewStore(store);
  }

  function readPreviewSync(section) {
    const store = readPreviewStore();
    return store[section] ?? null;
  }

  function clearPreview(section) {
    const store = readPreviewStore();
    if (section) {
      delete store[section];
      writePreviewStore(store);
    } else {
      writePreviewStore({});
    }
  }

  async function getForPreview(section) {
    const draft = readPreviewSync(section);
    if (draft) return draft;
    return get(section);
  }

  function migrateMenuSaveOnly() {
    if (typeof localStorage === "undefined" || localStorage.getItem(MENU_SAVE_ONLY_FLAG)) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o.data?.menus) {
          delete o.data.menus;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
        }
      }
    } catch {
      /* ignore */
    }
    localStorage.setItem(MENU_SAVE_ONLY_FLAG, "1");
    overlay = null;
  }

  function restoreFullMenuFromJson() {
    if (typeof localStorage === "undefined" || localStorage.getItem(MENU_FULL_RESTORE_FLAG)) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o.data?.menus) {
          delete o.data.menus;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
        }
      }
    } catch {
      /* ignore */
    }
    clearPreview("menus");
    delete cache.menus;
    overlay = null;
    localStorage.setItem(MENU_FULL_RESTORE_FLAG, "1");
  }

  function restorePublishedContent() {
    readOverlay();
    const passwordHash = overlay.passwordHash;
    CONTENT_SECTIONS.forEach((section) => {
      delete overlay.data[section];
    });
    if (passwordHash) overlay.passwordHash = passwordHash;
    writeOverlay();
    clearPreview();
    Object.keys(cache).forEach((key) => {
      delete cache[key];
    });
    overlay = null;
    if (typeof document !== "undefined") {
      document.dispatchEvent(
        new CustomEvent("ws-config-updated", { detail: { section: "all" } })
      );
    }
  }

  function runPublishedContentRestoreIfNeeded() {
    if (typeof localStorage === "undefined" || localStorage.getItem(PUBLISHED_RESTORE_FLAG)) return;
    restorePublishedContent();
    localStorage.setItem(PUBLISHED_RESTORE_FLAG, "1");
  }

  function repairOverlayEmptyArrays() {
    if (typeof localStorage === "undefined" || localStorage.getItem(EMPTY_OVERLAY_FIX_FLAG)) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(EMPTY_OVERLAY_FIX_FLAG, "1");
        return;
      }
      const o = JSON.parse(raw);
      let dirty = false;

      function stripEmptyArray(parent, key) {
        if (!parent || !Array.isArray(parent[key]) || parent[key].length > 0) return;
        delete parent[key];
        dirty = true;
      }

      stripEmptyArray(o.data?.site?.homepage, "gallery");
      stripEmptyArray(o.data?.site?.homepage, "signatureCards");
      stripEmptyArray(o.data?.site?.homepage, "faq");
      stripEmptyArray(o.data?.promos, "homepageFeatured");
      stripEmptyArray(o.data?.promos, "eventsPageFeatured");

      if (o.data?.site?.homepage && Object.keys(o.data.site.homepage).length === 0) {
        delete o.data.site.homepage;
        dirty = true;
      }
      if (o.data?.site && Object.keys(o.data.site).length === 0) {
        delete o.data.site;
        dirty = true;
      }
      if (o.data?.promos && Object.keys(o.data.promos).length === 0) {
        delete o.data.promos;
        dirty = true;
      }

      if (dirty) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
        overlay = null;
        Object.keys(cache).forEach((k) => delete cache[k]);
      }
      localStorage.setItem(EMPTY_OVERLAY_FIX_FLAG, "1");
    } catch {
      localStorage.setItem(EMPTY_OVERLAY_FIX_FLAG, "1");
    }
  }

  function clearOverlay(section) {
    readOverlay();
    if (section) {
      delete overlay.data[section];
    } else {
      overlay.data = {};
    }
    writeOverlay();
    document.dispatchEvent(
      new CustomEvent("ws-config-updated", { detail: { section: section || "all" } })
    );
  }

  function hasOverlay() {
    const o = readOverlay();
    return Object.keys(o.data || {}).length > 0;
  }

  function inferMediaType(mime, nameOrPath) {
    const name = String(nameOrPath || "");
    const type = String(mime || "").toLowerCase();
    if (type.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv)$/i.test(name)) return "video";
    if (type === "image/gif" || /\.gif$/i.test(name)) return "gif";
    return "image";
  }

  function isUploadRef(src) {
    return typeof src === "string" && src.startsWith(UPLOAD_PREFIX);
  }

  function openMediaDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(MEDIA_DB, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(MEDIA_STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getUploadRecord(id) {
    const db = await openMediaDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(MEDIA_STORE, "readonly");
        const req = tx.objectStore(MEDIA_STORE).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }

  async function saveUpload(file) {
    if (!file) throw new Error("No file selected");
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(`File is too large (max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB)`);
    }
    const mediaType = inferMediaType(file.type, file.name);
    const id = crypto.randomUUID();
    const rec = {
      id,
      name: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
      mediaType,
      createdAt: Date.now(),
      blob: file,
    };
    const db = await openMediaDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(MEDIA_STORE, "readwrite");
        tx.objectStore(MEDIA_STORE).put(rec);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
    return {
      id,
      ref: `${UPLOAD_PREFIX}${id}`,
      mediaType: rec.mediaType,
      name: file.name,
      size: file.size,
    };
  }

  async function resolveMediaSrc(src) {
    if (!src) return src;
    if (!isUploadRef(src)) return src;
    const id = src.slice(UPLOAD_PREFIX.length);
    if (blobUrlCache.has(id)) return blobUrlCache.get(id);
    const rec = await getUploadRecord(id);
    if (!rec?.blob) return "";
    const url = URL.createObjectURL(rec.blob);
    blobUrlCache.set(id, url);
    return url;
  }

  function collectUploadRefs(value, refs = new Set()) {
    if (typeof value === "string" && isUploadRef(value)) refs.add(value.slice(UPLOAD_PREFIX.length));
    else if (Array.isArray(value)) value.forEach((v) => collectUploadRefs(v, refs));
    else if (value && typeof value === "object") {
      Object.values(value).forEach((v) => collectUploadRefs(v, refs));
    }
    return refs;
  }

  async function exportUploads(bundle) {
    const ids = collectUploadRefs(bundle);
    const uploads = [];
    for (const id of ids) {
      const rec = await getUploadRecord(id);
      if (!rec?.blob) continue;
      const dataBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || "");
          resolve(result.includes(",") ? result.split(",")[1] : result);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(rec.blob);
      });
      uploads.push({
        id,
        name: rec.name,
        mime: rec.mime,
        mediaType: rec.mediaType,
        size: rec.size,
        dataBase64,
      });
    }
    return uploads;
  }

  async function importUploads(uploads) {
    if (!uploads?.length) return;
    const db = await openMediaDb();
    try {
      await Promise.all(
        uploads.map(
          (item) =>
            new Promise((resolve, reject) => {
              const binary = atob(item.dataBase64);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
              const blob = new Blob([bytes], { type: item.mime || "application/octet-stream" });
              const rec = {
                id: item.id,
                name: item.name,
                mime: item.mime,
                size: item.size,
                mediaType: item.mediaType || inferMediaType(item.mime, item.name),
                createdAt: Date.now(),
                blob,
              };
              const tx = db.transaction(MEDIA_STORE, "readwrite");
              tx.objectStore(MEDIA_STORE).put(rec);
              tx.oncomplete = () => resolve();
              tx.onerror = () => reject(tx.error);
            })
        )
      );
    } finally {
      db.close();
    }
  }

  async function exportBundle() {
    const sections = ["site", "events", "menus", "reviews", "promos"];
    const bundle = {};
    for (const s of sections) {
      bundle[s] = await get(s);
    }
    bundle.mediaUploads = await exportUploads(bundle);
    bundle.exportedAt = new Date().toISOString();
    bundle.version = 2;
    return bundle;
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function exportAll() {
    const bundle = await exportBundle();
    downloadJson(`whistle-stop-config-${Date.now()}.json`, bundle);
  }

  async function exportSection(section) {
    const data = await get(section);
    downloadJson(`${section}.json`, data);
  }

  async function importBundle(bundle) {
    if (!bundle || typeof bundle !== "object") throw new Error("Invalid bundle");
    if (bundle.mediaUploads?.length) await importUploads(bundle.mediaUploads);
    readOverlay();
    ["site", "events", "menus", "reviews", "promos"].forEach((s) => {
      if (bundle[s]) overlay.data[s] = bundle[s];
    });
    writeOverlay();
    document.dispatchEvent(
      new CustomEvent("ws-config-updated", { detail: { section: "all" } })
    );
  }

  async function login(password) {
    const site = await fetchFile("site");
    const hash = await sha256(password);
    const stored = readOverlay().passwordHash || site.admin?.passwordHash;
    if (hash !== stored) return false;
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ at: Date.now(), token: hash.slice(0, 16), adminHash: hash })
    );
    return true;
  }

  function getAdminAuthHash() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const { at, adminHash } = JSON.parse(raw);
      if (!adminHash || Date.now() - at >= SESSION_HOURS * 60 * 60 * 1000) return null;
      return adminHash;
    } catch {
      return null;
    }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function isAuthed() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      const { at } = JSON.parse(raw);
      return Date.now() - at < SESSION_HOURS * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }

  async function changePassword(current, next) {
    const site = await fetchFile("site");
    const currentHash = await sha256(current);
    const stored = readOverlay().passwordHash || site.admin?.passwordHash;
    if (currentHash !== stored) return false;
    readOverlay();
    overlay.passwordHash = await sha256(next);
    writeOverlay();
    return true;
  }

  function getPath(obj, path) {
    return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  migrateMenuSaveOnly();
  restoreFullMenuFromJson();
  runPublishedContentRestoreIfNeeded();
  repairOverlayEmptyArrays();

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key !== STORAGE_KEY) return;
      overlay = null;
      Object.keys(cache).forEach((k) => delete cache[k]);
      document.dispatchEvent(
        new CustomEvent("ws-config-updated", { detail: { section: "all" } })
      );
    });
  }

  global.WSConfig = {
    FILES,
    UPLOAD_PREFIX,
    get,
    getForPreview,
    readPreviewSync,
    save,
    savePreview,
    clearPreview,
    clearOverlay,
    restorePublishedContent,
    hasOverlay,
    exportAll,
    exportSection,
    exportBundle,
    importBundle,
    downloadJson,
    login,
    logout,
    isAuthed,
    getAdminAuthHash,
    changePassword,
    sha256,
    getPath,
    inferMediaType,
    isUploadRef,
    saveUpload,
    resolveMediaSrc,
    invalidateCache(section) {
      if (section) delete cache[section];
      else Object.keys(cache).forEach((k) => delete cache[k]);
    },
  };
})(window);
