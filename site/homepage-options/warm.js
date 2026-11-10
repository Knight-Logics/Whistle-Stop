/* Fills designs 21–30 from WSDAWN (Dawn's working menu) and WS (hours, nights). */
(function () {
  function item(id) {
    var groups = (window.WSDAWN && WSDAWN.groups) || [];
    for (var g = 0; g < groups.length; g++) {
      var items = groups[g].items;
      for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    }
    return null;
  }

  function fillPlate(el) {
    var food = item(el.getAttribute("data-plate"));
    if (!food) return;
    var name = el.querySelector("[data-field='name']");
    var detail = el.querySelector("[data-field='detail']");
    var price = el.querySelector("[data-field='price']");
    var extra = el.querySelector("[data-field='extra']");
    if (name) name.textContent = food.name;
    if (detail) detail.textContent = food.detail || "";
    if (price) price.textContent = food.price || "";
    if (extra) extra.textContent = food.extra || "";
  }

  function menuSection(root) {
    var data = window.WSDAWN;
    if (!data) return;
    var note = root.querySelector(".menu-note");
    if (note) note.textContent = "Working menu from the June 2024 copy. A few items still need edits. Side dishes had no prices on that copy.";
    var box = root.querySelector(".groups");
    if (!box) return;
    box.replaceChildren();
    data.groups.forEach(function (group) {
      var card = document.createElement("article");
      card.className = "group";
      var h = document.createElement("h3");
      h.textContent = group.name;
      card.appendChild(h);
      if (group.note) {
        var n = document.createElement("p");
        n.className = "group-note";
        n.textContent = group.note;
        card.appendChild(n);
      }
      group.items.forEach(function (food) {
        var row = document.createElement("div");
        row.className = "item";
        var name = document.createElement("div");
        name.className = "item-name";
        name.textContent = food.name;
        var price = document.createElement("div");
        price.className = "item-price";
        price.textContent = food.price || "";
        row.appendChild(name);
        row.appendChild(price);
        if (food.detail) {
          var d = document.createElement("p");
          d.className = "item-detail";
          d.textContent = food.detail;
          row.appendChild(d);
        }
        if (food.extra) {
          var x = document.createElement("p");
          x.className = "item-extra";
          x.textContent = food.extra;
          row.appendChild(x);
        }
        card.appendChild(row);
      });
      box.appendChild(card);
    });
  }

  function nights(list) {
    if (!window.WS) return;
    list.replaceChildren();
    WS.WEEK.forEach(function (night, index) {
      var li = document.createElement("li");
      li.setAttribute("data-ws-day", String(index));
      var b = document.createElement("b");
      b.textContent = night.short;
      var span = document.createElement("span");
      span.textContent = night.title + " · " + night.time;
      li.appendChild(b);
      li.appendChild(span);
      list.appendChild(li);
    });
  }

  function visit(root) {
    if (!window.WS) return;
    root.innerHTML =
      '<div class="visit-grid">' +
      '<div><h2>915 Main Street</h2><p>Safety Harbor, FL 34695</p>' +
      '<div class="actions"><a class="btn" href="' + WS.maps + '">Get directions</a>' +
      '<a class="btn line" href="' + WS.tel + '">' + WS.phone + '</a></div></div>' +
      '<div><h3>Hours</h3><p>Sun–Thu 11 AM–9 PM</p><p>Fri–Sat 11 AM–10 PM</p>' +
      '<p>Happy hour ' + WSDAWN.happyHour + ' PM</p><p>Tuesday and Wednesday, 4 PM to close</p></div>' +
      '<div><h3>On the menu copy</h3><p>Wheel spins at ' + WSDAWN.wheelSpins.join(" and ") + '</p>' +
      '<p><a href="../order.html">Order online</a></p></div></div>';
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-plate]").forEach(fillPlate);
    document.querySelectorAll("[data-warm-menu]").forEach(menuSection);
    document.querySelectorAll("[data-warm-nights]").forEach(nights);
    document.querySelectorAll("[data-warm-visit]").forEach(visit);
  });
})();
