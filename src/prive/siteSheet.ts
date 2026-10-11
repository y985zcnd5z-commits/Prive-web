/*
 * Prive Web: open a website like a Telegram Mini App: a sheet that slides up over the client (full-screen on
 * phones, a floating mini-app window on desktop) with a mini-app top bar: ✕ · favicon + title · ⋮ (Reload, Open in
 * browser, Copy link). No address bar. Sites that refuse framing (CSP frame-ancestors / X-Frame-Options) get a
 * native-feeling "opens in Safari/browser" card instead of a blank frame; a 4 s watchdog offers "Open site".
 */
import type {PriveSite} from '@/prive/api';

const ICON = {
  close: '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z" fill="currentColor"/></svg>',
  more: '<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="5.5" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="18.5" r="1.9" fill="currentColor"/></svg>',
  reload: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z" fill="currentColor"/></svg>',
  open: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14zM5 5h6v2H5v12h12v-6h2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="currentColor"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11z" fill="currentColor"/></svg>'
};

const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;'} as any)[c]);
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch(e) { return u; } };

let current: {close: () => void} | undefined;

async function checkFrameable(s: PriveSite): Promise<boolean | null> {
  try {
    const u = new URL(s.url);
    const r = await fetch('/api/frame-check?url=' + encodeURIComponent(u.origin + u.pathname));
    const j = await r.json();
    return typeof j.frameable === 'boolean' ? j.frameable : null;
  } catch(e) {
    return null;
  }
}

export function openSiteSheet(s: PriveSite) {
  if(!s?.url) return;
  current?.close();
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const browserName = isIOS ? 'Safari' : 'your browser';

  const root = document.createElement('div');
  root.className = 'prive-sheet-root';
  root.innerHTML = `<div class="prive-sheet" role="dialog" aria-label="${esc(s.name)}">
    <div class="prive-sheet-bar">
      <button class="prive-sheet-btn" data-act="close" aria-label="Close">${ICON.close}</button>
      <div class="prive-sheet-title"><span class="prive-sheet-fav">${s.icon ? `<img src="${esc(s.icon)}" alt="" referrerpolicy="no-referrer">` : ''}<b>${esc((s.name || hostOf(s.url))[0] || '?')}</b></span><span class="prive-sheet-name">${esc(s.name || hostOf(s.url))}</span></div>
      <button class="prive-sheet-btn" data-act="more" aria-label="More">${ICON.more}</button>
      <div class="prive-sheet-menu" hidden>
        <button data-act="reload">${ICON.reload}<span>Reload</span></button>
        <button data-act="open">${ICON.open}<span>Open in ${browserName}</span></button>
        <button data-act="copy">${ICON.copy}<span>Copy link</span></button>
      </div>
    </div>
    <div class="prive-sheet-progress"></div>
    <div class="prive-sheet-body"></div>
  </div>`;
  document.body.append(root);
  const sheet = root.querySelector('.prive-sheet') as HTMLElement;
  const body = root.querySelector('.prive-sheet-body') as HTMLElement;
  const menu = root.querySelector('.prive-sheet-menu') as HTMLElement;
  const bar = root.querySelector('.prive-sheet-bar') as HTMLElement;
  const img = root.querySelector('.prive-sheet-fav img') as HTMLImageElement;
  if(img) img.onerror = () => img.remove();
  let timer: number;

  const openOut = () => window.open(s.url, 'prive-site-' + s.id);
  const card = (opened?: boolean) => {
    clearTimeout(timer);
    root.classList.remove('is-loading');
    body.innerHTML = `<div class="prive-sheet-card">
      <span class="prive-sheet-card-fav">${s.icon ? `<img src="${esc(s.icon)}" alt="" referrerpolicy="no-referrer">` : ''}<b>${esc((s.name || '?')[0])}</b></span>
      <div class="prive-sheet-card-title">${esc(s.name || hostOf(s.url))}</div>
      <div class="prive-sheet-card-text">${opened ? `Opened in ${browserName}. Come back to Prive any time.` : `${esc(hostOf(s.url))} doesn’t allow being shown inside other apps, so it opens in ${browserName}.`}</div>
      <button class="prive-sheet-card-btn" data-act="open">${opened ? 'Open again' : 'Open ' + esc(hostOf(s.url))}</button>
    </div>`;
    const ci = body.querySelector('img') as HTMLImageElement; if(ci) ci.onerror = () => ci.remove();
  };
  const frame = () => {
    clearTimeout(timer);
    root.classList.add('is-loading');
    body.innerHTML = `<iframe src="${esc(s.url)}" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads" allow="clipboard-write; geolocation; camera; microphone; fullscreen" title="${esc(s.name)}"></iframe>
      <div class="prive-sheet-slow" hidden><span>Not loading?</span><button data-act="open">Open site</button></div>`;
    const f = body.querySelector('iframe') as HTMLIFrameElement;
    const slow = body.querySelector('.prive-sheet-slow') as HTMLElement;
    let loaded = false;
    f.addEventListener('load', () => { loaded = true; root.classList.remove('is-loading'); slow.hidden = true; });
    timer = window.setTimeout(() => { if(!loaded && f.isConnected) { slow.hidden = false; root.classList.remove('is-loading'); } }, 4000);
  };

  if(s.frameable === false) card(); else frame();
  checkFrameable(s).then((ok) => {
    if(!root.isConnected || ok === null) return;
    if(ok === false && s.frameable !== false) card();
    else if(ok === true && s.frameable === false) frame();
    s.frameable = ok;
  });

  const close = () => {
    if(root.classList.contains('is-closing')) return;
    clearTimeout(timer);
    root.classList.add('is-closing');
    root.classList.remove('is-open');
    sheet.style.transform = '';
    setTimeout(() => root.remove(), 260);
    document.removeEventListener('keydown', onKey, true);
    if(current?.close === close) current = undefined;
  };
  const onKey = (e: KeyboardEvent) => { if(e.key === 'Escape') { e.stopPropagation(); menu.hidden ? close() : (menu.hidden = true); } };
  document.addEventListener('keydown', onKey, true);
  current = {close};

  root.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement;
    if(e.target === root) return close();
    if(!t) { if(!menu.hidden && !(e.target as HTMLElement).closest('.prive-sheet-menu')) menu.hidden = true; return; }
    const act = t.dataset.act;
    if(act !== 'more') menu.hidden = true;
    if(act === 'close') close();
    else if(act === 'more') menu.hidden = !menu.hidden;
    else if(act === 'reload') { s.frameable === false ? card() : frame(); }
    else if(act === 'open') { openOut(); if(body.querySelector('.prive-sheet-card') || body.querySelector('.prive-sheet-slow:not([hidden])')) card(true); }
    else if(act === 'copy') { navigator.clipboard?.writeText(s.url).catch(() => {}); import('@components/toast').then((m) => m.toast('Link copied')); }
  });

  // swipe the bar down to close (touch), like a Telegram mini app
  let startY = 0, dy = 0, dragging = false;
  bar.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; dy = 0; dragging = true; sheet.style.transition = 'none'; }, {passive: true});
  bar.addEventListener('touchmove', (e) => { if(!dragging) return; dy = Math.max(0, e.touches[0].clientY - startY); sheet.style.transform = `translateY(${dy}px)`; }, {passive: true});
  bar.addEventListener('touchend', () => {
    if(!dragging) return; dragging = false; sheet.style.transition = '';
    if(dy > sheet.offsetHeight * 0.22) close(); else sheet.style.transform = '';
  });

  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-open')));
}
