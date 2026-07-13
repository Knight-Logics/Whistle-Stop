# Whistle Stop Grill & Bar — Phase 1 launch candidate

## Client deliverables (PDF)

| PDF | Source |
|-----|--------|
| `AUDIT.pdf` | Full digital presence audit |
| `PROPOSAL.pdf` | Client proposal |
| `PRE-VISIT-AUDITS.pdf` | Quick reference + screenshot checklist |
| `WAVE.pdf` | Accessibility deep-dive (AIM 3.8/10) |

Regenerate after editing `.md` files: open each markdown in Word/Google Docs → Export PDF, or use pandoc + Edge print-to-PDF locally.

Static website and staff operations portal for **Whistle Stop Grill & Bar** (915 Main Street, Safety Harbor, FL).

## Live preview

**https://knight-logics.github.io/Whistle-Stop/**

## Local preview

```powershell
cd site
npx serve .
```

## Staff admin

Open `site/admin.html` from the live site. The website editor, campaigns, and standard cloud social channels run in the browser. The optional Social Host package is prompted only when the always-on Knight Command host for LinkedIn, Nextdoor, and Facebook groups is offline. Install that package on one Windows PC that stays awake; staff do not install it on every device.

Owner/editor workflow:

1. Make and preview website changes.
2. Save the draft on the current device.
3. Use **Publish live** to commit the approved content through Knight Command.

Campaign signups and outreach records are private in Knight Command's database. The public campaign runtime contains aggregate counts only.

## Phase boundaries

- Phase 1: launch the rebuilt site, staff editor, campaign signup, social poster, installable mobile web app, and visibility foundation.
- Phase 2: connect the Toast Menus API/webhook, keep the current menu editor as an audited override, then adapt the design to Toast modifier groups and ordering data.
- Later: evaluate delivery-marketplace menu/account integrations independently; Toast menu sync does not automatically grant Grubhub, DoorDash, or Uber Eats write access.

## Contents

| Path | Purpose |
|------|---------|
| `site/` | Static site (HTML, CSS, JS, assets) |
| `site/data/events.json` | Live music & events schedule |
| `site/data/reviews.json` | Google review carousel data |
| `site/admin.html` | Browser-based staff portal |
| `site/manifest.webmanifest` | Public installable mobile web app |
| `site/admin-manifest.webmanifest` | Staff installable mobile web app |
| `knight-command/` | Reviewed copy of the deployed private campaign API module |

Built and operated by Knight Logics for the Whistle Stop launch program.
