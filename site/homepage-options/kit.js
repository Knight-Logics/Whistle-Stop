/* Menu, week and visit block shared by designs 11–20. Facts come from shared.js and food.js. */
(function () {
  function boot() {
    var host = document.getElementById("rest");
    if (!host || !window.WS || !window.WSFOOD) return;
    var cats = WSFOOD.cats;
    var items = cats.flatMap(function (c) { return c.picks; });
    var tick = items.map(function (p) { return "<span>" + p[0] + " <b>" + p[1] + "</b></span>"; }).join("");
    var today = WS.today().dayIndex;
    var order = [1, 2, 3, 4, 5, 6, 0];
    host.innerHTML =
      '<div class="ticker" aria-label="A few things on the menu"><div class="track">' + tick + tick.replace(/<span>/g, '<span aria-hidden="true">') + "</div></div>" +
      '<section class="crave"><div class="wrap"><h2 data-split>What are you craving?</h2><p class="sub">Real plates and prices. Pick one and it opens that part of the menu.</p><div class="cards">' +
      cats.map(function (c, i) {
        return '<article class="card" data-reveal style="--i:' + i + '"><div class="art">' + WSFOOD.art(c.art) + "</div><h3>" + c.name + '</h3><p class="meta">' + c.count + ", from " + c.from + "</p><ul>" +
          c.picks.map(function (p) { return "<li><span>" + p[0] + "</span><b>" + p[1] + "</b></li>"; }).join("") +
          '</ul><a class="go" href="' + c.href + '">' + c.cta + "</a></article>";
      }).join("") +
      "</div></div></section>" +
      '<section class="week"><div class="wrap"><div class="tonight"><div><h2 data-split>Something every night</h2><p class="sub">Happy hour every day 4–7 PM. Tuesday and Wednesday it runs 4 PM to close.</p></div><div><p class="big" data-ws="tonight">Tonight</p><p><b data-ws="tonight-time"></b> <span data-ws="tonight-detail"></span></p></div></div><div class="days">' +
      order.map(function (d, i) {
        var w = WS.WEEK[d];
        return '<div class="day' + (d === today ? " is-today" : "") + '" data-reveal style="--i:' + i + '"><b>' + w.short + "</b><span>" + w.title + "</span></div>";
      }).join("") +
      "</div></div></section>" +
      '<section class="visit" id="visit"><div class="wrap"><div class="grid"><div><h2>915 Main Street</h2><p>Safety Harbor, FL 34695</p><p><a class="btn" href="' + WS.maps + '">Get directions</a></p></div><div><h3>Hours</h3><p>Sun–Thu 11 AM–9 PM</p><p>Fri–Sat 11 AM–10 PM</p><p><a href="' + WS.tel + '">' + WS.phone + "</a></p></div><div><h3>Since 1995</h3><p>This corner was Frostee Harbor, a drive-in ice cream stand, for more than 35 years. Henry's milkshakes are still on the menu.</p><p><a href=\"../order.html\">Order online</a> · <a href=\"" + WS.giftCards + '">Gift cards</a></p></div></div><div class="foot"><span>Whistle Stop Grill &amp; Bar</span><span><a href="' + WS.facebook + '">Facebook</a> · <a href="' + WS.instagram + '">Instagram</a></span></div></div></section>';

    if (window.FX) {
      host.querySelectorAll("[data-split]").forEach(FX.split);
      host.querySelectorAll("[data-reveal]").forEach(FX.reveal);
    } else {
      host.querySelectorAll("[data-reveal]").forEach(function (el) { el.classList.add("in"); });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
