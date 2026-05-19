(function () {
  var APP_NAME = 'AppHub Landing';
  var viewedSections = {};

  function getUtmProperties() {
    var params = new URLSearchParams(window.location.search);
    var props = {};

    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (key) {
      var value = params.get(key);
      if (value) props[key] = value;
    });

    return props;
  }

  function getBaseProperties() {
    var props = {
      app: APP_NAME,
      path: window.location.pathname,
      page_title: document.title
    };

    if (document.referrer) props.referrer = document.referrer;

    return Object.assign(props, getUtmProperties());
  }

  function track(eventName, properties) {
    var eventProperties = Object.assign(getBaseProperties(), properties || {});

    if (window.mixpanel && typeof window.mixpanel.track === 'function') {
      window.mixpanel.track(eventName, eventProperties);
    }

    if (window.posthog && typeof window.posthog.capture === 'function') {
      window.posthog.capture(eventName, eventProperties);
    }
  }

  function classifyDestination(link) {
    var href = link.getAttribute('href') || '';

    if (href.indexOf('/register') !== -1) return 'register';
    if (href.indexOf('/login') !== -1) return 'login';
    if (href.indexOf('/checkout-landing') !== -1) return 'checkout';
    if (href.indexOf('webintel.dev') !== -1) return 'webintel';
    if (href.charAt(0) === '#') return 'section';
    return 'external';
  }

  var KNOWN_SECTION_CLASSES = ['hero', 'mobile-menu', 'stats-bar', 'showcase', 'cta-section', 'webintel-section', 'pricing-section', 'whats-new-section'];

  function getSectionName(element) {
    if (!element) return null;
    if (element.id) return element.id;
    if (element.getAttribute('data-section')) return element.getAttribute('data-section');

    var tag = element.tagName ? element.tagName.toLowerCase() : '';
    if (tag === 'nav') return 'nav';
    if (tag === 'footer') return 'footer';

    var className = (element.className && element.className.toString) ? element.className.toString() : '';
    var classNames = className.split(/\s+/);
    for (var i = 0; i < classNames.length; i++) {
      if (KNOWN_SECTION_CLASSES.indexOf(classNames[i]) !== -1) return classNames[i];
    }

    return null;
  }

  window.AppHubAnalytics = {
    track: track,
    trackThemeToggle: function (theme) {
      track('theme_toggle', { theme: theme });
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    track('landing_page_view');

    var SECTION_CONTAINER_SELECTOR = 'section, footer, nav, .hero, .mobile-menu, .stats-bar, .showcase, .cta-section, [id], [data-section]';

    document.querySelectorAll('a[href]').forEach(function (link) {
      link.addEventListener('click', function () {
        track('cta_click', {
          destination: classifyDestination(link),
          link_text: (link.textContent || '').trim(),
          link_url: link.href,
          section: getSectionName(link.closest(SECTION_CONTAINER_SELECTOR))
        });
      });
    });

    if ('IntersectionObserver' in window) {
      var sectionObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var section = getSectionName(entry.target);

          if (!entry.isIntersecting || !section || viewedSections[section]) return;

          viewedSections[section] = true;
          track('section_view', { section: section });
        });
      }, { threshold: 0.4 });

      document.querySelectorAll('section[id], .showcase[id], .cta-section[id]').forEach(function (section) {
        sectionObserver.observe(section);
      });
    }
  });
})();
