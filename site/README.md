# Whistle Stop Grill & Bar — Preview Rebuild

Knight Logics prospect demo. **Not production** — preview for client pitch.

## Run locally

```bash
cd "E:\Website Audit\High Prospective Clients\Whistle-Stop\site"
npx --yes serve -l 3456
```

Open http://localhost:3456

## Staff admin portal

**URL:** `admin.html` (password required · not indexed by Google)

Preview password: `whistlestop2026`

**Staff tabs only** (reviews pull from Google at launch; business/theme/settings hidden):

| Tab | Controls |
|-----|----------|
| Events | Calendar — add/remove dated performances |
| Menus | Edit items and prices by menu section |
| Promo Cards | Photo tiles on homepage & events page (with live preview) |
| Hero Images | Per-page hero photo grids |

Saves apply in-browser until you **Export** → replace `data/*.json` → run `python generate-schema.py` → push to GitHub.

## Update events (manual)

Edit `data/events.json`:

- **`recurring`** — weekly/monthly patterns (tacos, cornhole, book club)
- **`performances`** — one-off dates (each Friday/Saturday act)

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
| admin.html | Password-gated staff dashboard |

## Assets

Downloaded from whistlestopgrill.com (Wix CDN). Add Facebook photos to `assets/` and reference in HTML as needed.
