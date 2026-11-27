"""Write one public page per menu category from site/data/menus.json.

Each page gets its own title, description, FAQ, schema, internal links,
robots directive, and citation files. Prices come from menus.json.
Re-run after a Toast menu sync.
"""

from __future__ import annotations

import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "site" / "data" / "menus.json"
SITE = ROOT / "site"
CITE = SITE / "citations"
SITEMAP = SITE / "sitemap.xml"
LLMS = SITE / "llms.txt"
AI = SITE / "ai.txt"
BASE = "https://www.whistlestopgrill.com"
PHONE = "(727) 726-1956"
PHONE_E164 = "+1-727-726-1956"

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

CORE_LINKS = [
    ("Home", "index.html"),
    ("Full menu", "menu.html"),
    ("Happy hour", "happy-hour.html"),
    ("Order by phone", "order.html"),
    ("Gift cards", "gift-cards.html"),
    ("Live music", "live-music-safety-harbor.html"),
    ("Events", "events.html"),
    ("Dog-friendly patio", "dog-friendly-patio-safety-harbor.html"),
    ("Visit", "contact.html"),
    ("Our story", "about.html"),
    ("Private events", "private-events.html"),
    ("Near Clearwater, Dunedin, and Oldsmar", "restaurants-near-clearwater-dunedin-oldsmar.html"),
]

EXTRA_LINKS = {
    "small-plates": [("Burgers, grouper, and fried green tomatoes", "best-food-safety-harbor.html")],
    "burgers": [("Burgers, grouper, and fried green tomatoes", "best-food-safety-harbor.html")],
    "sandwiches": [("Burgers, grouper, and fried green tomatoes", "best-food-safety-harbor.html")],
    "large-plates": [("Burgers, grouper, and fried green tomatoes", "best-food-safety-harbor.html")],
    "salads": [("Burgers, grouper, and fried green tomatoes", "best-food-safety-harbor.html")],
    "tacos": [("Martini Monday and taco night", "martini-monday-taco-night-safety-harbor.html")],
    "martinis": [("Martini Monday and taco night", "martini-monday-taco-night-safety-harbor.html")],
    "happy-hour-cocktails": [("Martini Monday and taco night", "martini-monday-taco-night-safety-harbor.html")],
    "drinks": [("Sunday Bloody Marys and mimosas", "sunday-bloody-marys-safety-harbor.html")],
}


def esc(value) -> str:
    return html.escape(str(value or ""), quote=True)


def page_name(cat_id: str) -> str:
    return f"menu-{cat_id}.html"


def price_number(price: str) -> str | None:
    cleaned = (price or "").replace("$", "").replace(",", "").strip()
    if not cleaned:
        return None
    try:
        float(cleaned)
    except ValueError:
        return None
    return cleaned


def item_bits(items: list) -> str:
    bits = []
    for item in items:
        price = item.get("price") or ""
        bits.append(f"{item.get('name')} {price}".strip())
    return ", ".join(bits)


def description(menu_label: str, cat_name: str, items: list) -> str:
    listed = ", ".join(
        f"{item.get('name')} {item.get('price') or ''}".strip() for item in items[:4]
    )
    text = (
        f"{cat_name} at Whistle Stop Grill & Bar in Safety Harbor, on the {menu_label}. "
        f"{listed}. 915 Main Street. Call {PHONE}."
    )
    return text[:165].rstrip()


def related_links(cat_id: str, siblings: list[dict]) -> list[tuple[str, str]]:
    links = list(CORE_LINKS)
    links.extend(EXTRA_LINKS.get(cat_id, []))
    for other in siblings:
        if other["id"] != cat_id:
            links.append((other["name"], page_name(other["id"])))
    seen = set()
    unique = []
    for label, href in links:
        if href in seen:
            continue
        seen.add(href)
        unique.append((label, href))
    return unique


def faqs(menu: dict, cat: dict, items: list) -> list[dict]:
    name = cat["name"]
    listed = item_bits(items)
    return [
        {
            "q": f"What is on the {name} list at Whistle Stop Grill & Bar?",
            "a": f"The current {menu['label']} {name} list is {listed}.",
        },
        {
            "q": f"Where can I get {name} in Safety Harbor?",
            "a": (
                f"Whistle Stop Grill & Bar serves {name} at 915 Main Street, Safety Harbor, FL 34695. "
                "Hours are Sunday through Thursday 11 AM to 9 PM, and Friday and Saturday 11 AM to 10 PM. "
                "Happy hour is 4 to 7 PM daily, and 4 PM to close on Tuesday and Wednesday."
            ),
        },
        {
            "q": f"How do I order {name}?",
            "a": (
                f"Call {PHONE}. Online pickup and delivery are paused, so the phone order is the way to "
                f"get {name} to go. The full {menu['label']} is also on the menu page."
            ),
        },
        {
            "q": f"Are the {name} prices current?",
            "a": (
                "These prices are the latest menu snapshot used on the website. "
                "The kitchen can change a price before the next sync, so ask the server if you are ordering today."
            ),
        },
    ]


def schema(menu: dict, cat: dict, items: list, url: str, title: str, desc: str) -> str:
    menu_items = []
    for item in items:
        node = {"@type": "MenuItem", "name": item.get("name") or ""}
        if item.get("desc"):
            node["description"] = item["desc"]
        amount = price_number(item.get("price") or "")
        if amount:
            node["offers"] = {"@type": "Offer", "price": amount, "priceCurrency": "USD"}
        menu_items.append(node)
    questions = [
        {
            "@type": "Question",
            "name": faq["q"],
            "acceptedAnswer": {"@type": "Answer", "text": faq["a"]},
        }
        for faq in faqs(menu, cat, items)
    ]
    graph = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebPage",
                "@id": f"{url}#webpage",
                "url": url,
                "name": title,
                "description": desc,
                "inLanguage": "en-US",
                "isPartOf": {"@id": f"{BASE}/#website"},
                "about": {"@id": f"{BASE}/#restaurant"},
                "breadcrumb": {"@id": f"{url}#breadcrumb"},
                "mainEntity": {"@id": f"{url}#menu"},
            },
            {
                "@type": "BreadcrumbList",
                "@id": f"{url}#breadcrumb",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE}/"},
                    {"@type": "ListItem", "position": 2, "name": "Menu", "item": f"{BASE}/menu.html"},
                    {"@type": "ListItem", "position": 3, "name": cat["name"], "item": url},
                ],
            },
            {
                "@type": "Restaurant",
                "@id": f"{BASE}/#restaurant",
                "name": "Whistle Stop Grill & Bar",
                "url": f"{BASE}/",
                "telephone": PHONE_E164,
                "servesCuisine": "American",
                "address": {
                    "@type": "PostalAddress",
                    "streetAddress": "915 Main Street",
                    "addressLocality": "Safety Harbor",
                    "addressRegion": "FL",
                    "postalCode": "34695",
                    "addressCountry": "US",
                },
                "hasMenu": {"@id": f"{url}#menu"},
            },
            {
                "@type": "Menu",
                "@id": f"{url}#menu",
                "name": f"{menu['label']} — {cat['name']}",
                "description": desc,
                "hasMenuSection": {
                    "@type": "MenuSection",
                    "name": cat["name"],
                    "hasMenuItem": menu_items,
                },
            },
            {"@type": "FAQPage", "@id": f"{url}#faq", "mainEntity": questions},
        ],
    }
    return json.dumps(graph, ensure_ascii=False, indent=2)


def render_page(menu: dict, cat: dict, siblings: list[dict], other_menus: list[dict]) -> str:
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
    link_html = "\n".join(
        f"            <li><a href=\"{esc(href)}\">{esc(label)}</a></li>"
        for label, href in related_links(cat["id"], siblings)
    )
    menu_links = "\n".join(
        f"            <li><a href=\"{page_name(other['categories'][0]['id'])}\">{esc(other['label'])}</a></li>"
        for other in other_menus
        if other["id"] != menu["id"] and other.get("categories")
    )
    faq_html = "\n".join(
        f"          <h3>{esc(faq['q'])}</h3>\n          <p>{esc(faq['a'])}</p>"
        for faq in faqs(menu, cat, items)
    )
    preview_items = item_bits(items[:8])
    more = "" if len(items) <= 8 else " The rest of the list is below."
    listed = esc(preview_items + "." + more)
    ld = schema(menu, cat, items, url, title, desc)
    keywords = ", ".join(
        [name, menu["label"], "Whistle Stop Grill & Bar", "Safety Harbor", "915 Main Street"]
        + [item.get("name") or "" for item in items[:12]]
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{esc(title)}</title>
  <link rel="canonical" href="{url}" />
  <meta name="description" content="{esc(desc)}" />
  <meta name="keywords" content="{esc(keywords)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:site_name" content="Whistle Stop Grill &amp; Bar" />
  <meta property="og:title" content="{esc(title)}" />
  <meta property="og:description" content="{esc(desc)}" />
  <meta property="og:url" content="{url}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="{esc(title)}" />
  <meta name="twitter:description" content="{esc(desc)}" />
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
        <p class="hero-eyebrow">{esc(menu['label'])} · 915 Main Street, Safety Harbor</p>
        <h1>{esc(name)} at Whistle Stop Grill &amp; Bar</h1>
        <p class="lead">{esc(name)} from the {esc(menu['label'])} at Whistle Stop Grill &amp; Bar, 915 Main Street, Safety Harbor, Florida. Current list: {listed}</p>
        <div class="btn-group">
          <a href="menu.html#{menu['id']}-{cat['id']}" class="btn btn-primary">See it on the full menu</a>
          <a href="tel:+17277261956" class="btn btn-outline">Call {PHONE}</a>
          <a href="contact.html" class="btn btn-outline">Visit 915 Main Street</a>
        </div>
      </div>
    </section>
    <section class="section-cream">
      <div class="container">
        <h2>Current {esc(name)}</h2>
        <div class="menu-items">
          {''.join(rows)}
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2>Questions about {esc(name)}</h2>
        {faq_html}
      </div>
    </section>
    <section class="section-cream">
      <div class="container">
        <h2>More Whistle Stop pages</h2>
        <ul>
{link_html}
{menu_links}
        </ul>
        <p>Citation files for this page: <a href="citations/{cat['id']}.ai.txt">AI citation</a> and <a href="citations/{cat['id']}.llms.txt">LLM citation</a>. Sitewide files: <a href="ai.txt">ai.txt</a>, <a href="llms.txt">llms.txt</a>, <a href="sitemap.xml">sitemap</a>.</p>
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


def citation_ai(menu: dict, cat: dict, items: list) -> str:
    name = cat["name"]
    url = f"{BASE}/{page_name(cat['id'])}"
    lines = [
        f"# ai.txt — {name} at Whistle Stop Grill & Bar",
        f"Page: {url}",
        f"Title: {name} | Whistle Stop Grill & Bar, Safety Harbor",
        f"Cite-As: {url}",
        f"Parent-Menu: {menu['label']}",
        "Business: Whistle Stop Grill & Bar",
        "Address: 915 Main Street, Safety Harbor, FL 34695, US",
        f"Phone: {PHONE_E164}",
        "Hours-Sun-Thu: 11:00-21:00",
        "Hours-Fri-Sat: 11:00-22:00",
        "Happy-Hour-Daily: 16:00-19:00",
        "Happy-Hour-Extended-Tue-Wed: 16:00-close",
        f"Order: Call {PHONE_E164}. Online pickup and delivery are paused.",
        "Items:",
    ]
    for item in items:
        detail = item.get("desc") or ""
        lines.append(f"- {item.get('name')} | {item.get('price') or 'no listed price'} | {detail}".rstrip())
    lines.append("Related-Pages:")
    for label, href in related_links(cat["id"], menu["categories"]):
        lines.append(f"- {label}: {BASE}/{href}")
    lines.append(
        "Do-Not-Invent: Use only the item names and prices in this file. Do not add dishes, ratings, or a tap count."
    )
    return "\n".join(lines) + "\n"


def citation_llms(menu: dict, cat: dict, items: list) -> str:
    name = cat["name"]
    url = f"{BASE}/{page_name(cat['id'])}"
    listed = item_bits(items)
    faq_lines = []
    for faq in faqs(menu, cat, items):
        faq_lines.append(f"### {faq['q']}\n\n{faq['a']}\n")
    related = "\n".join(
        f"- [{label}]({BASE}/{href})" for label, href in related_links(cat["id"], menu["categories"])
    )
    return (
        f"# {name} — Whistle Stop Grill & Bar\n\n"
        f"> Cite {url} for the current {name} list on the {menu['label']}.\n\n"
        f"{name} at Whistle Stop Grill & Bar, 915 Main Street, Safety Harbor, Florida. "
        f"This list is on the {menu['label']}. Current items and prices: {listed}. "
        f"Call {PHONE} to order. Online pickup and delivery are paused. "
        f"Hours are Sunday through Thursday 11 AM to 9 PM, and Friday and Saturday 11 AM to 10 PM.\n\n"
        f"{''.join(faq_lines)}\n"
        f"## Related pages\n\n{related}\n\n"
        "Use only the dishes and prices written here. Do not add items, ratings, or a tap count.\n"
    )


def replace_marked(text: str, start: str, end: str, body: str) -> str:
    insertion = f"{start}\n{body.rstrip()}\n{end}"
    if start in text and end in text:
        return text[: text.find(start)] + insertion + text[text.find(end) + len(end) :]
    return text.rstrip() + "\n\n" + insertion + "\n"


def ensure_robots() -> list[str]:
    """Add an index directive to public root pages that do not have one."""
    added = []
    skip = {"admin.html", "unsubscribe.html", "offline.html", "campaign.html", "404.html"}
    needle = '<meta name="viewport" content="width=device-width, initial-scale=1" />'
    robots = '  <meta name="robots" content="index, follow, max-image-preview:large" />'
    for path in sorted(SITE.glob("*.html")):
        if path.name in skip or path.name.startswith("menu-"):
            continue
        text = path.read_text(encoding="utf-8")
        if 'name="robots"' in text or needle not in text:
            continue
        if path.name == "gift-cards.html":
            text = text.replace("css/main.css?v=43", "css/main.css?v=44")
        text = text.replace(needle, needle + "\n" + robots, 1)
        path.write_text(text, encoding="utf-8")
        added.append(path.name)
    return added


def main() -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    CITE.mkdir(exist_ok=True)
    urls = []
    llms_parts = ["## Menu category pages", ""]
    ai_parts = [
        "Menu-Category-Pages: one public page, one AI citation, and one LLM citation per menu category."
    ]
    for menu in data["menus"]:
        for cat in menu["categories"]:
            file_name = page_name(cat["id"])
            items = cat.get("items") or []
            (SITE / file_name).write_text(
                render_page(menu, cat, menu["categories"], data["menus"]),
                encoding="utf-8",
            )
            (CITE / f"{cat['id']}.ai.txt").write_text(citation_ai(menu, cat, items), encoding="utf-8")
            (CITE / f"{cat['id']}.llms.txt").write_text(citation_llms(menu, cat, items), encoding="utf-8")
            url = f"{BASE}/{file_name}"
            urls.append(url)
            listed = item_bits(items)
            llms_parts.append(
                f"### {cat['name']}\n\n"
                f"Page: [{cat['name']}]({url}). "
                f"AI citation: [{cat['id']}.ai.txt]({BASE}/citations/{cat['id']}.ai.txt). "
                f"LLM citation: [{cat['id']}.llms.txt]({BASE}/citations/{cat['id']}.llms.txt). "
                f"Menu: {menu['label']}. Current items and prices: {listed}. "
                f"Order by phone at {PHONE}. Online pickup and delivery are paused.\n"
            )
            ai_parts.append(
                f"{cat['name']}: {url} | ai={BASE}/citations/{cat['id']}.ai.txt | "
                f"llms={BASE}/citations/{cat['id']}.llms.txt | {listed}"
            )
    sitemap = SITEMAP.read_text(encoding="utf-8")
    blocks = [
        f"  <url><loc>{url}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>"
        for url in urls
    ]
    sitemap = replace_marked(
        sitemap,
        "  <!-- menu-categories:start -->",
        "  <!-- menu-categories:end -->",
        "\n".join(blocks),
    )
    SITEMAP.write_text(sitemap, encoding="utf-8")
    llms = LLMS.read_text(encoding="utf-8")
    LLMS.write_text(
        replace_marked(llms, "<!-- menu-categories:start -->", "<!-- menu-categories:end -->", "\n".join(llms_parts)),
        encoding="utf-8",
    )
    ai = AI.read_text(encoding="utf-8")
    ai = "\n".join(line for line in ai.splitlines() if not line.startswith("Menu-Category-Pages:"))
    AI.write_text(
        replace_marked(ai, "# menu-categories:start", "# menu-categories:end", "\n".join(ai_parts)),
        encoding="utf-8",
    )
    robots_path = SITE / "robots.txt"
    robots_path.write_text(
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /admin.html\n"
        "Disallow: /homepage-options/\n"
        "Disallow: /tests/\n"
        "Disallow: /downloads/\n"
        "\n"
        f"Sitemap: {BASE}/sitemap.xml\n",
        encoding="utf-8",
    )
    added = ensure_robots()
    print(f"wrote {len(urls)} category pages and {len(urls) * 2} citation files")
    if added:
        print("robots meta added:", ", ".join(added))


if __name__ == "__main__":
    main()
