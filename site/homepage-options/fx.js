/* Motion helpers shared by the animated homepage options.
   Everything here is progressive: without JavaScript, or with "reduce motion" on, the page is complete and still. */
(function () {
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  root.classList.add(reduce ? "still" : "moving");

  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const ease = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  /* Wrap each word in a span (index in --wi) so a headline can arrive word by word. */
  function split(el) {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = "1";
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) return frag.append(part);
            const s = document.createElement("span");
            s.className = "w";
            s.setAttribute("aria-hidden", "true");
            s.style.setProperty("--wi", i++);
            s.textContent = part;
            frag.append(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
      });
    };
    walk(el);
  }

  /* Add .in when an element scrolls into view. */
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.15, rootMargin: "0px 0px -6% 0px" })
    : null;
  const reveal = (el) => (io ? io.observe(el) : el.classList.add("in"));

  /* Pointer tilt: sets --rx/--ry (degrees) and --gx/--gy (glare position, %) on the element. */
  function tilt(el, max = 10) {
    if (reduce || !fine) return;
    let raf = 0, tx = 0, ty = 0, gx = 50, gy = 50;
    const apply = () => { raf = 0; el.style.setProperty("--rx", tx.toFixed(2) + "deg"); el.style.setProperty("--ry", ty.toFixed(2) + "deg"); el.style.setProperty("--gx", gx + "%"); el.style.setProperty("--gy", gy + "%"); };
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      ty = (px - 0.5) * 2 * max; tx = -(py - 0.5) * 2 * max; gx = Math.round(px * 100); gy = Math.round(py * 100);
      el.classList.add("tilting");
      if (!raf) raf = requestAnimationFrame(apply);
    });
    el.addEventListener("pointerleave", () => { tx = ty = 0; gx = gy = 50; el.classList.remove("tilting"); if (!raf) raf = requestAnimationFrame(apply); });
  }

  /* Buttons lean toward the pointer a little. */
  function magnetic(el, pull = 0.25) {
    if (reduce || !fine) return;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.translate = `${((e.clientX - r.left - r.width / 2) * pull).toFixed(1)}px ${((e.clientY - r.top - r.height / 2) * pull).toFixed(1)}px`;
    });
    el.addEventListener("pointerleave", () => (el.style.translate = ""));
  }

  /* Scroll progress. pin: 0 when the section's top reaches the top of the screen, 1 when its bottom reaches the bottom.
     pass: 0 when the element enters at the bottom, 1 when it leaves at the top. */
  const watchers = [];
  function progress(el, mode, fn) {
    watchers.push({ el, mode, fn, last: -1 });
    schedule();
  }
  let ticking = false;
  function schedule() { if (!ticking) { ticking = true; requestAnimationFrame(run); } }
  function run() {
    ticking = false;
    const vh = innerHeight;
    for (const w of watchers) {
      const r = w.el.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) continue;
      const p = w.mode === "pin" ? clamp(-r.top / Math.max(1, r.height - vh)) : clamp((vh - r.top) / (vh + r.height));
      if (Math.abs(p - w.last) < 0.0005) continue;
      w.last = p;
      w.fn(p, r);
    }
  }
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", () => { watchers.forEach((w) => (w.last = -1)); schedule(); });

  /* A shared frame loop that sleeps when the tab is hidden. */
  const loops = new Set();
  let loopRaf = 0, lastT = 0;
  function frame(t) {
    const dt = Math.min(0.05, (t - (lastT || t)) / 1000);
    lastT = t;
    loops.forEach((fn) => fn(t / 1000, dt));
    loopRaf = loops.size && !document.hidden ? requestAnimationFrame(frame) : 0;
  }
  function loop(fn) {
    if (reduce) return () => {};
    loops.add(fn);
    if (!loopRaf) { lastT = 0; loopRaf = requestAnimationFrame(frame); }
    return () => loops.delete(fn);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && loops.size && !loopRaf) { lastT = 0; loopRaf = requestAnimationFrame(frame); } });

  window.FX = { reduce, fine, clamp, ease, smooth, split, reveal, tilt, magnetic, progress, loop };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-split]").forEach(split);
    document.querySelectorAll("[data-reveal]").forEach(reveal);
    document.querySelectorAll("[data-tilt]").forEach((el) => tilt(el, Number(el.dataset.tilt) || 10));
    document.querySelectorAll("[data-magnetic]").forEach((el) => magnetic(el));
    requestAnimationFrame(() => root.classList.add("ready"));
  });
})();
