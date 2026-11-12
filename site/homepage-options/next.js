/* Motion for designs 17–25: 3D plate and pour carousels, the three-scene hero, parallax menu. */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll(".spin").forEach(function (spin) {
    var cards = Array.prototype.slice.call(spin.querySelectorAll(".card"));
    var n = cards.length;
    if (!n) return;
    var i = 0;
    var timer;
    var names = ["center", "right", "left"];
    function place() {
      cards.forEach(function (card, k) {
        card.setAttribute("data-slot", names[(k - i + n) % n]);
      });
    }
    function start() {
      clearInterval(timer);
      if (reduce) return;
      timer = setInterval(function () {
        i = (i + 1) % n;
        place();
      }, 3200);
    }
    spin.addEventListener("mouseenter", function () { clearInterval(timer); });
    spin.addEventListener("mouseleave", start);
    place();
    start();
  });

  var root = document.querySelector("[data-slides]");
  if (root) {
    var index = 0;
    var count = 3;
    var timer = 0;
    var paused = false;
    var pauseBtn = root.querySelector("[data-pause]");
    function show(next) {
      index = (next + count) % count;
      root.setAttribute("data-on", String(index));
      root.querySelectorAll("[data-for]").forEach(function (el) {
        el.hidden = Number(el.getAttribute("data-for")) !== index;
      });
      root.querySelectorAll("[data-dot]").forEach(function (button) {
        button.setAttribute("aria-pressed", button.getAttribute("data-dot") === String(index) ? "true" : "false");
      });
    }
    function start() {
      clearInterval(timer);
      if (paused || reduce) return;
      timer = setInterval(function () { show(index + 1); }, 7000);
    }
    root.addEventListener("click", function (event) {
      var dot = event.target.closest("[data-dot]");
      if (dot) {
        show(Number(dot.getAttribute("data-dot")));
        start();
        return;
      }
      if (event.target.closest("[data-pause]")) {
        paused = !paused;
        pauseBtn.setAttribute("aria-pressed", paused ? "true" : "false");
        pauseBtn.textContent = paused ? "Play" : "Pause";
        start();
      }
    });
    root.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      show(index + (event.key === "ArrowRight" ? 1 : -1));
      start();
    });
    root.addEventListener("mouseenter", function () { clearInterval(timer); });
    root.addEventListener("mouseleave", start);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) clearInterval(timer);
      else start();
    });
    show(0);
    if (reduce && pauseBtn) pauseBtn.hidden = true;
    start();
  }

  var photo = document.querySelector("[data-parallax]");
  if (photo && !reduce) {
    var ticking = false;
    function apply() {
      ticking = false;
      photo.style.transform = "translate3d(0," + (window.scrollY * 0.22).toFixed(1) + "px,0)";
    }
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    }, { passive: true });
    apply();
  }
})();
