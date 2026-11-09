/* Food categories for the homepage options: real names and prices from data/menus.json,
   menu links that jump straight to that section, and drawn food art (inline SVG). */
(function () {
  const M = "../menu.html#";
  const CATS = [
    { id: "burgers", name: "Burgers", href: M + "main-menu-burgers", cta: "See the burgers", count: "9 burgers", from: "$8.90", color: "#e8452c",
      line: "The Original comes with a fried green tomato, provolone, onion and aioli.",
      picks: [["Original Whistle Stop Burger", "$8.90"], ["Santa Fe Burger", "$9.90"], ["Crab & Shrimp Burger", "$11.90"]], art: "burger" },
    { id: "small-plates", name: "Small plates", href: M + "main-menu-small-plates", cta: "See the small plates", count: "13 to share", from: "$4.90", color: "#7bb33a",
      line: "Fried green tomatoes, blue crab cakes and smoked fish spread made local.",
      picks: [["Fancy Fried Green Tomatoes", "$6.90"], ["Blue Crab Cakes", "$11.90"], ["Smoked Fish Spread", "$7.90"]], art: "fgt" },
    { id: "tacos", name: "Tacos & plates", href: M + "main-menu-large-plates", cta: "See tacos & plates", count: "10 plates", from: "$8.90", color: "#f29a1f",
      line: "Baja fish or shrimp tacos, a fresh Gulf grouper dinner, a 12 oz rib eye.",
      picks: [["Baja Fish or Shrimp Tacos", "$11.90"], ["Balsamic Glazed Salmon", "$14.90"], ["12 oz Rib Eye Steak", "$17.90"]], art: "taco" },
    { id: "sandwiches", name: "Sandwiches & wraps", href: M + "main-menu-sandwiches", cta: "See sandwiches & wraps", count: "10 handhelds", from: "$7.90", color: "#c9822f",
      line: "The BLFGT, a fresh grouper sandwich and the Florida Club Wrap.",
      picks: [["BLFGT, The Ultimate BLT", "$8.90"], ["Fresh Grouper Sandwich", "MP"], ["Florida Club Wrap", "$10.90"]], art: "sandwich" },
    { id: "salads", name: "Salads", href: M + "main-menu-salads", cta: "See the salads", count: "6 salads", from: "$7.90", color: "#3fa36b",
      line: "Four Seasons with goat cheese and fruit, sesame-seared ahi, a hearty Cobb.",
      picks: [["Four Seasons Salad", "$7.90"], ["Ahi Tuna Salad", "$10.90"], ["Cobb Salad", "$11.90"]], art: "salad" },
    { id: "desserts", name: "Shakes & sweets", href: M + "main-menu-desserts", cta: "See shakes & sweets", count: "Shakes, sundaes, pie", from: "$2.70", color: "#f06aa0",
      line: "Milkshakes and malts from the drive-in days, soft serve and Key Lime Pie.",
      picks: [["Milkshakes & Malts", "$4.20"], ["Key Lime Pie", "$4.90"], ["Caitlin's Cake Sundae", "$5.90"]], art: "shake" },
    { id: "cocktails", name: "Cocktails", href: M + "bar-cocktails", cta: "See the cocktails", count: "Hip Sips & martinis", from: "$8", color: "#9ccc3c",
      line: "Old Florida Mule, Green Tomato Bloody Mary and half-off martinis on Mondays.",
      picks: [["Old Florida Mule", "$9"], ["Green Tomato Bloody Mary", "$10"], ["Key Lime Martini", "$10"]], art: "martini" },
    { id: "beer", name: "18 taps", href: M + "bar-beer", cta: "See what's on tap", count: "Drafts & flights", from: "$4.50", color: "#f2b632",
      line: "Domestic drafts, Florida craft on rotation and flights of four.",
      picks: [["Domestic Drafts", "$4.50"], ["Craft & Local", "$6–8"], ["Beer Flights", "$14"]], art: "beer" },
    { id: "kids", name: "Kids", href: M + "main-menu-kids", cta: "See the kids menu", count: "5 kid plates", from: "$5.90", color: "#2f9fd8",
      line: "Chicken tenders, The Best Hot Dog and Whistle Stop mac & cheese.",
      picks: [["Big Kid", "$7.90"], ["The Best Hot Dog", "$5.90"], ["Whistle Stop Mac & Cheese", "$5.90"]], art: "hotdog" },
  ];

  let uid = 0;
  const g = (stops, x2 = 0, y2 = 1) => {
    const id = "fa" + ++uid;
    const s = stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("");
    return { id, def: `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${s}</linearGradient>`, url: `url(#${id})` };
  };
  const svg = (defs, body, vb = "0 0 200 200") =>
    `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><defs>${defs}</defs>${body}</svg>`;
  const shadow = (cy = 182, rx = 66) => `<ellipse cx="100" cy="${cy}" rx="${rx}" ry="7" fill="#000" opacity=".16"/>`;
  const seeds = (pts) => pts.map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="1.7" transform="rotate(${r} ${x} ${y})" fill="#fff4d8"/>`).join("");

  /* The Original Whistle Stop Burger, one layer at a time (side view, 200 wide). */
  const LAYERS = {
    topBun() {
      const b = g([[0, "#f6c065"], [0.55, "#e39a3b"], [1, "#b8692a"]]);
      return { h: 78, svg: svg(b.def,
        `<path d="M14 70 Q14 6 100 6 Q186 6 186 70 Q186 78 176 78 H24 Q14 78 14 70Z" fill="${b.url}"/>
         <path d="M40 34 Q70 14 112 16" stroke="#fff" stroke-opacity=".35" stroke-width="7" fill="none" stroke-linecap="round"/>
         ${seeds([[62, 30, -20], [88, 22, 10], [116, 24, -8], [140, 34, 25], [76, 46, 15], [104, 42, -30], [130, 52, 5], [52, 52, 30], [156, 54, -15]])}`, "0 0 200 78") };
    },
    aioli() {
      return { h: 14, svg: svg("", `<path d="M18 4 Q34 -2 50 6 Q66 14 84 5 Q102 -2 120 6 Q138 14 156 5 Q172 -1 184 6 Q186 12 176 12 H24 Q14 12 18 4Z" fill="#f7eccb"/>`, "0 0 200 14") };
    },
    onion() {
      let r = "";
      for (let i = 0; i < 6; i++) r += `<ellipse cx="${30 + i * 28}" cy="9" rx="17" ry="6" fill="#f3e6f2" stroke="#b77fbd" stroke-width="2.6"/>`;
      return { h: 18, svg: svg("", r, "0 0 200 18") };
    },
    fgt() {
      const c = g([[0, "#e9b44c"], [1, "#c98a2a"]]);
      return { h: 26, svg: svg(c.def,
        `<rect x="16" y="3" width="80" height="20" rx="10" fill="${c.url}"/><rect x="104" y="3" width="80" height="20" rx="10" fill="${c.url}"/>
         <rect x="24" y="9" width="64" height="8" rx="4" fill="#9cc94f"/><rect x="112" y="9" width="64" height="8" rx="4" fill="#9cc94f"/>
         <g fill="#a5691f" opacity=".7"><circle cx="30" cy="6" r="1.4"/><circle cx="62" cy="20" r="1.4"/><circle cx="128" cy="6" r="1.4"/><circle cx="160" cy="20" r="1.4"/><circle cx="84" cy="5" r="1.2"/><circle cx="176" cy="19" r="1.2"/></g>`, "0 0 200 26") };
    },
    provolone() {
      return { h: 24, svg: svg("", `<path d="M10 4 H190 L180 12 L172 22 L160 11 H122 L112 23 L102 11 H64 L54 20 L44 11 H22Z" fill="#f8e7a0"/><path d="M10 4 H190 L186 8 H14Z" fill="#fff6cc"/>`, "0 0 200 24") };
    },
    patty() {
      const p = g([[0, "#7c4524"], [1, "#4f2a14"]]);
      return { h: 34, svg: svg(p.def,
        `<rect x="12" y="2" width="176" height="30" rx="15" fill="${p.url}"/>
         <g stroke="#3a1c0c" stroke-width="2.4" stroke-linecap="round" opacity=".55"><path d="M40 10 l8 0"/><path d="M70 22 l10 0"/><path d="M104 9 l9 0"/><path d="M140 20 l10 0"/><path d="M160 10 l7 0"/><path d="M28 22 l7 0"/></g>
         <path d="M30 8 Q100 2 170 8" stroke="#a36a42" stroke-width="3" fill="none" opacity=".6" stroke-linecap="round"/>`, "0 0 200 34") };
    },
    bottomBun() {
      const b = g([[0, "#eaa548"], [1, "#b8692a"]]);
      return { h: 40, svg: svg(b.def,
        `<path d="M16 4 H184 Q188 4 188 10 V18 Q188 38 160 38 H40 Q12 38 12 18 V10 Q12 4 16 4Z" fill="${b.url}"/><rect x="16" y="4" width="168" height="6" rx="3" fill="#f7d9a0"/>`, "0 0 200 40") };
    },
  };

  const ART = {
    burger() {
      const b = g([[0, "#f6c065"], [0.6, "#e39a3b"], [1, "#b8692a"]]);
      const bb = g([[0, "#eaa548"], [1, "#b8692a"]]);
      return svg(b.def + bb.def, `${shadow()}
        <path d="M30 146 H170 Q176 146 176 152 V156 Q176 174 152 174 H48 Q24 174 24 156 V152 Q24 146 30 146Z" fill="${bb.url}"/>
        <rect x="22" y="122" width="156" height="26" rx="13" fill="#5b3018"/>
        <path d="M20 116 H180 L170 128 L160 124 L152 140 L142 126 H110 L102 142 L92 126 H56 L48 136 L40 126 H28Z" fill="#ffc533"/>
        <rect x="28" y="106" width="144" height="12" rx="6" fill="#e2432f"/>
        <path d="M18 108 Q28 96 38 106 T58 106 T78 106 T98 106 T118 106 T138 106 T158 106 T182 106 Q184 114 176 114 H24 Q16 114 18 108Z" fill="#6cc04a"/>
        <path d="M22 98 Q22 34 100 34 Q178 34 178 98 Q178 104 172 104 H28 Q22 104 22 98Z" fill="${b.url}"/>
        <path d="M48 60 Q72 44 108 44" stroke="#fff" stroke-opacity=".35" stroke-width="7" fill="none" stroke-linecap="round"/>
        ${seeds([[70, 56, -20], [96, 48, 10], [122, 50, -8], [146, 62, 25], [84, 72, 15], [110, 68, -30], [134, 80, 5], [58, 80, 30]])}`);
    },
    fgt() {
      const c = g([[0, "#eebc55"], [1, "#c98a2a"]]);
      const disc = (y, x) => `<ellipse cx="${x}" cy="${y + 8}" rx="46" ry="16" fill="#b97a24"/><ellipse cx="${x}" cy="${y}" rx="46" ry="16" fill="${c.url}"/><ellipse cx="${x}" cy="${y}" rx="30" ry="9" fill="#a7cf5a" opacity=".9"/>`;
      return svg(c.def, `${shadow(178, 76)}<ellipse cx="100" cy="166" rx="84" ry="18" fill="#fff"/><ellipse cx="100" cy="164" rx="70" ry="13" fill="#eef1f3"/>
        ${disc(148, 104)}${disc(122, 92)}${disc(96, 108)}
        <g fill="#fffaf0"><circle cx="98" cy="90" r="5"/><circle cx="112" cy="96" r="4"/><circle cx="122" cy="88" r="4.5"/><circle cx="104" cy="100" r="3.5"/></g>
        <g fill="#e2432f"><rect x="90" y="84" width="7" height="6" rx="1.5"/><rect x="116" y="98" width="6" height="6" rx="1.5"/><rect x="126" y="92" width="5" height="5" rx="1.5"/></g>
        <g fill="#3f9b3a"><path d="M106 84 q4 -6 8 0 q-4 3 -8 0z"/><path d="M94 96 q4 -6 8 0 q-4 3 -8 0z"/></g>`);
    },
    taco() {
      const s = g([[0, "#ffd36b"], [1, "#e0a02e"]]);
      return svg(s.def, `${shadow(176, 72)}
        <path d="M30 160 Q30 70 100 70 Q170 70 170 160Z" fill="#c98a2a"/>
        <g fill="#6cc04a"><circle cx="48" cy="104" r="14"/><circle cx="70" cy="86" r="15"/><circle cx="96" cy="78" r="15"/><circle cx="124" cy="82" r="15"/><circle cx="148" cy="96" r="14"/><circle cx="160" cy="116" r="11"/></g>
        <g fill="#f29a6b"><path d="M58 96 q14 -18 30 -4 q-14 4 -30 4z"/><path d="M104 90 q16 -16 30 0 q-16 4 -30 0z"/></g>
        <g fill="#e2432f"><rect x="84" y="94" width="10" height="9" rx="2"/><rect x="128" y="102" width="9" height="9" rx="2"/><rect x="66" y="110" width="9" height="8" rx="2"/></g>
        <g stroke="#ffcf3a" stroke-width="3.4" stroke-linecap="round"><path d="M96 104 l10 -6"/><path d="M112 108 l8 -8"/><path d="M80 116 l10 -4"/><path d="M140 114 l8 -6"/></g>
        <path d="M24 164 Q24 82 100 82 Q176 82 176 164 Q176 170 168 170 H32 Q24 170 24 164Z" fill="${s.url}"/>
        <path d="M44 150 Q48 104 96 96" stroke="#fff" stroke-opacity=".4" stroke-width="6" fill="none" stroke-linecap="round"/>`);
    },
    sandwich() {
      const r = g([[0, "#f1b85a"], [1, "#c27a2c"]]);
      return svg(r.def, `${shadow(176, 76)}
        <path d="M22 148 Q22 128 44 128 H156 Q178 128 178 148 Q178 168 156 168 H44 Q22 168 22 148Z" fill="${r.url}"/>
        <path d="M24 124 Q34 112 44 122 T64 122 T84 122 T104 122 T124 122 T144 122 T176 122 L178 132 H22Z" fill="#6cc04a"/>
        <rect x="30" y="112" width="140" height="12" rx="6" fill="#e2432f"/>
        <path d="M28 108 Q44 98 60 108 T92 108 T124 108 T156 108 T176 108 L174 114 H28Z" fill="#b5462a"/>
        <rect x="34" y="102" width="132" height="8" rx="4" fill="#9cc94f"/>
        <path d="M22 98 Q22 58 100 58 Q178 58 178 98 Q178 104 172 104 H28 Q22 104 22 98Z" fill="${r.url}"/>
        <g stroke="#a8601f" stroke-width="3" stroke-linecap="round" opacity=".6"><path d="M62 72 l10 6"/><path d="M96 66 l10 6"/><path d="M130 72 l10 6"/></g>`);
    },
    salad() {
      return svg("", `${shadow(176, 70)}
        <g fill="#5fb045"><circle cx="58" cy="104" r="22"/><circle cx="88" cy="88" r="24"/><circle cx="118" cy="90" r="24"/><circle cx="144" cy="106" r="22"/><circle cx="100" cy="108" r="22"/></g>
        <g fill="#86cf5c"><circle cx="72" cy="94" r="12"/><circle cx="128" cy="96" r="12"/><circle cx="104" cy="84" r="10"/></g>
        <g fill="#e2432f"><circle cx="80" cy="104" r="9"/><circle cx="132" cy="112" r="8"/></g>
        <circle cx="110" cy="102" r="10" fill="#fff"/><circle cx="110" cy="102" r="5" fill="#ffc533"/>
        <g fill="#fffaf0"><circle cx="64" cy="112" r="4"/><circle cx="148" cy="98" r="3.5"/><circle cx="96" cy="94" r="3"/></g>
        <path d="M24 112 H176 Q172 172 100 172 Q28 172 24 112Z" fill="#ffffff"/>
        <path d="M24 112 H176 Q174 128 168 138 Q100 150 32 138 Q26 128 24 112Z" fill="#e9eef0"/>
        <rect x="20" y="108" width="160" height="8" rx="4" fill="#d6dde1"/>`);
    },
    shake() {
      const gl = g([[0, "#ff9cc4"], [1, "#e85d97"]]);
      return svg(gl.def, `${shadow(184, 46)}
        <rect x="112" y="18" width="10" height="70" rx="3" fill="#fff" transform="rotate(12 117 50)"/>
        <g fill="#e2432f" transform="rotate(12 117 50)"><rect x="112" y="24" width="10" height="7"/><rect x="112" y="40" width="10" height="7"/><rect x="112" y="56" width="10" height="7"/></g>
        <path d="M58 82 Q60 50 100 50 Q140 50 142 82Z" fill="#fff8f2"/><circle cx="100" cy="48" r="16" fill="#fff8f2"/><circle cx="82" cy="60" r="14" fill="#fff8f2"/><circle cx="118" cy="60" r="14" fill="#fff8f2"/>
        <circle cx="104" cy="30" r="9" fill="#d8202f"/><path d="M104 22 q4 -12 14 -14" stroke="#4f9d2d" stroke-width="2.6" fill="none"/>
        <path d="M54 80 H146 L134 168 Q133 176 124 176 H76 Q67 176 66 168Z" fill="${gl.url}"/>
        <path d="M54 80 H146 L144 94 H56Z" fill="#fff" opacity=".35"/>
        <path d="M70 100 L78 166" stroke="#fff" stroke-opacity=".45" stroke-width="6" stroke-linecap="round"/>`);
    },
    martini() {
      return svg("", `${shadow(184, 44)}
        <path d="M30 40 H170 L100 112Z" fill="#e8f6f4" opacity=".55"/>
        <path d="M44 54 H156 L100 112Z" fill="#b8e05a"/>
        <path d="M44 54 H156 L150 60 H50Z" fill="#d9f28f"/>
        <rect x="96" y="110" width="8" height="58" fill="#e8f6f4"/>
        <ellipse cx="100" cy="172" rx="38" ry="8" fill="#e8f6f4"/>
        <circle cx="152" cy="46" r="22" fill="#6fae2c"/><circle cx="152" cy="46" r="17" fill="#c9ec7a"/>
        <g stroke="#6fae2c" stroke-width="2"><path d="M152 30 V62"/><path d="M136 46 H168"/><path d="M141 35 L163 57"/><path d="M163 35 L141 57"/></g>
        <path d="M60 46 L94 104" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".55"/>`);
    },
    beer() {
      const be = g([[0, "#ffcb45"], [1, "#e8901c"]]);
      return svg(be.def, `${shadow(184, 56)}
        <path d="M140 76 H156 Q176 76 176 100 V124 Q176 148 156 148 H140" stroke="#dfe9ec" stroke-width="12" fill="none"/>
        <rect x="40" y="56" width="104" height="120" rx="10" fill="#dfe9ec"/>
        <rect x="48" y="66" width="88" height="102" rx="6" fill="${be.url}"/>
        <g fill="#fff6d6" opacity=".7"><circle cx="70" cy="140" r="3"/><circle cx="96" cy="116" r="2.5"/><circle cx="116" cy="148" r="3"/><circle cx="82" cy="96" r="2"/><circle cx="122" cy="100" r="2.4"/></g>
        <path d="M34 66 Q34 40 58 44 Q66 26 90 32 Q106 20 124 34 Q150 32 150 58 Q152 72 138 72 H46 Q34 72 34 66Z" fill="#fffdf6"/>
        <path d="M62 80 V156" stroke="#fff" stroke-opacity=".35" stroke-width="8" stroke-linecap="round"/>`);
    },
    hotdog() {
      const bun = g([[0, "#f1b85a"], [1, "#c27a2c"]]);
      return svg(bun.def, `${shadow(170, 80)}
        <path d="M18 132 Q18 112 40 112 H160 Q182 112 182 132 Q182 156 158 156 H42 Q18 156 18 132Z" fill="${bun.url}"/>
        <rect x="14" y="104" width="172" height="26" rx="13" fill="#c2452b"/>
        <path d="M30 108 Q30 104 34 106" stroke="#e97a5e" stroke-width="3" fill="none"/>
        <path d="M26 112 Q40 102 54 114 T82 114 T110 114 T138 114 T174 112" stroke="#ffc533" stroke-width="5" fill="none" stroke-linecap="round"/>
        <path d="M18 134 Q18 124 30 122 Q100 132 170 122 Q182 124 182 134 Q182 156 158 156 H42 Q18 156 18 134Z" fill="${bun.url}"/>`);
    },
  };

  ART.pie = () => {
    const f = g([[0, "#e9f5a8"], [1, "#c8e070"]]);
    return svg(f.def, `${shadow(176, 70)}
      <path d="M30 150 L170 128 L170 150 L30 172Z" fill="#c98a2a"/>
      <path d="M30 150 L170 128 L100 86Z" fill="#e2b25a"/>
      <path d="M30 150 L170 128 L170 138 L30 160Z" fill="${f.url}"/>
      <path d="M34 146 L164 126 L100 92Z" fill="${f.url}"/>
      <path d="M100 92 L164 126" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>
      <circle cx="110" cy="96" r="16" fill="#fffdf6"/><circle cx="98" cy="90" r="10" fill="#fffdf6"/><circle cx="122" cy="90" r="9" fill="#fffdf6"/>
      <path d="M116 80 q10 -10 22 -4" stroke="#6fae2c" stroke-width="5" fill="none" stroke-linecap="round"/>`);
  };
  ART.highball = () => {
    const d = g([[0, "#ffb347"], [0.55, "#ff6b3d"], [1, "#d62f4a"]]);
    return svg(d.def, `${shadow(184, 40)}
      <rect x="124" y="20" width="9" height="80" rx="3" fill="#fff" transform="rotate(14 128 60)"/>
      <path d="M62 52 H138 L130 172 Q129 178 122 178 H78 Q71 178 70 172Z" fill="#e8f6f4" opacity=".6"/>
      <path d="M66 74 H134 L128 168 Q127 172 122 172 H78 Q73 172 72 168Z" fill="${d.url}"/>
      <g fill="#fff" opacity=".55"><rect x="80" y="86" width="16" height="16" rx="3" transform="rotate(12 88 94)"/><rect x="104" y="104" width="16" height="16" rx="3" transform="rotate(-10 112 112)"/></g>
      <path d="M124 52 q24 -6 30 14 q-22 6 -30 -14z" fill="#8fcf3c"/><path d="M127 54 q18 -2 23 11" stroke="#d9f28f" stroke-width="3" fill="none"/>
      <path d="M76 82 L82 160" stroke="#fff" stroke-opacity=".45" stroke-width="5" stroke-linecap="round"/>`);
  };

  window.WSFOOD = {
    cats: CATS,
    art: (name) => (ART[name] ? ART[name]() : ""),
    layers: LAYERS,
    order: "../order.html",
    menu: "../menu.html",
  };
})();
