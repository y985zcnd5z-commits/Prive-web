// Prive Web (unofficial Telegram client, based on Telegram WebK, GPL-3.0):
//  - one Prive for everyone: logged out -> Telegram login straight away (no modes); Website Connect activates
//    automatically when someone arrives from a website's Chat on Prive button
//  - phone-number login by default on phones / touch / small screens
//  - after login, the Prive UI (Settings rows, Websites tab, mobile glass tab bar, website tabs) lives in the tweb source: src/prive/
(function () {
  var IC = {
    link: '<svg viewBox="0 0 24 24"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14h4"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>'
  };
  var MODE_KEY = 'prive_mode', TOKEN_KEY = 'prive_token';
  // ---------- Chat on Prive (website button) -> Website Connect: keep the params through the Telegram sign-in ----------
  (function connectParams() {
    var q = new URLSearchParams(location.search), site = q.get('connect');
    if (!site || !/^[\w.-]{1,80}$/.test(site)) return;
    var listing = q.get('listing'); if (listing && !/^[\w.-]{1,80}$/.test(listing)) listing = null;
    localStorage.setItem('prive_connect', JSON.stringify({ site: site, listing: listing, at: Date.now() }));
    q.delete('connect'); q.delete('listing');
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
  })();
  var isTouchSmall = function () { return (navigator.maxTouchPoints || 0) > 0 || matchMedia('(max-width: 820px), (pointer: coarse)').matches; };
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in attrs || {}) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function token() { return localStorage.getItem(TOKEN_KEY); }
  function api(path, opts) { opts = opts || {}; opts.headers = Object.assign({ Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' }, opts.headers || {}); return fetch('/api' + path, opts).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }); }

  function init() {
    document.title = 'Prive Web · unofficial Telegram client';
    var chats = document.getElementById('page-chats');
    var isAuth = function () { return !chats || chats.style.display === 'none'; };

    // ---------- arrived from a website's Chat on Prive button: say what happens after the sign-in ----------
    (function connectHint() {
      var pc; try { pc = JSON.parse(localStorage.getItem('prive_connect') || 'null'); } catch (e) {}
      if (!pc || Date.now() - pc.at > 3600e3 || !isAuth()) return;
      fetch('/api/connect/' + encodeURIComponent(pc.site)).then(function (r) { return r.json(); }).then(function (i) {
        if (!i || !i.site || !isAuth()) return;
        var h = el('div', { id: 'prive-connect-hint', role: 'status' }, '<b>' + esc(i.site.name) + '</b> · Sign in with Telegram and your private Website Connect chat' + (i.listing ? ' about <b>' + esc(i.listing.title) + '</b>' : '') + ' opens right away. You stay anonymous.');
        document.body.appendChild(h);
        var t = setInterval(function () { if (!isAuth()) { h.remove(); clearInterval(t); } }, 1000);
      }).catch(function () {});
    })();

    // ---------- one-time 'Add Prive to Home Screen' hint (iOS Safari only, never in the installed app) ----------
    (function a2hs() {
      var ua = navigator.userAgent;
      var ios = /iP(hone|od|ad)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      var safari = /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
      var standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
      if (!ios || !safari || standalone || localStorage.getItem('prive_a2hs_seen')) return;
      var tries = 0;
      var t = setInterval(function () {
        if (++tries > 60) return clearInterval(t);
        if (localStorage.getItem('prive_connect')) return; // arriving from Chat on Prive: no extra prompts
        if (isAuth()) return; // shown after the Telegram login, in the chat list
        clearInterval(t);
        var share = '<svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><path d="M12 3l4 4-1.4 1.4L13 6.8V15h-2V6.8L9.4 8.4 8 7zM5 10h3v2H6v8h12v-8h-2v-2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1z" fill="currentColor"/></svg>';
        var el = document.createElement('div');
        el.id = 'prive-a2hs';
        el.innerHTML = '<img src="assets/img/apple-touch-icon.png?v=prive1" alt=""><div><b>Add Prive to your Home Screen</b><span>Tap ' + share + ' Share, then <b>Add to Home Screen</b>. Prive then opens full-screen, like an app.</span></div><button aria-label="Close">\u2715</button>';
        document.body.appendChild(el);
        requestAnimationFrame(function () { el.classList.add('show'); });
        var done = function () { localStorage.setItem('prive_a2hs_seen', '1'); el.classList.remove('show'); setTimeout(function () { el.remove(); }, 300); };
        el.querySelector('button').onclick = done;
        setTimeout(done, 20000);
      }, 1000);
    })();

    // ---------- footer badge ----------
    var badge = el('div', { id: 'prive-badge' }, '<b>Prive</b> · unofficial Telegram client · not affiliated with Telegram · <a href="https://github.com/y985zcnd5z-commits/prive-web" target="_blank" rel="noopener">source (GPL-3.0)</a>');
    document.body.appendChild(badge);

    // ---------- phone login on touch / small screens ----------
    var userPickedQr = false, autoClicks = 0;
    document.addEventListener('click', function (e) { var t = e.target && e.target.closest && e.target.closest('button,a,.btn'); if (t && e.isTrusted && /qr/i.test(t.textContent || '')) userPickedQr = true; }, true);
    function preferPhone(force) {
      if (!isAuth() || userPickedQr || !isTouchSmall() || autoClicks > 3) return;
      var nodes = document.querySelectorAll('button, a, .btn, [role=button]');
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.offsetParent && /phone/i.test(n.textContent || '') && /log ?in|sign ?in|iniciar|entrar/i.test(n.textContent || '')) { autoClicks++; n.click(); return; }
      }
      if (force) setTimeout(function () { preferPhone(false); }, 600);
    }

    // ---------- state sync ----------
    function sync() {
      var auth = isAuth();
      document.body.classList.toggle('prive-auth', auth);
      if (auth) preferPhone(false);
    }
    sync();
    if (chats) new MutationObserver(sync).observe(chats, { attributes: true, attributeFilter: ['style', 'class'] });
    new MutationObserver(function () { if (isAuth()) preferPhone(false); }).observe(document.body, { childList: true, subtree: true });
    setInterval(function () { if (document.title.indexOf('Telegram') === 0) document.title = document.title.replace(/^Telegram( Web)?/, 'Prive Web'); }, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
