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
from datetime import date, datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
SITE = ROOT / "site"
BASE_URL = "https://knight-logics.github.io/Whistle-Stop/"
RESTAURANT_ID = f"{BASE_URL}#restaurant"
WEBSITE_ID = f"{BASE_URL}#website"


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


def restaurant_schema() -> dict[str, Any]:
    return {
        "@type": ["Organization", "Restaurant"],
        "@id": RESTAURANT_ID,
        "name": "Whistle Stop Grill & Bar",
        "alternateName": "Whistle Stop Grill and Bar",
        "url": BASE_URL,
        "logo": abs_url("assets/logo.webp"),
        "image": [
            abs_url("assets/gallery/WSSunset.webp"),
            abs_url("assets/gallery/WSBar.webp"),
            abs_url("assets/gallery/WSFood.webp"),
            abs_url("assets/gallery/WSGoodTimes.webp"),
        ],
        "description": (
            "Safety Harbor's landmark grill and bar since 1995, serving "
            "American bar-and-grill favorites, cocktails, 18 taps, live music, "
            "and dog-friendly open-air patio dining on Main Street."
        ),
        "slogan": "Old Florida / New Vibe",
        "foundingDate": "1995",
        "telephone": "+17277261956",
        "email": "admin@whistlestopgrill.com",
        "priceRange": "$$",
        "servesCuisine": ["American", "Bar & Grill", "Burgers", "Seafood", "Pub Food"],
        "acceptsReservations": False,
        "hasMenu": abs_url("menu.html"),
        "address": {
            "@type": "PostalAddress",
            "streetAddress": "915 Main Street",
            "addressLocality": "Safety Harbor",
            "addressRegion": "FL",
            "postalCode": "34695",
            "addressCountry": "US",
        },
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": 27.990934,
            "longitude": -82.696838,
        },
        "hasMap": (
            "https://www.google.com/maps/search/?api=1&query="
            "Whistle+Stop+Grill+Bar+915+Main+Street+Safety+Harbor+FL"
        ),
        "sameAs": [
            "https://www.facebook.com/Whistlestopgrillandbar915",
            "https://www.instagram.com/whistlestop_grill/",
        ],
        "openingHoursSpecification": [
            {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Sunday"],
                "opens": "11:00",
                "closes": "21:00",
            },
            {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Friday", "Saturday"],
                "opens": "11:00",
                "closes": "22:00",
            },
        ],
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.4",
            "reviewCount": "2036",
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


def upcoming_event_schemas(limit: int = 3) -> list[dict[str, Any]]:
    events = read_json(SITE / "data" / "events.json").get("performances", [])
    today = date.today().isoformat()
    upcoming = [event for event in events if event.get("date", "") >= today]
    if len(upcoming) < limit:
        upcoming = events
    return [event_schema(event) for event in upcoming[:limit]]


def event_item_list(events: list[dict[str, Any]]) -> dict[str, Any]:
    """Carousel ItemList — link by URL only, never inline full Event objects."""
    return {
        "@type": "ItemList",
        "@id": f"{BASE_URL}#upcoming-events",
        "name": "Upcoming Whistle Stop events",
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
    return {
        "@type": "FAQPage",
        "@id": f"{BASE_URL}#faq",
        "mainEntity": [
            {
                "@type": "Question",
                "name": "Where is Whistle Stop Grill & Bar located?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": (
                        "Whistle Stop Grill & Bar is located at 915 Main Street "
                        "in downtown Safety Harbor, Florida 34695."
                    ),
                },
            },
            {
                "@type": "Question",
                "name": "What are the restaurant hours?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": (
                        "Whistle Stop is open Sunday through Thursday from 11 AM "
                        "to 9 PM, and Friday through Saturday from 11 AM to 10 PM."
                    ),
                },
            },
            {
                "@type": "Question",
                "name": "Does Whistle Stop have a dog-friendly patio?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes. Whistle Stop has a dog-friendly open-air patio on Main Street in Safety Harbor.",
                },
            },
            {
                "@type": "Question",
                "name": "Does Whistle Stop offer live music and events?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": (
                        "Yes. Whistle Stop hosts live music, open mic nights, "
                        "cornhole, book club events, happy hour specials, and "
                        "other community happenings."
                    ),
                },
            },
            {
                "@type": "Question",
                "name": "Where can I view the menu?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": f"The main menu, seasonal menu, and bar menu are available at {abs_url('menu.html')}.",
                },
            },
        ],
    }


def webpage(page: str, name: str, description: str, page_type: str = "WebPage") -> dict[str, Any]:
    url = BASE_URL if not page else abs_url(page)
    return {
        "@type": page_type,
        "@id": f"{url}#webpage",
        "url": url,
        "name": name,
        "description": description,
        "isPartOf": {"@id": WEBSITE_ID},
        "about": {"@id": RESTAURANT_ID},
        "inLanguage": "en-US",
    }


def main() -> None:
    events = upcoming_event_schemas()

    write_jsonld(
        SITE / "index.html",
        [
            website_schema(),
            restaurant_schema(),
            webpage(
                "",
                "Whistle Stop Grill & Bar | Safety Harbor, FL",
                "Safety Harbor's landmark grill and bar since 1995.",
            ),
            breadcrumb(""),
            faq_schema(),
            event_item_list(events),
        ],
    )
    write_jsonld(
        SITE / "events.html",
        [
            webpage(
                "events.html",
                "Events Calendar | Whistle Stop Grill & Bar",
                "Weekly happenings, live music, cornhole, book club, and ukulele jam at Whistle Stop Grill & Bar.",
            ),
            breadcrumb("events.html", "Events"),
            *events,
        ],
    )
    write_jsonld(
        SITE / "menu.html",
        [
            webpage(
                "menu.html",
                "Menu | Whistle Stop Grill & Bar",
                "Main menu, seasonal specials, and full bar at Whistle Stop Grill & Bar.",
            ),
            breadcrumb("menu.html", "Menu"),
            menu_schema(),
        ],
    )
    write_jsonld(
        SITE / "contact.html",
        [
            webpage(
                "contact.html",
                "Visit Whistle Stop | Directions & Hours",
                "Find Whistle Stop Grill & Bar at 915 Main Street in downtown Safety Harbor, FL.",
                "ContactPage",
            ),
            restaurant_schema(),
            breadcrumb("contact.html", "Visit"),
        ],
    )
    print("Updated schema on index, events, menu, and contact pages.")


if __name__ == "__main__":
    main()
