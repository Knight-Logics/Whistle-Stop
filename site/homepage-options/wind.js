/* Clips of ws-old-florida-hero.jpg that sway. Coordinates are fractions of the picture. */
(function () {
  var clips = {
    trees: [
      "0,0.01 0.22,0.01 0.16,0.33 0,0.37",
      "0.70,0.01 1,0.01 1,0.22 0.76,0.17"
    ],
    plants: [
      "0.12,0.44 0.32,0.42 0.33,0.62 0.11,0.64",
      "0.38,0.49 0.62,0.42 0.60,0.63 0.36,0.67",
      "0.70,0.44 0.97,0.42 0.98,0.71 0.68,0.69"
    ],
    lanterns: ["0.64,0 0.99,0 0.97,0.23 0.66,0.20"],
    "frond-left": ["0,0.67 0.18,0.58 0.16,0.89 0,0.89"],
    "frond-right": ["0.84,0.60 1,0.51 1,0.89 0.86,0.89"]
  };

  function svgClip(id, shapes) {
    var polygons = shapes.map(function (pts) {
      return '<polygon points="' + pts + '"/>';
    }).join("");
    return '<clipPath id="' + id + '" clipPathUnits="objectBoundingBox">' + polygons + "</clipPath>";
  }

  document.querySelectorAll("[data-breeze]").forEach(function (root, index) {
    var src = root.getAttribute("data-breeze");
    var prefix = "breeze" + index;
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "breeze-clips");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    svg.innerHTML = Object.keys(clips).map(function (name) {
      return svgClip(prefix + "-" + name, clips[name]);
    }).join("");
    root.appendChild(svg);

    var base = document.createElement("img");
    base.className = "breeze-base";
    base.src = src;
    base.alt = root.getAttribute("data-breeze-alt") || "";
    base.width = 1024;
    base.height = 515;
    root.appendChild(base);

    Object.keys(clips).forEach(function (name) {
      var img = document.createElement("img");
      img.className = "breeze-layer breeze-" + name;
      img.src = src;
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      img.style.clipPath = "url(#" + prefix + "-" + name + ")";
      root.appendChild(img);
    });
  });
})();
