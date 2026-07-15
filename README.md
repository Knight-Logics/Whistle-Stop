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

Open `site/admin.html` from the live site. The website editor and campaigns run in the browser. The full social demo routes Facebook, X, LinkedIn, Google Business Profile, and Nextdoor through one always-on Knight Command Social Host; Facebook Page and X remain available as cloud fallbacks if that host is offline. Install the host package on one Windows PC that stays awake—staff do not install it on every device.

Before a presentation, run `./TEST-SOCIAL-PREFLIGHT.ps1 -Strict` or click **Test all 5 — no post** inside Social Poster. Both verify the five Knight Logics demo targets without publishing anything.

Owner/editor workflow:

1. Open Events, Menus, or Other Pages. Full-page previews stay in a fixed scrollable window; click a calendar date, page section, or content block to edit it.
2. Save the draft on the current device.
3. Use **Publish live** to commit the approved content through Knight Command.

The installed public and staff PWAs check for a new service worker on every online launch, activate the newest cache, and reload once when an existing installed app receives an update. Drafts remain local to the current device until **Publish live** is used; published content is then available to every device through the website.

On phones, install uses the same method as Handyman Ticket Manager: open the site in Safari (iPhone) or Chrome (Android), then follow the **Install** banner — Share → Add to Home Screen on iOS, or Install app on Android. Guest app: the public homepage. Staff app: `/admin.html`. The public header keeps the phone number visible down to 320px, its menu fills the mobile viewport, and the staff app uses a compact collapsible section bar so content starts near the top of the screen.

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
| `site/llms.txt` | Optional factual site map for LLM tools that support the proposal |
| `generate-schema.py` | Production-domain JSON-LD and social-preview metadata generator |
| `knight-command/` | Reviewed copy of the deployed private campaign API module |

After changing public business, menu, or event data, run `python generate-schema.py` from the repository root before deployment. The generator removes expired performances from upcoming event schema and keeps canonical, Open Graph, and structured-data URLs aligned with the production domain.

Built and operated by Knight Logics for the Whistle Stop launch program.
