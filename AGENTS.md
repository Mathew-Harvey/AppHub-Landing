# AGENTS.md - AppHub Landing (AI Agent Reference)

## Overview
AppHub-Landing is the marketing site at `my-app-hub.com`. It is a **single static HTML file** (no framework, no build step, no env vars) deployed via GitHub Pages from this repo. The CNAME file points the custom domain at GitHub.

## Files
- [index.html](index.html) — the entire site: markup, inline CSS, inline JS, and the analytics vendor snippets.
- [assets/analytics.js](assets/analytics.js) — small helper that fans landing-page events to Mixpanel and PostHog. Hotjar/Contentsquare is passive (recordings/heatmaps only).
- [assets/](assets/) — images.
- [CNAME](CNAME), [sitemap.xml](sitemap.xml), [robots.txt](robots.txt) — GitHub Pages plumbing.

## Routing
Single page, in-page anchors only (`#product`, `#whats-new`, `#how-it-works`, `#features`, `#webintel`, `#pricing`, `#get-started`). No router.

## Outbound CTAs
- Register: `https://app.my-app-hub.com/register`
- Login: `https://app.my-app-hub.com/login`
- Plus checkout: `https://api.my-app-hub.com/api/subscription/checkout-landing`

## Analytics

The site loads four trackers in this order from inside the `<head>`:

| Vendor | Purpose | Config location |
|---|---|---|
| Meta Pixel | Paid-ads attribution (`PageView`) | Hardcoded in `index.html` |
| Mixpanel | Event analytics (CTA clicks, section views, custom funnels) | `window.APPHUB_ANALYTICS_CONFIG.mixpanelToken` |
| Contentsquare / Hotjar | Session recordings + heatmaps | `window.APPHUB_ANALYTICS_CONFIG.contentsquareScriptUrl` |
| PostHog | Event analytics + session replay + Web Analytics | `window.APPHUB_ANALYTICS_CONFIG.posthogKey` / `posthogHost` |

All public install values live in one inline block near the top of `index.html`:

```html
<script>
window.APPHUB_ANALYTICS_CONFIG = {
  mixpanelToken: '...',
  contentsquareScriptUrl: '...',
  posthogKey: '...',
  posthogHost: 'https://us.i.posthog.com'
};
</script>
```

### Mixpanel
- **Snippet:** Standard Mixpanel browser CDN snippet, then `mixpanel.init(token, { persistence: 'localStorage', track_pageview: false })`.
- **`track_pageview: false`:** Pageviews fire as the custom `landing_page_view` event from `assets/analytics.js` so the payload carries UTM, path, and referrer in one place.
- **Super properties:** `app: 'AppHub Landing'`, `platform: 'web'`.
- **Events fired from this site:**
  - `landing_page_view` — once per page load (DOMContentLoaded).
  - `cta_click` — every `<a href>` click. Properties: `destination` (`register` | `login` | `checkout` | `webintel` | `section` | `external`), `link_text`, `link_url`, `section`.
  - `section_view` — first time a section becomes 40% visible. Properties: `section`.
  - `theme_toggle` — when the visitor switches light/dark. Properties: `theme`.
- **No identity** — this is anonymous marketing traffic. The signed-in app at `AppHub-Web` handles `identify` / `sign_up_completed` / `reset` once the visitor converts.
- **Consent:** No consent gate (no EU/CA users today). Add `opt_out_tracking_by_default: true` and a consent banner if that changes.

### PostHog
- **Snippet:** Current PostHog browser snippet (recommended, includes the full method stub list).
- **Init options:** `defaults: '2026-01-30'` for the snapshot config, `capture_pageview: true`, `capture_pageleave: true`, `person_profiles: 'identified_only'`.
- Web Analytics (Installation Health page) depends on `$pageview` + `$pageleave` autocapture, so do not disable those.

### Custom events
`window.AppHubAnalytics.track(eventName, properties)` from `assets/analytics.js` sends events to **both** Mixpanel and PostHog. Hotjar gets no custom events — it only does passive recordings/heatmaps unless that changes.

## Deployment
Commit and push to `main`. GitHub Pages auto-deploys.

## Adding a new tracked event
1. Add a call to `window.AppHubAnalytics.track('event_name', { ... })` from wherever fires it (inline HTML attribute or `assets/analytics.js`).
2. Keep names snake_case.
3. Never put email addresses, names, or other free-text user input in properties. Use stable enum-like categories.
