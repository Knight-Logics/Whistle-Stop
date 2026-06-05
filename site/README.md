# Whistle Stop Grill & Bar — Preview Rebuild

Knight Logics prospect demo. **Not production** — preview for client pitch.

## Run locally

```bash
cd "E:\Website Audit\High Prospective Clients\Whistle-Stop\site"
npx --yes serve -l 3456
```

Open http://localhost:3456

## Update events (easy path)

Edit `data/events.json`:

- **`recurring`** — weekly/monthly patterns (tacos, cornhole, book club)
- **`performances`** — one-off dates (each Friday/Saturday act)

No Wix, no monthly Canva poster required for the website calendar.

## Pages

| Page | Purpose |
|------|---------|
| index.html | Home, reviews carousel, stats |
| menu.html | Crawlable menus |
| events.html | Calendar + weekly cards |
| live-music.html | Music focus |
| happy-hour.html | HH SEO page |
| about.html | Story / owners |
| contact.html | Map, hours, NAP |
| order.html | Grubhub, Uber Eats, DoorDash, Toast |
| private-events.html | Group dining funnel |
| admin.html | Staff instructions |

## Assets

Downloaded from whistlestopgrill.com (Wix CDN). Add Facebook photos to `assets/` and reference in HTML as needed.
