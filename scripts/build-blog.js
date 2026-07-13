#!/usr/bin/env node
/* ==========================================================================
   build-blog.js — AppHub's tiny static blog generator.

   Reads the Markdown files under content/blog/ (authored by editors through
   the Decap CMS admin panel at /admin/), and writes pre-rendered static HTML:

     content/blog/<slug>.md   ->   blog/<slug>/index.html   (article page)
                                    blog/index.html          (listing page)
                                    blog/rss.xml             (feed)
                                    sitemap.xml              (regenerated)

   Pre-rendering (rather than rendering Markdown in the browser) gives every
   post real <title>/<meta>/OpenGraph tags for SEO and social cards, and fast
   static pages. Runs on Netlify via `npm run build` on every deploy — so when
   an editor publishes, the commit triggers a rebuild and the post goes live.

   Zero config: only depends on `marked` + `gray-matter`.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'blog');
const OUT_DIR = path.join(ROOT, 'blog');
const SITE_URL = 'https://my-app-hub.com';
const SITE_NAME = 'AppHub';
const DEFAULT_OG = SITE_URL + '/og-image.png';

marked.setOptions({ gfm: true, breaks: false });

/* ---------- helpers ------------------------------------------------------ */

function slugify(str) {
  return String(str).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeXml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Absolute-ise a possibly root-relative asset path for OG tags / feeds.
function absUrl(p) {
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  return SITE_URL + (p.charAt(0) === '/' ? '' : '/') + p;
}

function formatDate(value) {
  const d = new Date(value);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function readingTime(markdownBody) {
  const words = markdownBody.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

function stripMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ---------- shared page chrome ------------------------------------------ */

// Analytics + fonts + theme bootstrap, kept in sync with index.html so blog
// traffic is tracked in the same Mixpanel / PostHog / Meta / Contentsquare
// projects as the marketing pages.
function headCommon() {
  return `
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/blog.css">
<script>
(function(){
  var t = localStorage.getItem('apphub-theme');
  if (!t) t = window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
})();
</script>
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1321396053172000');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=1321396053172000&ev=PageView&noscript=1"/></noscript>
<!-- End Meta Pixel Code -->
<script>
window.APPHUB_ANALYTICS_CONFIG = {
  mixpanelToken: '1a1025bf1feac714c9e03f8073f9e37d',
  contentsquareScriptUrl: 'https://t.contentsquare.net/uxa/1a068dd977b6b.js',
  posthogKey: 'phc_nMiCFKBaEuny8Qibgfw5xNNDqH9ZYYBD3FWwNE9thudY',
  posthogHost: 'https://us.i.posthog.com'
};
</script>
<!-- Mixpanel -->
<script type="text/javascript">
(function (f, b) { if (!b.__SV) { var e, g, i, h; window.mixpanel = b; b._i = []; b.init = function (e, f, c) { function g(a, d) { var b = d.split("."); 2 == b.length && ((a = a[b[0]]), (d = b[1])); a[d] = function () { a.push([d].concat(Array.prototype.slice.call(arguments, 0))); }; } var a = b; "undefined" !== typeof c ? (a = b[c] = []) : (c = "mixpanel"); a.people = a.people || []; a.toString = function (a) { var d = "mixpanel"; "mixpanel" !== c && (d += "." + c); a || (d += " (stub)"); return d; }; a.people.toString = function () { return a.toString(1) + ".people (stub)"; }; i = "disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" "); for (h = 0; h < i.length; h++) g(a, i[h]); var j = "set set_once union unset remove delete".split(" "); a.get_group = function () { function b(c) { d[c] = function () { var call2_args = arguments; var call2 = [c].concat(Array.prototype.slice.call(call2_args, 0)); a.push([e, call2]); }; } for (var d = {}, e = ["get_group"].concat(Array.prototype.slice.call(arguments, 0)), c = 0; c < j.length; c++) b(j[c]); return d; }; b._i.push([e, f, c]); }; b.__SV = 1.2; e = f.createElement("script"); e.type = "text/javascript"; e.async = !0; e.src = "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js"; g = f.getElementsByTagName("script")[0]; g.parentNode.insertBefore(e, g); } })(document, window.mixpanel || []);
mixpanel.init(window.APPHUB_ANALYTICS_CONFIG.mixpanelToken, { persistence: 'localStorage', track_pageview: false });
mixpanel.register({ app: 'AppHub Landing', platform: 'web' });
</script>
<!-- Contentsquare / Hotjar -->
<script>
(function(){ var c = window.APPHUB_ANALYTICS_CONFIG || {}; if (!c.contentsquareScriptUrl) return;
  var s = document.createElement('script'); s.src = c.contentsquareScriptUrl; s.async = true; document.head.appendChild(s); })();
</script>
<!-- PostHog -->
<script>
(function(){ var c = window.APPHUB_ANALYTICS_CONFIG || {};
  if (!c.posthogKey || String(c.posthogKey).indexOf('REPLACE_WITH_') === 0) return;
  if (!c.posthogHost || String(c.posthogHost).indexOf('REPLACE_WITH_') === 0) return;
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  posthog.init(c.posthogKey, { api_host: c.posthogHost, defaults: '2026-01-30', capture_pageview: true, capture_pageleave: true, person_profiles: 'identified_only' });
})();
</script>
<script src="/assets/analytics.js" defer></script>`;
}

function nav() {
  return `
<nav class="nav">
  <a href="/" class="nav-logo"><img src="/apphubLogo.png" alt="AppHub" class="nav-logo-img"></a>
  <div class="nav-links">
    <a href="/#product">Product</a>
    <a href="/#features">Features</a>
    <a href="/#pricing">Pricing</a>
    <a href="/blog/" class="active">Blog</a>
  </div>
  <div class="nav-actions">
    <button class="theme-toggle" onclick="toggleTheme()" title="Switch theme" aria-label="Switch theme">
      <svg class="sun-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      <svg class="moon-icon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
    </button>
    <a href="https://app.my-app-hub.com/login" class="nav-login">Log in</a>
    <a href="https://app.my-app-hub.com/try" class="nav-cta">Start Free</a>
    <button class="hamburger" onclick="document.getElementById('mobileMenu').classList.add('open')" aria-label="Menu">
      <svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
  </div>
</nav>
<div class="mobile-menu" id="mobileMenu">
  <button class="close-btn" onclick="document.getElementById('mobileMenu').classList.remove('open')" aria-label="Close">
    <svg viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
  </button>
  <a href="/#product">Product</a>
  <a href="/#features">Features</a>
  <a href="/#pricing">Pricing</a>
  <a href="/blog/">Blog</a>
  <a href="https://app.my-app-hub.com/login">Log in</a>
  <a href="https://app.my-app-hub.com/try" class="btn-primary">Start Free</a>
</div>`;
}

function footer() {
  return `
<footer>
  <div class="footer-top">
    <a href="/" class="footer-brand"><img src="/apphubLogo.png" alt="AppHub"><span>AppHub</span></a>
    <div class="footer-links">
      <a href="/blog/">Blog</a>
      <a href="https://app.my-app-hub.com/try">Get Started</a>
      <a href="https://app.my-app-hub.com/login">Log in</a>
      <a href="/#pricing">Pricing</a>
      <a href="/#features">Features</a>
      <a href="https://app.my-app-hub.com/about">About</a>
    </div>
  </div>
  <div class="footer-bottom">
    <p class="footer-copy">&copy; 2026 AppHub</p>
    <p class="footer-origin">Built in Western Australia</p>
  </div>
</footer>`;
}

function scripts() {
  return `
<script>
function toggleTheme() {
  var html = document.documentElement;
  var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('apphub-theme', next);
  if (window.AppHubAnalytics) window.AppHubAnalytics.trackThemeToggle(next);
}
document.addEventListener('DOMContentLoaded', function () {
  requestAnimationFrame(function () { document.documentElement.classList.add('themed'); });
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { obs.observe(el); });
});
</script>`;
}

/* ---------- card + page templates --------------------------------------- */

function postCard(post, featured) {
  const media = post.thumbnail
    ? `<div class="post-card-media"><img src="${escapeHtml(post.thumbnail)}" alt="${escapeHtml(post.title)}" loading="lazy"></div>`
    : `<div class="post-card-media placeholder"><span>${escapeHtml(post.title.charAt(0).toUpperCase())}</span></div>`;
  const tags = (post.tags || []).slice(0, featured ? 3 : 2)
    .map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  return `
  <a class="post-card${featured ? ' featured' : ''} reveal" href="/blog/${post.slug}/">
    ${media}
    <div class="post-card-body">
      ${tags ? `<div class="post-card-tags">${tags}</div>` : ''}
      <h2>${escapeHtml(post.title)}</h2>
      <p>${escapeHtml(post.excerpt || '')}</p>
      <div class="post-card-meta">
        <span>${escapeHtml(post.author)}</span><span class="dot"></span>
        <span>${escapeHtml(post.dateLabel)}</span><span class="dot"></span>
        <span>${post.readingTime} min read</span>
      </div>
    </div>
  </a>`;
}

function renderIndex(posts) {
  const cards = posts.length
    ? posts.map((p, i) => postCard(p, i === 0 && posts.length > 2)).join('\n')
    : `<div class="blog-empty"><h2>No posts yet</h2><p>Fresh writing from the AppHub team is on the way.</p></div>`;

  const title = 'Blog — AppHub';
  const desc = 'Product updates, playbooks, and stories on building and sharing AI-powered tools with your team.';
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${SITE_URL}/blog/">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:url" content="${SITE_URL}/blog/">
<meta property="og:image" content="${DEFAULT_OG}">
<meta property="og:site_name" content="AppHub">
<meta name="twitter:card" content="summary_large_image">
<link rel="alternate" type="application/rss+xml" title="AppHub Blog" href="${SITE_URL}/blog/rss.xml">
${headCommon()}
</head>
<body>
${nav()}
<div class="blog-hero-wrapper">
  <div class="blog-hero-grid"></div>
  <header class="blog-hero">
    <p class="section-label reveal">The AppHub Blog</p>
    <h1 class="reveal reveal-d1">Ideas for teams who<br><span class="gradient-text">build their own tools</span></h1>
    <p class="reveal reveal-d2">Product updates, playbooks, and stories on building, sharing, and running AI-powered tools together.</p>
  </header>
</div>
<main class="blog-main">
  <div class="post-grid">
${cards}
  </div>
</main>
${footer()}
${scripts()}
</body>
</html>`;
}

function renderPost(post, recent) {
  const shareUrl = encodeURIComponent(`${SITE_URL}/blog/${post.slug}/`);
  const shareText = encodeURIComponent(post.title);
  const ogImage = post.thumbnail ? absUrl(post.thumbnail) : DEFAULT_OG;
  const tags = (post.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || '',
    datePublished: post.dateISO,
    author: { '@type': 'Person', name: post.author },
    publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: SITE_URL + '/apphubLogo.png' } },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}/`,
    image: ogImage
  };

  const cover = post.thumbnail
    ? `<figure class="article-cover"><img src="${escapeHtml(post.thumbnail)}" alt="${escapeHtml(post.title)}"></figure>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<title>${escapeHtml(post.title)} — AppHub Blog</title>
<meta name="description" content="${escapeHtml(post.excerpt || '')}">
<link rel="canonical" href="${SITE_URL}/blog/${post.slug}/">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(post.title)}">
<meta property="og:description" content="${escapeHtml(post.excerpt || '')}">
<meta property="og:url" content="${SITE_URL}/blog/${post.slug}/">
<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta property="og:site_name" content="AppHub">
<meta property="article:published_time" content="${post.dateISO}">
<meta property="article:author" content="${escapeHtml(post.author)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(post.title)}">
<meta name="twitter:description" content="${escapeHtml(post.excerpt || '')}">
<meta name="twitter:image" content="${escapeHtml(ogImage)}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
${headCommon()}
</head>
<body>
${nav()}
<article class="article">
  <a href="/blog/" class="article-back reveal">
    <svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
    All posts
  </a>
  ${tags ? `<div class="article-tags reveal">${tags}</div>` : ''}
  <h1 class="reveal">${escapeHtml(post.title)}</h1>
  <div class="article-meta reveal">
    <span class="author">${escapeHtml(post.author)}</span><span class="dot"></span>
    <time datetime="${post.dateISO}">${escapeHtml(post.dateLabel)}</time><span class="dot"></span>
    <span>${post.readingTime} min read</span>
  </div>
  ${cover}
  <div class="prose">
${post.html}
  </div>
  <div class="article-foot">
    <a href="/blog/" class="article-back" style="margin:0">
      <svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
      Back to all posts
    </a>
    <div class="share">
      <span>Share</span>
      <a href="https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}" target="_blank" rel="noopener" aria-label="Share on X">
        <svg viewBox="0 0 24 24"><path d="M18.9 1.2h3.7l-8 9.1 9.4 12.4h-7.4l-5.8-7.6-6.6 7.6H.5l8.5-9.7L0 1.2h7.6l5.2 6.9 6.1-6.9Zm-1.3 19.4h2L6.5 3.3H4.4L17.6 20.6Z"/></svg>
      </a>
      <a href="https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}" target="_blank" rel="noopener" aria-label="Share on LinkedIn">
        <svg viewBox="0 0 24 24"><path d="M4.98 3.5A2.5 2.5 0 0 1 5 8.5 2.5 2.5 0 0 1 4.98 3.5ZM3 9h4v12H3V9Zm6 0h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.3c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21H9V9Z"/></svg>
      </a>
    </div>
  </div>
</article>
<aside class="article-cta reveal">
  <h3>Ready to give your team a place to build?</h3>
  <p>5 applets, 2 toolboxes, unlimited team members. Set up in 30 seconds — no credit card.</p>
  <a href="https://app.my-app-hub.com/try" class="btn-primary">Start your free toolbox</a>
</aside>
${footer()}
${scripts()}
</body>
</html>`;
}

/* ---------- feed + sitemap ---------------------------------------------- */

function renderRss(posts) {
  const items = posts.map(p => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${SITE_URL}/blog/${p.slug}/</link>
      <guid isPermaLink="true">${SITE_URL}/blog/${p.slug}/</guid>
      <pubDate>${new Date(p.dateISO).toUTCString()}</pubDate>
      <description>${escapeXml(p.excerpt || '')}</description>
    </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>AppHub Blog</title>
  <link>${SITE_URL}/blog/</link>
  <description>Product updates, playbooks, and stories from AppHub.</description>
  <language>en</language>
${items}
</channel></rss>`;
}

function writeSitemap(posts) {
  const urls = [
    { loc: SITE_URL + '/', freq: 'weekly', pri: '1.0' },
    { loc: SITE_URL + '/blog/', freq: 'weekly', pri: '0.8' },
    ...posts.map(p => ({ loc: `${SITE_URL}/blog/${p.slug}/`, freq: 'monthly', pri: '0.7', lastmod: p.dateISO }))
  ];
  const body = urls.map(u => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.freq}</changefreq>
    <priority>${u.pri}</priority>
  </url>`).join('\n');
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
}

/* ---------- main --------------------------------------------------------- */

function loadPosts() {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.md'))
    .map(file => {
      const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
      const { data, content } = matter(raw);
      if (data.draft === true) return null; // hidden until the editor unchecks "Draft"
      if (!data.title) { console.warn(`  ! skipping ${file} — missing title`); return null; }
      const slug = data.slug ? slugify(data.slug) : slugify(file.replace(/\.md$/, ''));
      const dateISO = data.date ? new Date(data.date).toISOString() : new Date().toISOString();
      return {
        slug,
        title: data.title,
        author: data.author || 'AppHub Team',
        excerpt: data.excerpt || stripMarkdown(content).slice(0, 160),
        thumbnail: data.thumbnail || '',
        tags: Array.isArray(data.tags) ? data.tags : [],
        dateISO,
        dateLabel: formatDate(dateISO),
        readingTime: readingTime(content),
        html: marked.parse(content)
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO));
}

function main() {
  console.log('Building blog…');
  const posts = loadPosts();

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Article pages
  posts.forEach(post => {
    const dir = path.join(OUT_DIR, post.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderPost(post, posts));
  });

  // Listing, feed, sitemap
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), renderIndex(posts));
  fs.writeFileSync(path.join(OUT_DIR, 'rss.xml'), renderRss(posts));
  writeSitemap(posts);

  console.log(`✓ Built ${posts.length} post${posts.length === 1 ? '' : 's'} + blog index, RSS, sitemap.`);
}

main();
