/* The app's offline copy: lets teams.html — and portal.html, the YWAM GP Portal — open with no connection.

   Network first, always: a push to main goes live at once, and a phone running
   yesterday's page against today's server is a worse bug than a slow load. So
   every page and script is fetched from the network, and the copy kept here is
   only used when the network fails or takes more than NET_WAIT_MS — then the last
   copy that loaded is served, and the network answer, if it comes, refreshes the
   copy for next time. The data itself is not here: the page keeps its last
   getMyBoot (gp-boot-cache in localStorage) and shows that, marked as offline.

   Only same-origin GETs. The API is a POST and is never touched, cached or
   answered from here; nor are Google Fonts (the page has fallbacks).

   Bump SHELL when the list changes; old caches are dropped on activate. */
var SHELL = 'gp-shell-v10';   // v2: the portal is in the shell too; v3: the Library; v4: its Khmer; v5: the letterhead;
                              // v6: the Library's Khmer is kept the first time it's read, not downloaded on install;
                              // v7: the legal documents' Khmer (legal-km.js); v8: teams.html's code in teams/; v9: the dashboard joins it; v10: and goes (numbers are My Ministry's)
var NET_WAIT_MS = 4000;
/* A reload the page asked for to pick up a new version (pull to refresh adds
   ?fresh=) waits longer for the network — falling back to the old copy after 4s
   would just reload yesterday's page again. */
var FRESH_WAIT_MS = 15000;
var PRECACHE = [
  'teams.html', 'teams/teams.css', 'teams/01-core.js', 'teams/02-goals-okrs.js', 'teams/03-library-org.js', 'teams/04-ministry-strengths.js', 'teams/05-admin-hr.js', 'teams/06-numbers-contract.js', 'teams/07-health-leave.js', 'teams/08-team-profile.js', 'teams/09-bind-boot.js',
  'manifest.json', 'km.js', 'taxonomy.js', 'rollup.js', 'logo.js', 'duty.js',
  'jobfocus.js', 'personality.js', 'gpstrengths.js', 'kpiguide.js', 'sr-checkin-history.js',
  'icon-180.png', 'icon-512.png', 'icon-maskable-512.png', 'ywam-logo.png', 'library.js',
  /* the YWAM GP Portal installs as its own app (portal-manifest.json) off the same worker */
  'portal.html', 'portal-manifest.json', 'outreach-guide.js', 'letterhead.jpg', 'legal-km.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) {
    // one missing file must not stop the rest from being kept
    return Promise.all(PRECACHE.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('gp-shell-') === 0 && k !== SHELL; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/.netlify/') === 0) return;
  e.respondWith(networkFirst_(req, e));
});

function networkFirst_(req, e) {
  /* ignoreSearch: teams.html?reg=1 and teams.html are the same page offline */
  var cached = function () { return caches.match(req, { ignoreSearch: true }); };
  var net = fetch(req).then(function (res) {
    if (res && res.ok && res.type === 'basic') {
      var copy = res.clone();
      e.waitUntil(caches.open(SHELL).then(function (c) { return c.put(stripSearch_(req), copy); }));
    }
    return res;
  });
  var isPage = req.mode === 'navigate';
  return new Promise(function (resolve) {
    var done = false;
    var fallback = function () {
      if (done) return;
      cached().then(function (hit) {
        if (!hit || done) return;
        done = true;
        /* the page will want to know it is running the kept copy: its next pull
           that reaches the server reloads it (gpVerInit_ in teams.html) */
        if (isPage) e.waitUntil(noteServedFromCache_());
        resolve(hit);
      });
    };
    var timer = setTimeout(fallback, (isPage && /[?&]fresh=/.test(req.url)) ? FRESH_WAIT_MS : NET_WAIT_MS);
    net.then(function (res) {
      clearTimeout(timer);
      if (done) return;
      if (res && res.ok) { done = true; if (isPage) e.waitUntil(caches.open('gp-meta').then(function (c) { return c.delete('served-from-cache'); })); resolve(res); return; }
      // a 404 or 500 from the network: the kept copy if there is one, else the error as it was
      cached().then(function (hit) { if (!done) { done = true; resolve(hit || res); } });
    }, function () {
      clearTimeout(timer);
      cached().then(function (hit) {
        if (done) return;
        done = true;
        if (hit && isPage) e.waitUntil(noteServedFromCache_());
        resolve(hit || new Response('Offline — this page has not been opened on this phone before.',
          { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
      });
    });
  });
}

function stripSearch_(req) {
  var u = new URL(req.url); u.search = '';
  return new Request(u.toString());
}

function noteServedFromCache_() {
  return caches.open('gp-meta').then(function (c) { return c.put('served-from-cache', new Response(String(Date.now()))); }).catch(function () {});
}

/* Reminders (web push): the server sends { title, body, tag, url }, encrypted to this
   phone; one notification, replacing the last one with the same tag. Tapping it opens
   the app, or brings an open copy to the front. */
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'My YWAM GP', {
    body: d.body || '', tag: d.tag || 'gp-reminder', renotify: true,
    icon: 'icon-512.png', badge: 'icon-180.png', data: { url: d.url || 'teams.html' }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || 'teams.html', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if (list[i].url.indexOf(self.registration.scope) === 0 && 'focus' in list[i]) return list[i].focus(); }
    return self.clients.openWindow(url);
  }));
});
