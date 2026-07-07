/* Shared page block discovery, apply, and scrape for Other Pages admin */
(function () {
  function getSections() {
    return [...document.querySelectorAll("main > section")].filter((s) => !s.hidden && s.id !== "pickup-order");
  }

  function parseBlockId(blockId) {
    const m = String(blockId).match(/^(\d+)-(.+)$/);
    if (!m) return null;
    return { si: Number(m[1]), rest: m[2] };
  }

  function blockType(blockId) {
    const rest = parseBlockId(blockId)?.rest || "";
    if (rest === "intro" || rest.startsWith("subhead-")) return "intro";
    if (rest === "stats") return "stats";
    if (rest.startsWith("feature-")) return "feature";
    if (rest.startsWith("card-")) return "card";
    if (rest.startsWith("order-card-")) return "orderCard";
    if (rest.startsWith("split-")) return "split";
    if (rest.startsWith("gallery-")) return "gallery";
    if (rest.startsWith("detail-")) return "detail";
    if (rest === "fine") return "fine";
    if (rest === "cta") return "cta";
    if (rest === "section") return "section";
    return "section";
  }

  function findBlockEl(blockId) {
    const marked = document.querySelector(`[data-admin-block="${blockId}"]`);
    if (marked) return marked;
    const parsed = parseBlockId(blockId);
    if (!parsed) return null;
    const sec = getSections()[parsed.si];
    if (!sec) return null;
    const { rest } = parsed;
    if (rest === "intro") return sec.querySelector(".section-head");
    if (rest.startsWith("subhead-")) {
      const idx = Number(rest.split("-")[1]) || 0;
      return sec.querySelectorAll(".section-head")[idx];
    }
    if (rest === "stats") return sec.querySelector(".stats-bar");
    if (rest.startsWith("feature-")) return sec.querySelectorAll(".order-feature")[Number(rest.split("-")[1]) || 0];
    if (rest.startsWith("card-")) return sec.querySelectorAll(".card, article.card")[Number(rest.split("-")[1]) || 0];
    if (rest.startsWith("order-card-")) return sec.querySelectorAll(".order-card")[Number(rest.split("-")[1]) || 0];
    if (rest.startsWith("split-")) {
      const idx = Number(rest.split("-")[1]) || 0;
      return sec.querySelectorAll(".split-media, .visit-location-info")[idx];
    }
    if (rest.startsWith("gallery-")) return sec.querySelectorAll(".photo-gallery")[Number(rest.split("-")[1]) || 0];
    if (rest.startsWith("detail-")) return sec.querySelectorAll(".visit-detail-block")[Number(rest.split("-")[1]) || 0];
    if (rest === "fine") return sec.querySelector(".order-fine-print");
    if (rest === "cta") return sec.querySelector(".container");
    return sec;
  }

  function text(el) {
    return el?.textContent?.trim() || "";
  }

  function scrapeIntro(el) {
    if (!el) return { title: "", body: "" };
    return {
      title: text(el.querySelector("h2, h1")),
      body: text(el.querySelector("p")),
    };
  }

  function scrapeStats(el) {
    if (!el) return { items: [] };
    return {
      items: [...el.querySelectorAll(".stat")].map((stat) => ({
        value: text(stat.querySelector("strong")),
        label: text(stat.querySelector("span")),
      })),
    };
  }

  function scrapeFeature(el) {
    if (!el) return {};
    const img = el.querySelector("img");
    return {
      tag: text(el.querySelector(".tag")),
      title: text(el.querySelector("h2, h3")),
      body: text(el.querySelector(".order-feature-copy p, p")),
      bullets: [...el.querySelectorAll(".order-checklist li")].map((li) => li.innerHTML.trim()),
      image: img?.getAttribute("src") || "",
      imageAlt: img?.getAttribute("alt") || "",
      ctaLabel: text(el.querySelector(".btn, a.btn")),
      ctaHref: el.querySelector(".btn, a.btn")?.getAttribute("href") || "",
    };
  }

  function scrapeCard(el) {
    if (!el) return {};
    const img = el.querySelector(".card-img img, img");
    const btn = el.querySelector(".btn, a.btn");
    return {
      title: text(el.querySelector("h3, h2")),
      body: text(el.querySelector(".card-body p, p")),
      image: img?.getAttribute("src") || "",
      imageAlt: img?.getAttribute("alt") || "",
      ctaLabel: btn ? text(btn) : "",
      ctaHref: btn?.getAttribute("href") || "",
      tags: [...el.querySelectorAll(".card-meta .tag")].map((t) => text(t)),
    };
  }

  function scrapeOrderCard(el) {
    if (!el) return {};
    return {
      label: text(el.querySelector(".order-card-label")),
      title: text(el.querySelector("h3")),
      body: text(el.querySelector("p")),
      href: el.getAttribute("href") || "",
      cta: text(el.querySelector(".order-card-cta")),
    };
  }

  function scrapeSplit(el) {
    if (!el) return {};
    const copy = el.querySelector(".reveal-left, :scope > div:first-child");
    const imgs = [...el.querySelectorAll(".reveal-right img, :scope > img, .split-media img")];
    const uniqueImgs = imgs.filter((img, i, arr) => arr.indexOf(img) === i);
    return {
      title: text(copy?.querySelector("h2, h1")),
      body: [...(copy?.querySelectorAll("p") || [])].map((p) => p.innerHTML.trim()).join("\n\n"),
      bullets: [...(copy?.querySelectorAll("ul li") || [])].map((li) => li.textContent.trim()),
      images: uniqueImgs.map((img) => ({
        src: img.getAttribute("src") || "",
        alt: img.getAttribute("alt") || "",
      })),
      buttons: [...(copy?.querySelectorAll(".btn-group a, .btn-group button, a.btn") || [])].map((btn) => ({
        label: text(btn),
        href: btn.getAttribute("href") || "",
      })),
    };
  }

  function scrapeGallery(el) {
    if (!el) return { items: [] };
    return {
      items: [...el.querySelectorAll("figure")].map((fig) => {
        const img = fig.querySelector("img");
        return {
          image: img?.getAttribute("src") || "",
          alt: img?.getAttribute("alt") || "",
          caption: text(fig.querySelector("figcaption")),
        };
      }),
    };
  }

  function scrapeDetail(el) {
    if (!el) return { title: "", body: "" };
    return {
      title: text(el.querySelector("h3, h2")),
      body: text(el.querySelector("p")),
    };
  }

  function scrapeFine(el) {
    return { body: el?.innerHTML?.trim() || text(el) };
  }

  function scrapeCta(el) {
    if (!el) return { title: "", body: "" };
    return {
      title: text(el.querySelector("h2, h1")),
      body: text(el.querySelector("p")),
    };
  }

  function scrapeBlock(el, blockId) {
    const type = blockType(blockId);
    const target = el || findBlockEl(blockId);
    switch (type) {
      case "intro":
        return scrapeIntro(target);
      case "stats":
        return scrapeStats(target);
      case "feature":
        return scrapeFeature(target);
      case "card":
        return scrapeCard(target);
      case "orderCard":
        return scrapeOrderCard(target);
      case "split":
        return scrapeSplit(target);
      case "gallery":
        return scrapeGallery(target);
      case "detail":
        return scrapeDetail(target);
      case "fine":
        return scrapeFine(target);
      case "cta":
        return scrapeCta(target);
      default:
        return scrapeIntro(target);
    }
  }

  function applyIntro(el, data) {
    if (!el || !data) return;
    const h = el.querySelector("h2, h1");
    const p = el.querySelector("p");
    if (h && data.title != null) h.textContent = data.title;
    if (p && data.body != null) p.textContent = data.body;
  }

  function applyStats(el, data) {
    if (!el || !data?.items?.length) return;
    el.innerHTML = data.items
      .map(
        (s) => `
      <div class="stat">
        <strong>${s.value || ""}</strong>
        <span>${s.label || ""}</span>
      </div>`
      )
      .join("");
  }

  function applyFeature(el, data) {
    if (!el || !data) return;
    const tag = el.querySelector(".tag");
    const title = el.querySelector("h2, h3");
    const body = el.querySelector(".order-feature-copy p, p");
    const img = el.querySelector("img");
    const btn = el.querySelector(".btn, a.btn");
    const list = el.querySelector(".order-checklist");
    if (tag && data.tag != null) tag.textContent = data.tag;
    if (title && data.title != null) title.textContent = data.title;
    if (body && data.body != null) body.textContent = data.body;
    if (img && data.image) img.src = data.image;
    if (img && data.imageAlt != null) img.alt = data.imageAlt;
    if (btn && data.ctaLabel) btn.textContent = data.ctaLabel;
    if (btn && data.ctaHref) btn.href = data.ctaHref;
    if (list && data.bullets?.length) {
      list.innerHTML = data.bullets.map((b) => `<li>${b}</li>`).join("");
    }
  }

  function applyCard(el, data) {
    if (!el || !data) return;
    const title = el.querySelector("h3, h2");
    const body = el.querySelector(".card-body p, p");
    const img = el.querySelector(".card-img img, img");
    const btn = el.querySelector(".btn, a.btn");
    const meta = el.querySelector(".card-meta");
    if (title && data.title != null) title.textContent = data.title;
    if (body && data.body != null) body.textContent = data.body;
    if (img && data.image) img.src = data.image;
    if (img && data.imageAlt != null) img.alt = data.imageAlt;
    if (btn && data.ctaLabel) {
      btn.textContent = data.ctaLabel;
      if (data.ctaHref) btn.href = data.ctaHref;
    }
    if (meta && data.tags?.length) {
      meta.innerHTML = data.tags.map((t) => `<span class="tag">${t}</span>`).join("");
    }
  }

  function applyOrderCard(el, data) {
    if (!el || !data) return;
    const label = el.querySelector(".order-card-label");
    const title = el.querySelector("h3");
    const body = el.querySelector("p");
    const cta = el.querySelector(".order-card-cta");
    if (label && data.label != null) label.textContent = data.label;
    if (title && data.title != null) title.textContent = data.title;
    if (body && data.body != null) body.textContent = data.body;
    if (cta && data.cta != null) cta.textContent = data.cta;
    if (data.href) el.href = data.href;
  }

  function applySplit(el, data) {
    if (!el || !data) return;
    const copy = el.querySelector(".reveal-left, :scope > div:first-child");
    const imgs = [...el.querySelectorAll(".reveal-right img, :scope > img")].filter(
      (img, i, arr) => arr.indexOf(img) === i
    );
    if (copy) {
      const h = copy.querySelector("h2, h1");
      if (h && data.title != null) h.textContent = data.title;
      const paragraphs = copy.querySelectorAll("p");
      if (data.body != null && paragraphs[0]) {
        const parts = String(data.body).split(/\n\n+/);
        paragraphs.forEach((p, i) => {
          if (parts[i] != null) p.innerHTML = parts[i];
        });
      }
      const list = copy.querySelector("ul");
      if (list && data.bullets?.length) {
        list.innerHTML = data.bullets.map((b) => `<li>${b}</li>`).join("");
      }
    }
    if (data.images?.length) {
      data.images.forEach((item, i) => {
        const img = imgs[i];
        if (!img) return;
        if (item.src) img.src = item.src;
        if (item.alt != null) img.alt = item.alt;
      });
    }
  }

  function applyGallery(el, data) {
    if (!el || !data?.items?.length) return;
    el.innerHTML = data.items
      .map(
        (item) => `
      <figure class="reveal-photo">
        <img src="${item.image || ""}" alt="${item.alt || item.caption || ""}" loading="lazy" />
        <figcaption>${item.caption || ""}</figcaption>
      </figure>`
      )
      .join("");
  }

  function applyDetail(el, data) {
    if (!el || !data) return;
    const h = el.querySelector("h3, h2");
    const p = el.querySelector("p");
    if (h && data.title != null) h.textContent = data.title;
    if (p && data.body != null) p.textContent = data.body;
  }

  function applyFine(el, data) {
    if (!el || data?.body == null) return;
    el.innerHTML = data.body;
  }

  function applyCta(el, data) {
    applyIntro(el, data);
  }

  function applyBlock(el, blockId, data) {
    const target = el || findBlockEl(blockId);
    if (!target || !data) return;
    switch (blockType(blockId)) {
      case "intro":
        applyIntro(target, data);
        break;
      case "stats":
        applyStats(target, data);
        break;
      case "feature":
        applyFeature(target, data);
        break;
      case "card":
        applyCard(target, data);
        break;
      case "orderCard":
        applyOrderCard(target, data);
        break;
      case "split":
        applySplit(target, data);
        break;
      case "gallery":
        applyGallery(target, data);
        break;
      case "detail":
        applyDetail(target, data);
        break;
      case "fine":
        applyFine(target, data);
        break;
      case "cta":
        applyCta(target, data);
        break;
      default:
        applyIntro(target, data);
    }
  }

  function markBlocks() {
    document.querySelectorAll("[data-admin-block]").forEach((el) => {
      el.removeAttribute("data-admin-block");
      el.removeAttribute("data-admin-block-type");
      el.classList.remove("admin-preview-clickable");
    });

    getSections().forEach((sec, si) => {
      let marked = 0;

      sec.querySelectorAll(".section-head").forEach((head, hi) => {
        const id = hi === 0 ? `${si}-intro` : `${si}-subhead-${hi}`;
        head.setAttribute("data-admin-block", id);
        head.setAttribute("data-admin-block-type", "intro");
        marked++;
      });

      const stats = sec.querySelector(".stats-bar");
      if (stats) {
        stats.setAttribute("data-admin-block", `${si}-stats`);
        stats.setAttribute("data-admin-block-type", "stats");
        marked++;
      }

      sec.querySelectorAll(".order-feature").forEach((el, i) => {
        el.setAttribute("data-admin-block", `${si}-feature-${i}`);
        el.setAttribute("data-admin-block-type", "feature");
        marked++;
      });

      sec.querySelectorAll(".card, article.card").forEach((el, i) => {
        el.setAttribute("data-admin-block", `${si}-card-${i}`);
        el.setAttribute("data-admin-block-type", "card");
        marked++;
      });

      sec.querySelectorAll(".order-card").forEach((el, i) => {
        el.setAttribute("data-admin-block", `${si}-order-card-${i}`);
        el.setAttribute("data-admin-block-type", "orderCard");
        marked++;
      });

      sec.querySelectorAll(".split-media, .visit-location-info").forEach((el, i) => {
        el.setAttribute("data-admin-block", `${si}-split-${i}`);
        el.setAttribute("data-admin-block-type", "split");
        marked++;
      });

      sec.querySelectorAll(".photo-gallery").forEach((el, i) => {
        el.setAttribute("data-admin-block", `${si}-gallery-${i}`);
        el.setAttribute("data-admin-block-type", "gallery");
        marked++;
      });

      sec.querySelectorAll(".visit-detail-block").forEach((el, i) => {
        el.setAttribute("data-admin-block", `${si}-detail-${i}`);
        el.setAttribute("data-admin-block-type", "detail");
        marked++;
      });

      const fine = sec.querySelector(".order-fine-print");
      if (fine) {
        fine.setAttribute("data-admin-block", `${si}-fine`);
        fine.setAttribute("data-admin-block-type", "fine");
        marked++;
      }

      if (!marked) {
        const cta = sec.querySelector(":scope > .container");
        if (cta) {
          cta.setAttribute("data-admin-block", `${si}-cta`);
          cta.setAttribute("data-admin-block-type", "cta");
          marked++;
        }
      }

      if (!marked) {
        sec.setAttribute("data-admin-block", `${si}-section`);
        sec.setAttribute("data-admin-block-type", "section");
      }
    });
  }

  function applyAll(blocks) {
    if (!blocks) return;
    Object.entries(blocks).forEach(([blockId, data]) => {
      applyBlock(null, blockId, data);
    });
  }

  window.WSPageBlocks = {
    getSections,
    findBlockEl,
    blockType,
    markBlocks,
    scrapeBlock,
    applyBlock,
    applyAll,
  };
})();
