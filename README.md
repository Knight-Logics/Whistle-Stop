# Whistle Stop Grill & Bar — Preview Rebuild

## Client deliverables (PDF)

| PDF | Source |
|-----|--------|
| `AUDIT.pdf` | Full digital presence audit |
| `PROPOSAL.pdf` | Client proposal |
| `PRE-VISIT-AUDITS.pdf` | Quick reference + screenshot checklist |
| `WAVE.pdf` | Accessibility deep-dive (AIM 3.8/10) |

Regenerate after editing `.md` files: open each markdown in Word/Google Docs → Export PDF, or use pandoc + Edge print-to-PDF locally.

Custom static site preview for **Whistle Stop Grill & Bar** (915 Main Street, Safety Harbor, FL).

## Live preview

**https://knight-logics.github.io/Whistle-Stop/**

## Local preview

```powershell
cd site
npx serve .
```

## Update events (staff)

Edit `site/data/events.json` — recurring weekly items + one-off performances. See `site/admin.html` for instructions.

## Contents

| Path | Purpose |
|------|---------|
| `site/` | Static site (HTML, CSS, JS, assets) |
| `site/data/events.json` | Live music & events schedule |
| `site/data/reviews.json` | Google review carousel data |

Preview rebuild by Knight Logics — not affiliated with the live Wix site.
