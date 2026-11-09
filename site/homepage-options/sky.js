/* Living sky for the homepage options: birds, wind, trees, sun gleam.
   One still frame when the visitor has asked for less motion. */
(function () {
  function wantsStill() {
    return (window.FX && FX.reduce) || matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function runLoop(fn) {
    if (wantsStill()) {
      fn(1.4, 0);
      return function () {};
    }
    if (window.FX && FX.loop) return FX.loop(fn);
    var raf = 0;
    var last = 0;
    function tick(t) {
      var dt = Math.min(0.05, (t - (last || t)) / 1000);
      last = t;
      fn(t / 1000, dt);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return function () { cancelAnimationFrame(raf); };
  }

  function attach(canvas, opts) {
    var o = Object.assign({ birds: 7, trees: true, sun: true, clouds: true, leaves: true, night: false, gleam: true, gusts: true }, opts || {});
    var ctx = canvas.getContext("2d");
    var parent = canvas.parentElement;
    var state = { sunY: o.night ? 0.16 : 0.2, wind: 1 };
    var w = 1;
    var h = 1;
    var dpr = 1;

    var birds = [];
    for (var i = 0; i < o.birds; i++) {
      birds.push({
        x: Math.random(),
        y: (o.birdTop == null ? 0.12 : o.birdTop) + Math.random() * (o.birdRange == null ? 0.1 : o.birdRange),
        s: 0.75 + Math.random() * 1.15,
        v: 0.035 + Math.random() * 0.055,
        phase: Math.random() * Math.PI * 2,
        dir: Math.random() < 0.2 ? -1 : 1
      });
    }
    var leaves = [];
    var leafCount = o.leaves ? 16 : 0;
    for (var L = 0; L < leafCount; L++) {
      leaves.push({
        x: Math.random(),
        y: 0.2 + Math.random() * 0.7,
        s: 3 + Math.random() * 5,
        v: 0.04 + Math.random() * 0.07,
        drift: Math.random() * 6,
        rot: Math.random() * 6
      });
    }

    function resize() {
      var r = parent.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function tree(x, base, scale, sway) {
      ctx.save();
      ctx.translate(x, base);
      ctx.rotate(sway);
      ctx.scale(scale, scale);
      ctx.fillStyle = o.night ? "#14241c" : "#3e4e34";
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.quadraticCurveTo(-6, -70, -16, -138);
      ctx.lineTo(12, -134);
      ctx.quadraticCurveTo(8, -64, 9, 0);
      ctx.fill();
      var blobs = [[-36, -150, 48], [8, -176, 56], [46, -142, 42], [-4, -118, 50]];
      blobs.forEach(function (b, n) {
        ctx.fillStyle = o.night ? (n % 2 ? "#1c3d2c" : "#163226") : (n % 2 ? "#3f8a48" : "#2d6a3c");
        ctx.beginPath();
        ctx.ellipse(b[0] + Math.sin(sway * 18 + n) * 6, b[1], b[2], b[2] * 0.78, sway, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = o.night ? "#24543a" : "#67b15a";
      ctx.beginPath();
      ctx.ellipse(-8, -170, 26, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawBird(b, t) {
      var travel = (b.x + t * b.v * b.dir) % 1.35;
      if (travel < 0) travel += 1.35;
      var x = (travel - 0.15) * w;
      var y = (b.y + Math.sin(t * 0.85 + b.phase) * 0.035) * h;
      var flap = Math.sin(t * 8 + b.phase);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(b.dir * 1.35 * b.s, 1.35 * b.s);
      ctx.strokeStyle = o.night ? "rgba(236,242,255,.9)" : "rgba(18,26,38,.88)";
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = 2.4;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-20, 1);
      ctx.quadraticCurveTo(-9, -18 - flap * 16, 0, -1);
      ctx.quadraticCurveTo(9, -18 - flap * 16, 20, 1);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.2, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      var wind = state.wind;
      if (o.sun && !o.night) {
        var sx = w * 0.78;
        var sy = h * state.sunY;
        var glow = ctx.createRadialGradient(sx, sy, 8, sx, sy, Math.max(w, h) * 0.45);
        glow.addColorStop(0, "rgba(255,248,220,.95)");
        glow.addColorStop(0.15, "rgba(255,196,80,.5)");
        glow.addColorStop(1, "rgba(255,160,40,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(w, h) * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(t * 0.12);
        for (var r = 0; r < 14; r++) {
          ctx.rotate(Math.PI / 7);
          ctx.strokeStyle = "rgba(255,236,180," + (0.18 + 0.12 * Math.sin(t * 2 + r)) + ")";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(26, 0);
          ctx.lineTo(90 + Math.sin(t * 1.6 + r) * 28, 0);
          ctx.stroke();
        }
        ctx.restore();
        if (o.gleam) {
          var sweep = Math.sin(t * 0.55) * 0.5 + 0.5;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(-0.8 + sweep * 0.9);
          var lg = ctx.createLinearGradient(0, 0, 280, 30);
          lg.addColorStop(0, "rgba(255,255,255,0)");
          lg.addColorStop(0.45, "rgba(255,255,255,.7)");
          lg.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.moveTo(10, -6);
          ctx.lineTo(300, -36);
          ctx.lineTo(300, 16);
          ctx.lineTo(10, 8);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
      if (o.night) {
        var mx = w * 0.8;
        var my = h * state.sunY;
        ctx.fillStyle = "rgba(255,244,214,.18)";
        ctx.beginPath();
        ctx.arc(mx, my, 78, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff6d8";
        ctx.beginPath();
        ctx.arc(mx, my, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(12,20,48,.35)";
        ctx.beginPath();
        ctx.arc(mx - 10, my - 6, 22, 0, Math.PI * 2);
        ctx.fill();
      }
      if (o.clouds && !o.night) {
        for (var c = 0; c < 4; c++) {
          var cx = (((t * 0.018 * (0.7 + c * 0.2)) + c * 0.27) % 1.45 - 0.2) * w;
          var cy = h * (0.08 + c * 0.055);
          ctx.fillStyle = "rgba(255,255,255,.62)";
          ctx.beginPath();
          ctx.ellipse(cx, cy, 78, 24, 0, 0, Math.PI * 2);
          ctx.ellipse(cx + 46, cy + 8, 52, 18, 0, 0, Math.PI * 2);
          ctx.ellipse(cx - 40, cy + 8, 44, 16, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (o.gusts && wind > 0.2) {
        ctx.lineCap = "round";
        for (var g = 0; g < 7; g++) {
          var gy = h * (0.28 + g * 0.08);
          var gx = (((t * (0.22 + g * 0.04) * wind) + g * 0.17) % 1.5 - 0.25) * w;
          ctx.strokeStyle = o.night ? "rgba(200,220,255,.18)" : "rgba(255,255,255,.35)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.quadraticCurveTo(gx + 40, gy - 8, gx + 90, gy + 2);
          ctx.stroke();
        }
      }
      if (o.trees) {
        var base = h * 0.98;
        var gust = Math.sin(t * 0.85) * 0.045 + Math.sin(t * 1.9) * 0.02;
        gust *= wind;
        tree(w * 0.06, base, 1.2, gust);
        tree(w * 0.2, base + 8, 0.86, gust * 1.25 + 0.01);
        tree(w * 0.93, base, 1.35, -gust * 0.9);
        tree(w * 0.76, base + 18, 0.72, -gust * 1.1);
      }
      leaves.forEach(function (leaf) {
        var x = ((leaf.x + t * leaf.v * wind) % 1.25 - 0.1) * w;
        var y = leaf.y * h + Math.sin(t * 1.4 + leaf.drift) * 18;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 2 + leaf.rot);
        ctx.fillStyle = o.night ? "rgba(255,214,120,.8)" : "rgba(78,130,42,.8)";
        ctx.beginPath();
        ctx.ellipse(0, 0, leaf.s, leaf.s * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      birds.forEach(function (b) { drawBird(b, t); });
    }

    resize();
    window.addEventListener("resize", resize);
    runLoop(draw);
    return {
      setSun: function (y) { state.sunY = y; },
      setWind: function (v) { state.wind = v; }
    };
  }

  window.WSSky = { attach: attach };
})();
