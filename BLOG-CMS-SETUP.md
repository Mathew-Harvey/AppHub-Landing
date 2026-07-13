# Blog + CMS — how it works and how to set it up

This repo now has a **blog** that a non-technical person can publish to through a
web-based **CMS** — no GitHub account, no code, no command line. This document
explains the architecture and the one-time setup on Netlify.

---

## 1. How it works (the 60-second version)

```
Editor writes a post at  my-app-hub.com/admin/
        │  (logs in with email + password — Netlify Identity)
        ▼
Decap CMS commits a Markdown file to  content/blog/<slug>.md
        │  (via Git Gateway — the editor never sees GitHub)
        ▼
The commit triggers a Netlify deploy
        │
        ▼
scripts/build-blog.js turns every Markdown file into a static page:
   content/blog/*.md  →  blog/<slug>/index.html   (article)
                         blog/index.html           (listing)
                         blog/rss.xml              (feed)
                         sitemap.xml               (updated)
        ▼
The post is live at  my-app-hub.com/blog/<slug>/
```

**Source of truth = Markdown.** The HTML under `blog/` is generated on every
deploy and is _not_ committed (it's in `.gitignore`).

Pages are **pre-rendered at build time** (not rendered in the browser) so every
post has real `<title>`, meta description, and OpenGraph/Twitter tags — good for
SEO and for link previews in Slack, LinkedIn, and X.

---

## 2. What each piece is

| Path | What it is |
|---|---|
| `admin/index.html` | Loads Decap CMS + the Netlify Identity widget. Served at `/admin/`. |
| `admin/config.yml` | The content model — what fields a post has (title, date, author, excerpt, cover image, tags, body). Edit this to add/remove fields. |
| `content/blog/*.md` | The posts. One Markdown file per post, with YAML front-matter. |
| `assets/blog/uploads/` | Where images uploaded through the CMS are stored. |
| `scripts/build-blog.js` | The generator. Zero-config; depends only on `marked` + `gray-matter`. |
| `assets/blog.css` | Blog styling (matches the landing page's design). |
| `netlify.toml` | Tells Netlify to run `npm run build` and publish the repo root. |

> **Decap CMS** is the actively-maintained successor to Netlify CMS (Netlify CMS
> is deprecated). It's the same idea and the same config format.

---

## 3. One-time Netlify setup

You'll do this once. It takes ~10 minutes.

### Step 1 — Create the Netlify site from this repo
1. Go to <https://app.netlify.com> → **Add new site → Import an existing project**.
2. Connect GitHub and pick the **`Mathew-Harvey/AppHub-Landing`** repo.
3. Netlify reads `netlify.toml`, so the build settings are pre-filled:
   - **Build command:** `npm run build`
   - **Publish directory:** `.`
4. Click **Deploy**. Your site goes live on a temporary `*.netlify.app` URL.

### Step 2 — Point the domain at Netlify
The site currently serves from **GitHub Pages** (that's what the `CNAME` file is
for). To use the CMS you move hosting to Netlify:
1. In Netlify: **Domain management → Add a domain** → `my-app-hub.com`.
2. Update DNS at your registrar to Netlify's records (Netlify shows the exact
   values — usually an `A` record to their load balancer + a `CNAME` for `www`,
   or move the nameservers to Netlify DNS).
3. Enable **HTTPS** (Netlify provisions a free Let's Encrypt cert automatically).

> Until DNS is switched, you can do everything below on the `*.netlify.app` URL.
> The `CNAME` file in the repo is harmless on Netlify — you can leave it.

### Step 3 — Turn on Identity (the editor login)
1. Netlify site → **Integrations / Identity** → **Enable Identity**.
   (On newer Netlify UIs this may be under **Add-ons** or labelled
   "Netlify Identity".)
2. Under **Identity → Registration**, set **Registration preferences** to
   **Invite only** — so only people you invite can log in.
3. *(Optional but recommended)* Under **Identity → Services → Git Gateway**,
   click **Enable Git Gateway**. This is what lets the CMS commit to the repo on
   the editor's behalf without giving them GitHub access.
4. *(Optional)* Enable an **external provider** (Google/GitHub) if you'd rather
   editors log in with those instead of email/password.

### Step 4 — Invite your editor
1. Netlify site → **Identity → Invite users** → enter the third party's email.
2. They get an email, click the link, set a password.
3. They go to **`https://my-app-hub.com/admin/`**, log in, and start writing.

That's it. When they hit **Publish**, the post is committed, Netlify rebuilds,
and it's live in a minute or two.

---

## 4. Editorial workflow (review before publish)

`admin/config.yml` sets `publish_mode: editorial_workflow`. This gives editors a
**Draft → In review → Ready** board, and "Publish" opens a **Pull Request**
instead of committing straight to `main` — so you can review posts before they go
live.

- Want posts to go live **immediately** with no review? Delete the
  `publish_mode: editorial_workflow` line from `admin/config.yml`.
- There's also a **Draft** toggle on each post. While it's ON, the build skips
  the post entirely even if the file is on `main`.

---

## 5. Writing / editing without the CMS (for developers)

You don't need the CMS to add a post — it's just Markdown. Create a file in
`content/blog/`, e.g. `content/blog/my-post.md`:

```markdown
---
title: My great post
date: 2026-07-13
author: Your Name
excerpt: One or two sentences used on cards and as the social preview.
thumbnail: /assets/blog/uploads/cover.png   # optional
tags:
  - Product
draft: false
---

Your **Markdown** body here. Headings, lists, links, images, code, quotes — all supported.
```

Preview locally:

```bash
npm install      # first time only
npm run build    # generates the blog/ folder
npx serve .      # or: python3 -m http.server  — then open /blog/
```

The URL slug comes from the filename (`my-post.md` → `/blog/my-post/`).

---

## 6. Common questions

**Does the editor need a GitHub account?** No. Netlify Identity + Git Gateway
handle the commit for them.

**Where do uploaded images go?** Into `assets/blog/uploads/` in the repo, served
from `/assets/blog/uploads/...`. Change this in `admin/config.yml`
(`media_folder` / `public_folder`).

**Can I keep hosting on GitHub Pages?** GitHub Pages can serve the built site,
but it **cannot** run Netlify Identity / Git Gateway, so the "log in and publish"
flow won't work there. The CMS needs Netlify (or an equivalent identity/git-gateway
service). That's why setup moves hosting to Netlify.

**How do I add a field (e.g. SEO title, category)?** Add it to the `fields:`
list in `admin/config.yml`, then read it in `scripts/build-blog.js`.

**Analytics on blog pages?** Yes — blog pages load the same Meta Pixel / Mixpanel
/ PostHog / Contentsquare setup as the landing page, so blog traffic lands in the
same projects.
