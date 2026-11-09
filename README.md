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

**https://whistle-stop.knightlogics.workers.dev/** (Cloudflare Worker; present from this one)

Every push to `master` redeploys it through Cloudflare Workers Builds (account Nickknight488@gmail.com, Worker `whistle-stop`, KV namespace `whistle-stop-content`). The old GitHub Pages copy at `knight-logics.github.io/Whistle-Stop/` still serves the files, but its **Publish live** depends on the retired Knight Command API and no longer works.

## Local preview

```powershell
cd site
npx serve .
```

## Staff admin

Open `/admin.html` on the Cloudflare site. Logins are real server-side accounts (owner, editor, staff) created under **Site admin → Staff logins**; the first visit to a fresh deployment asks for the owner account. **Publish live** writes straight to Cloudflare KV and is live in seconds; **Publish history** can undo any of the last 15 publishes. Contact, private-event and campaign-signup forms land in **Messages**.

Content note for agents: after the first admin publish, the six content files (`site.json`, `events.json`, `menus.json`, `reviews.json`, `promos.json`, `staff-schedule.json`) are served from KV, so editing them in git no longer changes the live site. Change content through the admin, or publish again after a repo edit. `worker/test/worker-smoke.mjs` covers the Worker (run it against `npx wrangler dev`).

The social demo routes Facebook, X, LinkedIn, Google Business Profile, and Nextdoor through one always-on Social Host (bridge + `ws-social.knightlogics.com` tunnel on Nick's PC). The old cloud fallback through knightlogics.com is offline, so posting needs that PC on. The poster asks once per session for the Social Host posting password. Install the host package on one Windows PC that stays awake—staff do not install it on every device.

Before a presentation, run `./TEST-SOCIAL-PREFLIGHT.ps1 -Strict` or click **Test all 5 — no post** inside Social Poster. Both verify the five Knight Logics demo targets without publishing anything.

Owner/editor workflow:

1. Open Events, Menus, or Other Pages. Full-page previews stay in a fixed scrollable window; click a calendar date, page section, or content block to edit it.
2. Save the draft on the current device.
3. Use **Publish live** to put the approved content on the live site (Cloudflare version: instant, with undo in Publish history).

The installed public and staff PWAs check for a new service worker on every online launch, activate the newest cache, and reload once when an existing installed app receives an update. Drafts remain local to the current device until **Publish live** is used; published content is then available to every device through the website.

On phones, install uses the same method as Handyman Ticket Manager: open the site in Safari (iPhone) or Chrome (Android), then follow the **Install** banner — Share → Add to Home Screen on iOS, or Install app on Android. Guest app: the public homepage. Staff app: `/admin.html`. The public header keeps the phone number visible down to 320px, its menu fills the mobile viewport, and the staff app uses a compact collapsible section bar so content starts near the top of the screen.

Campaign signups on the Cloudflare version go to the admin **Messages** inbox. The GitHub Pages version sent them to Knight Command's database, which is offline. The public campaign runtime contains aggregate counts only.

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

## Workspace

The one working copy lives at `E:\All Client Websites\Whistle-Stop` (GitHub: `Knight-Logics/Whistle-Stop`). On 2026-11-08 it was moved here from `E:\High Prospective Clients\Whistle-Stop` and merged with the older launcher-only copy that already sat in this folder, which added `START-DEMO.ps1` and `SYNC-TO-FLASH.ps1`. The superseded July 5 launcher drafts are kept in `packaging\_archive-old-copy-2026-07-05\` (git-ignored). Update any notes, shortcuts or agent instructions that still point at the old path.

Latest audit and agent handoff: `AUDIT-2026-11-08.md` (security issues to fix first, launch blockers, Cloudflare plan, and every change made that day).

Built and operated by Knight Logics for the Whistle Stop launch program.
