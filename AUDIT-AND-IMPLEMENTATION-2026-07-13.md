# Whistle Stop website, admin, campaign, social, and mobile audit

Date: July 13, 2026

## Executive result

The rebuild is a strong Phase 1 launch candidate, but the GitHub Pages preview is not the same thing as cutting the primary domain over from the current site. The public website, menu/order handoff, event editor, live content publisher, social poster UI, campaign landing page, and mobile layouts are real. Several admin cards are intentionally marked preview-only.

The most important defects found during this audit were corrected:

- The Social Host was offline, causing the package prompt after admin login. Its bridge and tunnel are now healthy, and both scheduled tasks exit successfully.
- Campaign API routes were missing from the live Knight Command deployment. A private Neon/Zoho/OpenAI campaign service is now deployed at `knightlogics.com`.
- Campaign failures previously looked like successful local email sends. Offline or provider failures now say that no email was sent and never mark a lead contacted.
- Campaign signup names and email addresses were stored in a public GitHub Pages JSON file. Public runtime data is now aggregate-only; private rows live in Neon.
- There was no installable mobile application. The public site and staff portal are now installable PWAs with sensitive/admin routes excluded from offline caches.
- The repository had no reproducible browser test dependency. Playwright is declared and locked, and the current modal-based admin workflows are covered.

Two external activation items remain:

1. The production OpenAI key is configured but its API account currently returns `insufficient_quota`. The service falls back to an audience plan and adds no invented leads. Billing/quota must be restored before automatic web discovery can return verified contacts.
2. The hourly GitHub Actions runner is implemented, but its matching Vercel/GitHub runner secret was not installed because that is a new long-lived production credential requiring explicit approval. Until installed, the hourly workflow will not be operational. The existing D&D campaign remains safe with `automation.enabled=false` and no end date.

## How `/admin` actually works

### Login and editor

`/admin.html` is a browser application. The website editor does not install software. Staff can open it on desktop, tablet, or mobile, sign in, edit drafts, preview them, and publish approved content through Knight Command.

Current draft/publish behavior:

1. Inputs update an in-browser draft preview.
2. **Save draft** stores the draft on that device.
3. **Publish live** sends the approved content bundle to the Knight Command content publisher.
4. Knight Command commits the changed JSON/media to the Whistle Stop repository.
5. GitHub Pages deploys the new public version.

The login itself remains demo-grade because the user directory and password hashes are downloadable with the static site. It keeps casual visitors out of the UI, but it is not suitable as the only security boundary. Sensitive actions are independently authorized by Knight Command, but a later authentication phase should move all staff identity and sessions server-side.

### Why the package prompt appears

After login, owner/editor/staff accounts with social-post permission run a Social Host health check. If neither the Knight Command remote bridge nor the browser-direct tunnel is healthy, `/admin` shows the package modal.

The package is only for browser-automated channels:

- LinkedIn
- Nextdoor
- Facebook community groups

Cloud channels do not require it:

- Facebook Page
- X
- Google Business Profile queue/cloud flow

The correct installation model is one always-on Windows PC, not every staff device. Once that host is online, staff can use `/admin` from any browser. The host is currently running at `E:\KnightLogics-Growth-System\Social\WhistleStop` and the public tunnel health endpoint is green.

## Admin capability audit

| Area | Current behavior | Status |
| --- | --- | --- |
| Events | Full calendar/page preview, weekly and one-off editor, draft/save/publish | Working |
| Menus | Full legacy editor and public preview; manual prices | Working for Phase 1 |
| Other pages | Browser draft editor and live publisher | Working |
| Social Poster | Knight Command cloud plus Social Host routing | Working in Knight Logics demo scope |
| Campaign Calendar | Private signups, audience plan, verified leads, manual send, publish | Backend working; AI quota blocked |
| QR Codes | Generates campaign/site QR destinations | Working |
| GBP manager | Preview/manual queue module | Not a complete live manager |
| Review manager | Preview module | Not connected to live review APIs |
| Ordering Hub | Preview/estimate and partner handoff | Not direct Toast ordering |
| Reports | Lightweight snapshot, not full GA4/business reporting | Preview/limited |
| Integrations, VIP, 86 Board | Clearly marked coming soon | Not implemented |

## Social operations audit

The Whistle Stop poster is connected to Knight Command's Social workspace. Live checks passed for:

- local bridge on port 8787;
- source-verified preflight for the configured Knight Logics Facebook, X, LinkedIn, GBP, and Nextdoor demo accounts;
- `https://ws-social.knightlogics.com/health`;
- the Whistle Stop bridge task at logon/boot;
- the 15-minute watchdog task.

The watchdog had two real defects: UTF-8 punctuation broke Windows PowerShell 5 parsing, and the VBScript wrapper contained invalid nested quoting. Both were corrected and the scheduled task now returns `0x00000000`.

No public post was created during this audit. Before client launch, replace the Knight Logics demo accounts/tokens with Whistle Stop-owned accounts and run one explicitly approved private/test post per channel.

## Campaign architecture now implemented

### Data flow

1. Staff creates a campaign with topic, details, goal, end time, and optional automation.
2. Creation automatically requests an audience plan.
3. The low-cost model uses web search to propose localized organizational contacts.
4. Knight Command rejects personal mailbox providers, guessed addresses, non-HTTPS evidence, and any email not visibly present on its cited public page.
5. Verified leads are stored privately in Neon with their source URL and provenance.
6. Manual sends or the hourly runner re-check global suppression before delivery.
7. Zoho delivery success is logged as sent; provider/API failure is logged as error and the lead remains eligible for review.
8. Every marketing message includes an advertisement disclosure, Whistle Stop's physical address, and a signed unsubscribe link.
9. The signup goal is a progress signal, not a stop condition. Automation continues until the configured campaign end time or a staff pause.

### Guardrails

- No local/demo fallback can claim that an email was delivered.
- Public campaign JSON contains no signup, lead, phone, or delivery-log rows.
- Public signup failure does not silently save data only in the visitor's browser.
- Automation defaults off.
- Automation requires an end time.
- Default cadence is one randomly selected eligible lead per hourly run, within 10 AM–7 PM Eastern.
- Suppressed recipients are excluded on every send.
- The public unsubscribe page accepts a signed, expiring token.
- The D&D campaign can continue collecting signups after 12; it does not close at the goal.

This design follows the operational requirements for truthful headers/subjects, postal address, opt-out, suppression, and continued responsibility for a vendor/automation sender. It is still appropriate to have business counsel review the final lead-acquisition policy before volume sending.

## Mobile application result

The most efficient Phase 1 mobile application is an installable Progressive Web App rather than maintaining separate iOS and Android codebases before the operating workflow is stable.

Implemented:

- public install manifest with Menu, Events, and Order shortcuts;
- separate staff manifest that opens `/admin`;
- standalone display and Whistle Stop icon/theme;
- offline fallback for public navigation;
- service worker cache versioning;
- network-only handling for `/admin`, campaign pages, unsubscribe, `/data`, `/downloads`, and API routes;
- verified mobile order bar;
- verified mobile campaign and social admin views with no horizontal page overflow.

Later, use Capacitor to wrap the PWA only if Whistle Stop needs App Store distribution, push notifications, camera/barcode workflows, or device integrations. The PWA should remain the shared UI.

## Phase plan

| Phase | Scope | Exit condition |
| --- | --- | --- |
| Phase 1A: operational launch | Domain cutover, HTTPS, sitemap/robots/canonicals, forms, staff training, real social accounts, smoke checks | `www.whistlestopgrill.com` serves rebuild; calls/order/events/admin work from mobile and desktop |
| Phase 1B: campaign activation | Restore AI quota, install runner secret, approve lead policy/template, set D&D end date, enable automation | One verified lead is discovered, one approved email is delivered, unsubscribe suppresses it, hourly job is green |
| Phase 2: Toast menus | Toast partner/API access, restaurant GUID, menu mapping, webhook plus 30-minute metadata fallback, preview/diff/publish, override/audit UI | Toast price/menu publish appears correctly on the website without manual re-entry |
| Phase 2B: ordering design | Model modifier groups, availability, sold-out/86 states, dietary data, and Toast ordering deep links | Public menu and order UX match Toast's real catalog behavior |
| Phase 3: marketplaces | Separate DoorDash, Uber Eats, and Grubhub account/API assessment and mapping | Each authorized marketplace sync is monitored independently |
| Phase 4: business app | Push tasks, manager approvals, 86 board, review queue, analytics, optional Capacitor stores | Staff adoption and support burden justify native packaging |

## Toast Phase 2 technical design

Do not make Toast the source of truth until access, IDs, and mapping are verified. The safe migration sequence is:

1. Obtain Toast integration credentials and the Whistle Stop restaurant GUID.
2. Pull the Menus API into a staging snapshot.
3. Map Toast menu/group/item/modifier GUIDs to website sections.
4. Show a staff diff: added, changed, hidden, price changed, and unavailable.
5. Publish the normalized snapshot only after validation.
6. Consume Toast's menus webhook when a menu is published.
7. Poll menu metadata every 30 minutes as a missed-webhook fallback.
8. Preserve a manual override layer with author, timestamp, reason, and expiry.
9. Keep marketplace mappings separate; do not assume Toast access grants write access to third-party delivery menus.

No Phase 2 visual redesign was made during this audit, honoring the requested phase boundary.

## Phase 1 launch checklist

- Point the final domain to the GitHub Pages deployment or the chosen production host.
- Confirm the existing Wix/legacy domain migration and redirects before cutover.
- Verify `https://www.whistlestopgrill.com/robots.txt` and `/sitemap.xml` after cutover.
- Submit the final sitemap in Google Search Console and Bing Webmaster Tools.
- Replace the contact form's email-client fallback with a configured server form endpoint if Whistle Stop wants centralized lead capture.
- Replace Knight Logics demo social accounts with Whistle Stop accounts.
- Restore OpenAI API quota.
- Explicitly approve creation of matching `WS_CAMPAIGN_RUNNER_KEY` secrets in the Vercel project and `Knight-Logics/Whistle-Stop` GitHub repository.
- Set the D&D campaign end time, review the discovered leads, approve the email, and then enable automation.
- Run one approved test email and one approved test post per real channel.
- Change the demo admin credentials and prioritize server-side authentication.

## Verification evidence

- `npm test`: campaign privacy/delivery safety, four menu-section editor cases, order handoff, alcohol exclusion, all admin tabs, content draft behavior, social state, public mobile, and mobile staff campaign/social checks.
- JavaScript syntax checks passed for the PWA, campaign browser code, and Knight Command API.
- Live campaign health: private database configured, Zoho configured, OpenAI key configured, public runtime aggregate-only.
- Live AI discovery currently falls back with a provider quota warning and adds zero unverified leads.
- Local and public Social Host health passed.
- Bridge task and watchdog task both returned `0x00000000`.

