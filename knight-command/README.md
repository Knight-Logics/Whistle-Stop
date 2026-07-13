# Whistle Stop campaign service

`whistle-stop-campaigns.js` is the Knight Command serverless module for Whistle Stop campaigns. It is designed to be installed at:

`E:\KnightLogics-Growth-System\MainSite\api\_lib\whistle-stop-campaigns.js`

It uses the existing production configuration:

- `KL_DATABASE_URL` for private signups, verified leads, suppression, and delivery logs.
- `EMAIL_AGENT_ZOHO_*` plus `WS_OUTREACH_FROM_EMAIL` for actual email delivery.
- `OPENAI_API_KEY` with `gpt-5.4-nano` by default for lowest-cost audience planning and web search.
- `WS_ADMIN_PASSWORD_HASH` for staff requests.
- `CRON_SECRET`, `WS_CAMPAIGN_RUNNER_KEY`, or the existing `WS_SOCIAL_API_KEY` for an hourly runner.

The public GitHub Pages runtime must contain aggregate counts only. The service never accepts a web-found email unless the email is visibly present on the returned HTTPS source page, and it suppresses unsubscribed addresses before every send.
