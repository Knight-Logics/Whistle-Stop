"""Write one public page per menu category from site/data/menus.json.

Prices come from that file. Re-run after a Toast menu sync.
"""

from __future__ import annotations

import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "site" / "data" / "menus.json"
SITE = ROOT / "site"
SITEMAP = SITE / "sitemap.xml"
LLMS = SITE / "llms.txt"
AI = SITE / "ai.txt"
BASE = "https://www.whistlestopgrill.com"

ANALYTICS = """
  <meta name="google-site-verification" content="aqJK5LwU_TJFyTtRrAXABfjKy7QnuoHSYEvBgjQUDUk" />
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-YPKSY8F4WJ"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-YPKSY8F4WJ');
  </script>
  <script>
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "ziegyrnm0m");
  </script>
"""


def esc(value) -> str:
    return html.escape(str(value or ""), quote=True)


def page_name(cat_id: str) -> str:
    return f"menu-{cat_id}.html"


def description(menu_label: str, cat_name: str, items: list) -> str:
    bits = []
    for item in items[:4]:
        price = item.get("price") or ""
        bits.append(f"{item.get('name')} {price}".strip())
    listed = ", ".join(bits)
    text = (
        f"{cat_name} at Whistle Stop Grill & Bar in Safety Harbor, on the {menu_label}. "
        f"{listed}. 915 Main Street."
    )
    return text[:165].rstrip()


def render_page(menu: dict, cat: dict, siblings: list[dict]) -> str:
    items = cat.get("items") or []
    name = cat["name"]
    file_name = page_name(cat["id"])
    url = f"{BASE}/{file_name}"
    title = f"{name} | Whistle Stop Grill & Bar, Safety Harbor"
    desc = description(menu["label"], name, items)
    rows = []
    for item in items:
        detail = f"<p>{esc(item.get('desc'))}</p>" if item.get("desc") else ""
        price = f"<span class=\"price\">{esc(item.get('price'))}</span>" if item.get("price") else ""
        rows.append(
            "<article class=\"menu-item visible\">"
            "<div class=\"menu-item-body\">"
            f"<h3>{esc(item.get('name'))}</h3>{detail}"
            "</div>"
            f"<div class=\"menu-item-actions\">{price}</div>"
            "</article>"
        )
    names = ", ".join(esc(item.get("name")) for item in items[:8])
    links = " ".join(
        f"<a href=\"{page_name(other['id'])}\">{esc(other['name'])}</a>"
        for other in siblings
        if other["id"] != cat["id"]
    )
    ld = json.dumps({
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": title,
        "url": url,
        "description": desc,
        "isPartOf": {"@id": f"{BASE}/#website"},
    }, ensure_ascii=False)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{esc(title)}</title>
  <link rel="canonical" href="{url}" />
  <meta name="description" content="{esc(desc)}" />
  <link rel="icon" href="assets/logo.webp" type="image/webp" />
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="css/main.css?v=44" />
  <script type="application/ld+json">
  {ld}
  </script>
  {ANALYTICS}
</head>
<body>
  <header class="site-header">
    <div class="container header-inner" data-include="partials/header.html"></div>
  </header>
  <main>
    <section class="page-hero">
      <div class="container">
        <p class="hero-eyebrow">{esc(menu['label'])} · 915 Main Street</p>
        <h1>{esc(name)} at Whistle Stop Grill &amp; Bar</h1>
        <p class="lead">{esc(name)} from the {esc(menu['label'])} at Whistle Stop Grill &amp; Bar in Safety Harbor. Prices follow the current menu.</p>
        <div class="btn-group">
          <a href="menu.html#{menu['id']}-{cat['id']}" class="btn btn-primary">See it on the full menu</a>
          <a href="tel:+17277261956" class="btn btn-outline">Call (727) 726-1956</a>
        </div>
      </div>
    </section>
    <section class="section-cream">
      <div class="container">
        <div class="menu-items">
          {''.join(rows)}
        </div>
        <p style="margin-top:1.5rem">Also on the {esc(menu['label'])}: {links}</p>
        <p>On this list: {names}.</p>
      </div>
    </section>
  </main>
  <footer class="site-footer" data-include="partials/footer.html"></footer>
  <nav class="mobile-cta" data-include="partials/mobile-cta.html"></nav>
  <script src="js/config-store.js?v=32"></script>
  <script src="js/site-apply.js?v=11"></script>
  <script src="js/includes.js" defer></script>
  <script src="js/main.js?v=11" defer></script>
</body>
</html>
"""


def main() -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    urls = []
    lines = ["## Menu category pages", ""]
    for menu in data["menus"]:
        for cat in menu["categories"]:
            file_name = page_name(cat["id"])
            (SITE / file_name).write_text(render_page(menu, cat, menu["categories"]), encoding="utf-8")
            urls.append(f"{BASE}/{file_name}")
            lines.append(f"- [{cat['name']}]({BASE}/{file_name}) ({menu['label']})")
    sitemap = SITEMAP.read_text(encoding="utf-8")
    block = "\n".join(
        f"  <url><loc>{url}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>"
        for url in urls
    )
    start = sitemap.find("  <!-- menu-categories:start -->")
    end = sitemap.find("  <!-- menu-categories:end -->")
    insertion = f"  <!-- menu-categories:start -->\n{block}\n  <!-- menu-categories:end -->"
    if start != -1 and end != -1:
        sitemap = sitemap[:start] + insertion + sitemap[end + len("  <!-- menu-categories:end -->") :]
    else:
        sitemap = sitemap.replace("</urlset>", insertion + "\n</urlset>")
    SITEMAP.write_text(sitemap, encoding="utf-8")

    llms = LLMS.read_text(encoding="utf-8")
    section = "\n".join(lines) + "\n"
    mark_a, mark_b = "<!-- menu-categories:start -->", "<!-- menu-categories:end -->"
    if mark_a in llms and mark_b in llms:
        llms = llms[: llms.find(mark_a)] + mark_a + "\n" + section + mark_b + llms[llms.find(mark_b) + len(mark_b) :]
    else:
        llms = llms.rstrip() + "\n\n" + mark_a + "\n" + section + mark_b + "\n"
    LLMS.write_text(llms, encoding="utf-8")

    ai = AI.read_text(encoding="utf-8")
    ai_line = "Menu-Category-Pages: https://www.whistlestopgrill.com/menu.html and one page per category, named menu-{category}.html"
    if "Menu-Category-Pages:" in ai:
        ai = "\n".join(ai_line if line.startswith("Menu-Category-Pages:") else line for line in ai.splitlines()) + "\n"
    else:
        ai = ai.rstrip() + "\n" + ai_line + "\n"
    AI.write_text(ai, encoding="utf-8")
    print(f"wrote {len(urls)} category pages")


if __name__ == "__main__":
    main()
