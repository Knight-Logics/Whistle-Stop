"""Generate static JSON-LD from site data files.

Run from the repository root:

    python generate-schema.py

This keeps Rich Results schema in sync with the same JSON sources used by the
site UI. Future admin tooling should update site/data/events.json and
site/data/menus.json, then run this script before deploy.
"""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
SITE = ROOT / "site"
BASE_URL = "https://knight-logics.github.io/Whistle-Stop/"
RESTAURANT_ID = f"{BASE_URL}#restaurant"
WEBSITE_ID = f"{BASE_URL}#website"
ORDER_URL = "https://www.whistlestopgrill.com/online-ordering"
PHONE = "+17277261956"
EMAIL = "admin@whistlestopgrill.com"


def abs_url(path: str) -> str:
    return BASE_URL + path.lstrip("/")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_jsonld(page: Path, graph: list[dict[str, Any]]) -> None:
    data = {"@context": "https://schema.org", "@graph": graph}
    jsonld = json.dumps(data, indent=2, ensure_ascii=False)
    block = f'<script type="application/ld+json">\n{jsonld}\n  </script>'
    text = page.read_text(encoding="utf-8")
    pattern = re.compile(
        r'<script type="application/ld\+json">.*?</script>',
        flags=re.DOTALL,
    )
    if pattern.search(text):
        text = pattern.sub(block, text, count=1)
    else:
        text = text.replace("</head>", f"{block}\n</head>", 1)
    page.write_text(text, encoding="utf-8", newline="")


def load_site() -> dict[str, Any]:
    return read_json(SITE / "data" / "site.json")


def load_reviews() -> dict[str, Any]:
    return read_json(SITE / "data" / "reviews.json")


def restaurant_schema() -> dict[str, Any]:
    site = load_site()
    reviews = load_reviews()
    business = site.get("business", {})
    social = site.get("social", {})
    links = site.get("links", {})
    seo = site.get("seo", {})
    hours = site.get("hours", {})
    google = reviews.get("google", {})

    return {
        "@type": ["Organization", "Restaurant"],
        "@id": RESTAURANT_ID,
        "name": business.get("name", "Whistle Stop Grill & Bar"),
        "alternateName": "Whistle Stop Grill and Bar",
        "url": BASE_URL,
        "logo": abs_url("assets/logo.webp"),
        "image": [
            abs_url("assets/gallery/WSSunset.webp"),
            abs_url("assets/gallery/WSBar.webp"),
            abs_url("assets/gallery/WSFood.webp"),
            abs_url("assets/gallery/WSGoodTimes.webp"),
        ],
        "description": business.get(
            "description",
            (
                "Safety Harbor's landmark grill and bar since 1995, serving "
                "American bar-and-grill favorites, cocktails, 18 taps, live music, "
                "and dog-friendly open-air patio dining on Main Street."
            ),
        ),
        "slogan": business.get("tagline", "Old Florida / New Vibe"),
        "foundingDate": business.get("founded", "1995"),
        "telephone": business.get("phone", PHONE),
        "email": business.get("email", EMAIL),
        "priceRange": seo.get("priceRange", "$$"),
        "servesCuisine": seo.get(
            "cuisines", ["American", "Bar & Grill", "Burgers", "Seafood", "Pub Food"]
        ),
        "acceptsReservations": seo.get("acceptsReservations", False),
        "hasMenu": {"@id": abs_url("menu.html#menu")},
        "potentialAction": {
            "@type": "OrderAction",
            "target": {
                "@type": "EntryPoint",
                "urlTemplate": links.get("orderOnline", ORDER_URL),
                "actionPlatform": [
                    "https://schema.org/DesktopWebPlatform",
                    "https://schema.org/MobileWebPlatform",
                ],
            },
        },
        "address": {
            "@type": "PostalAddress",
            "streetAddress": business.get("street", "915 Main Street"),
            "addressLocality": business.get("city", "Safety Harbor"),
            "addressRegion": business.get("state", "FL"),
            "postalCode": business.get("zip", "34695"),
            "addressCountry": "US",
        },
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": business.get("geo", {}).get("lat", 27.990934),
            "longitude": business.get("geo", {}).get("lng", -82.696838),
        },
        "hasMap": links.get(
            "googleMaps",
            (
                "https://www.google.com/maps/search/?api=1&query="
                "Whistle+Stop+Grill+Bar+915+Main+Street+Safety+Harbor+FL"
            ),
        ),
        "sameAs": [
            social.get("facebook", "https://www.facebook.com/Whistlestopgrillandbar915"),
            social.get("instagram", "https://www.instagram.com/whistlestop_grill/"),
        ],
        "contactPoint": {
            "@type": "ContactPoint",
            "telephone": business.get("phone", PHONE),
            "email": business.get("email", EMAIL),
            "contactType": "customer service",
            "areaServed": "US-FL",
            "availableLanguage": "en-US",
        },
        "openingHoursSpecification": [
            {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Sunday"],
                "opens": hours.get("weekday", {}).get("opens", "11:00"),
                "closes": hours.get("weekday", {}).get("closes", "21:00"),
            },
            {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Friday", "Saturday"],
                "opens": hours.get("weekend", {}).get("opens", "11:00"),
                "closes": hours.get("weekend", {}).get("closes", "22:00"),
            },
        ],
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": str(google.get("rating", "4.4")),
            "reviewCount": str(google.get("count", "2036")),
            "bestRating": "5",
            "worstRating": "1",
        },
        "amenityFeature": [
            {"@type": "LocationFeatureSpecification", "name": "Dog-friendly patio", "value": True},
            {"@type": "LocationFeatureSpecification", "name": "Live music", "value": True},
            {"@type": "LocationFeatureSpecification", "name": "Open-air dining", "value": True},
        ],
    }


def website_schema() -> dict[str, Any]:
    return {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        "name": "Whistle Stop Grill & Bar",
        "url": BASE_URL,
        "publisher": {"@id": RESTAURANT_ID},
        "inLanguage": "en-US",
    }


def event_location_schema() -> dict[str, Any]:
    """Standalone Place for events — do not reuse RESTAURANT_ID here.

    Linking event location to the Restaurant node makes Google merge conflicting
    Organization/Restaurant/Place types into one item.
    """
    return {
        "@type": "Place",
        "name": "Whistle Stop Grill & Bar",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": "915 Main Street",
            "addressLocality": "Safety Harbor",
            "addressRegion": "FL",
            "postalCode": "34695",
            "addressCountry": "US",
        },
    }


def breadcrumb(page: str, label: str | None = None) -> dict[str, Any]:
    items = [
        {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": BASE_URL,
        }
    ]
    if page:
        items.append(
            {
                "@type": "ListItem",
                "position": 2,
                "name": label or page.removesuffix(".html").title(),
                "item": abs_url(page),
            }
        )
    return {
        "@type": "BreadcrumbList",
        "@id": f"{abs_url(page) if page else BASE_URL}#breadcrumb",
        "itemListElement": items,
    }


def offer_for_event(url: str, valid_from: str) -> dict[str, Any]:
    """Free-admission events: omit price (Google requires positive values)."""
    return {
        "@type": "Offer",
        "url": url,
        "availability": "https://schema.org/InStock",
        "validFrom": valid_from,
    }


def event_schema(event: dict[str, Any]) -> dict[str, Any]:
    title = event["title"]
    event_date = event["date"]
    start = event.get("startTime", "18:30")
    end = event.get("endTime", "21:30")
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    event_url = abs_url(f"events.html#{slug}-{event_date}")
    is_live_music = event.get("category") == "live-music" and "bingo" not in title.lower()
    schema_type = "MusicEvent" if is_live_music else "Event"
    valid_from = f"{event_date[:7]}-01T00:00:00-04:00"

    schema = {
        "@type": schema_type,
        "@id": event_url,
        "url": event_url,
        "name": f"{title} at Whistle Stop Grill & Bar",
        "startDate": f"{event_date}T{start}:00-04:00",
        "endDate": f"{event_date}T{end}:00-04:00",
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "location": event_location_schema(),
        "organizer": {"@id": RESTAURANT_ID},
        "image": abs_url("assets/gallery/WSRocker.webp" if is_live_music else "assets/live-music.webp"),
        "description": event.get(
            "note",
            "Live event at Whistle Stop Grill & Bar in downtown Safety Harbor.",
        ),
        "isAccessibleForFree": True,
        "offers": offer_for_event(abs_url("events.html"), valid_from),
    }
    if is_live_music:
        schema["performer"] = {"@type": "Person", "name": title}
    else:
        schema["performer"] = {"@type": "PerformingGroup", "name": title}
    return schema


def upcoming_event_schemas(limit: int | None = 3) -> list[dict[str, Any]]:
    events = read_json(SITE / "data" / "events.json").get("performances", [])
    today = date.today().isoformat()
    upcoming = sorted(
        [event for event in events if event.get("date", "") >= today],
        key=lambda event: (event.get("date", ""), event.get("startTime", "")),
    )
    if not upcoming:
        upcoming = sorted(events, key=lambda event: (event.get("date", ""), event.get("startTime", "")))
    selected = upcoming if limit is None else upcoming[:limit]
    return [event_schema(event) for event in selected]


def event_item_list(
    events: list[dict[str, Any]],
    *,
    schema_id: str = f"{BASE_URL}#upcoming-events",
    name: str = "Upcoming Whistle Stop events",
) -> dict[str, Any]:
    """Carousel ItemList — link by URL only, never inline full Event objects."""
    return {
        "@type": "ItemList",
        "@id": schema_id,
        "name": name,
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": i,
                "name": event["name"],
                "url": event["url"],
            }
            for i, event in enumerate(events, 1)
        ],
    }


def parse_price(price: str) -> dict[str, str] | None:
    match = re.search(r"\$([0-9]+(?:\.[0-9]{1,2})?)", price or "")
    if not match:
        return None
    return {"@type": "Offer", "price": match.group(1), "priceCurrency": "USD"}


def menu_schema() -> dict[str, Any]:
    data = read_json(SITE / "data" / "menus.json")
    sections = []
    for menu in data.get("menus", []):
        for category in menu.get("categories", []):
            items = []
            for item in category.get("items", []):
                menu_item = {
                    "@type": "MenuItem",
                    "name": item["name"],
                }
                if item.get("desc"):
                    menu_item["description"] = item["desc"]
                offer = parse_price(item.get("price", ""))
                if offer:
                    menu_item["offers"] = offer
                items.append(menu_item)
            sections.append(
                {
                    "@type": "MenuSection",
                    "name": category["name"],
                    "url": abs_url(f"menu.html#{category['id']}"),
                    "hasMenuItem": items,
                }
            )
    return {
        "@type": "Menu",
        "@id": abs_url("menu.html#menu"),
        "name": "Whistle Stop Grill & Bar Menu",
        "url": abs_url("menu.html"),
        "provider": {"@id": RESTAURANT_ID},
        "hasMenuSection": sections,
    }


def faq_schema() -> dict[str, Any]:
    site = load_site()
    faq_items = site.get("homepage", {}).get("faq", [])
    return {
        "@type": "FAQPage",
        "@id": f"{BASE_URL}#faq",
        "mainEntity": [
            {
                "@type": "Question",
                "name": item["q"],
                "acceptedAnswer": {"@type": "Answer", "text": item["a"]},
            }
            for item in faq_items
        ],
    }


def webpage(
    page: str,
    name: str,
    description: str,
    page_type: str = "WebPage",
    *,
    image: str | None = None,
    main_entity: str | None = None,
) -> dict[str, Any]:
    url = BASE_URL if not page else abs_url(page)
    schema: dict[str, Any] = {
        "@type": page_type,
        "@id": f"{url}#webpage",
        "url": url,
        "name": name,
        "description": description,
        "isPartOf": {"@id": WEBSITE_ID},
        "publisher": {"@id": RESTAURANT_ID},
        "about": {"@id": RESTAURANT_ID},
        "inLanguage": "en-US",
    }
    if image:
        schema["primaryImageOfPage"] = {"@type": "ImageObject", "url": abs_url(image)}
    if main_entity:
        schema["mainEntity"] = {"@id": main_entity}
    return schema


def happy_hour_offer_catalog() -> dict[str, Any]:
    return {
        "@type": "OfferCatalog",
        "@id": abs_url("happy-hour.html#happy-hour-offers"),
        "name": "Whistle Stop Grill & Bar Happy Hour Specials",
        "url": abs_url("happy-hour.html"),
        "provider": {"@id": RESTAURANT_ID},
        "itemListElement": [
            {
                "@type": "Offer",
                "name": "Daily Happy Hour",
                "description": "Happy hour from 4 PM to 7 PM daily with drink specials on Main Street.",
                "availability": "https://schema.org/InStock",
                "url": abs_url("happy-hour.html"),
            },
            {
                "@type": "Offer",
                "name": "Tuesday Happy Hour",
                "description": "Tuesday happy hour runs from 4 PM to close.",
                "availability": "https://schema.org/InStock",
                "url": abs_url("happy-hour.html"),
            },
            {
                "@type": "Offer",
                "name": "Martini Monday and Taco Night",
                "description": "Half-off martinis and taco specials on Monday evenings.",
                "availability": "https://schema.org/InStock",
                "url": abs_url("happy-hour.html"),
            },
        ],
    }


def order_options_schema() -> dict[str, Any]:
    return {
        "@type": "ItemList",
        "@id": abs_url("order.html#order-options"),
        "name": "Whistle Stop Grill & Bar ordering options",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Order direct for pickup",
                "url": ORDER_URL,
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": "Uber Eats delivery",
                "url": "https://www.ubereats.com/store/whistle-stop-grill-%26-bar/zy-ne-DhQW-IryRjRNjCIg",
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": "DoorDash delivery",
                "url": "https://www.doordash.com/search?query=Whistle+Stop+Grill+Safety+Harbor",
            },
            {
                "@type": "ListItem",
                "position": 4,
                "name": "Grubhub delivery",
                "url": "https://www.grubhub.com/search?searchQuery=whistle+stop+grill+safety+harbor",
            },
            {
                "@type": "ListItem",
                "position": 5,
                "name": "Whistle Stop eGift cards",
                "url": "https://order.toasttab.com/egift/whistle-stop-grill-bar",
            },
        ],
    }


def private_events_service_schema() -> dict[str, Any]:
    return {
        "@type": "Service",
        "@id": abs_url("private-events.html#private-events-service"),
        "name": "Private Events and Group Dining at Whistle Stop Grill & Bar",
        "serviceType": "Private dining, group dining, and casual event hosting",
        "description": (
            "Private parties, group dining, and casual celebrations with indoor and "
            "patio seating, full bar service, and downtown Safety Harbor atmosphere."
        ),
        "provider": {"@id": RESTAURANT_ID},
        "areaServed": {
            "@type": "City",
            "name": "Safety Harbor",
            "addressRegion": "FL",
            "addressCountry": "US",
        },
        "url": abs_url("private-events.html"),
        "offers": {
            "@type": "Offer",
            "url": abs_url("private-events.html"),
            "availability": "https://schema.org/InStock",
        },
    }


def page_graph(
    page: str,
    name: str,
    description: str,
    *,
    label: str | None = None,
    page_type: str = "WebPage",
    image: str | None = None,
    main_entity: str | None = None,
    extra: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    return [
        website_schema(),
        restaurant_schema(),
        webpage(
            page,
            name,
            description,
            page_type,
            image=image,
            main_entity=main_entity,
        ),
        breadcrumb(page, label),
        *(extra or []),
    ]


def main() -> None:
    homepage_events = upcoming_event_schemas(limit=3)
    all_events = upcoming_event_schemas(limit=None)

    write_jsonld(
        SITE / "index.html",
        page_graph(
            "",
            "Whistle Stop Grill & Bar | Safety Harbor, FL",
            "Safety Harbor's landmark grill and bar since 1995.",
            image="assets/gallery/WSSunset.webp",
            main_entity=RESTAURANT_ID,
            extra=[
                faq_schema(),
                event_item_list(homepage_events),
            ],
        ),
    )
    write_jsonld(
        SITE / "events.html",
        page_graph(
            "events.html",
            "Events Calendar | Whistle Stop Grill & Bar",
            "Weekly happenings, live music, cornhole, book club, and ukulele jam at Whistle Stop Grill & Bar.",
            label="Events",
            image="assets/gallery/WSRocker.webp",
            extra=[
                event_item_list(
                    all_events,
                    schema_id=abs_url("events.html#event-list"),
                    name="Whistle Stop Grill & Bar events calendar",
                ),
                *all_events,
            ],
        ),
    )
    write_jsonld(
        SITE / "menu.html",
        page_graph(
            "menu.html",
            "Menu | Whistle Stop Grill & Bar",
            "Main menu, seasonal specials, and full bar at Whistle Stop Grill & Bar.",
            label="Menu",
            image="assets/gallery/WSFood.webp",
            main_entity=abs_url("menu.html#menu"),
            extra=[menu_schema()],
        ),
    )
    write_jsonld(
        SITE / "contact.html",
        page_graph(
            "contact.html",
            "Visit Whistle Stop | Directions & Hours",
            "Find Whistle Stop Grill & Bar at 915 Main Street in downtown Safety Harbor, FL.",
            label="Visit",
            page_type="ContactPage",
            image="assets/gallery/WSGoodTimes.webp",
            main_entity=RESTAURANT_ID,
        ),
    )
    write_jsonld(
        SITE / "order.html",
        page_graph(
            "order.html",
            "Order Online | Whistle Stop Grill & Bar",
            "Order pickup from Whistle Stop Grill & Bar or choose delivery through Uber Eats, DoorDash, or Grubhub.",
            label="Order",
            image="assets/gallery/WSFood.webp",
            main_entity=abs_url("order.html#order-options"),
            extra=[order_options_schema()],
        ),
    )
    write_jsonld(
        SITE / "happy-hour.html",
        page_graph(
            "happy-hour.html",
            "Happy Hour Safety Harbor | Whistle Stop Grill & Bar",
            "Happy hour in Safety Harbor with craft cocktails, Hip Sips, 18 taps, and open-air patio seating.",
            label="Happy Hour",
            image="assets/gallery/WSDrinks.webp",
            main_entity=abs_url("happy-hour.html#happy-hour-offers"),
            extra=[happy_hour_offer_catalog()],
        ),
    )
    write_jsonld(
        SITE / "private-events.html",
        page_graph(
            "private-events.html",
            "Private Events | Whistle Stop Grill & Bar",
            "Private parties, group dining, and casual event space at Whistle Stop Grill & Bar in Safety Harbor.",
            label="Private Events",
            image="assets/gallery/WSLounge.webp",
            main_entity=abs_url("private-events.html#private-events-service"),
            extra=[private_events_service_schema()],
        ),
    )
    print("Updated schema on all public customer-facing pages.")


if __name__ == "__main__":
    main()
