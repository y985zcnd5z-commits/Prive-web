/*
 * Prive Web: Website Connect chats as NORMAL rows of the main chat list, mixed with the Telegram chats and sorted
 * by last message (pinned ones join the pinned block). They are tweb DialogElements fed by the Prive server
 * (GET /api/wc/list) through the list's CustomSortedDialog mechanism, so they look, scroll and page like any chat.
 *  - avatar: the other side's website profile picture (Prive media proxy), initials as fallback, plus a small website
 *    badge where Telegram shows the online dot (the site's favicon, or a gold globe; a shield for chats you moderate)
 *  - tap: the chat opens in Prive's chat screen (bubbles, input, translate, 'via <Site>' and the source-page card),
 *    full-screen on phones and in the middle column on desktop
 *  - hold / right-click: Pin, Mute, Archive, Mark as read (stored on the Prive server per account, not in Telegram)
 *  - live: the Prive socket pushes new messages; archived rows move to the Archive list; the Channels filter never
 *    shows them (they are only added to the All and Archive lists)
 * Contact details are never shown (no phone, @username or Telegram profile).
 */
import appDialogsManager, {DialogElement} from '@lib/appDialogsManager';
import {CustomSortedDialog} from '@components/sortedDialogList';
import {FOLDER_ID_ALL, FOLDER_ID_ARCHIVE, NULL_PEER_ID} from '@appManagers/constants';
import {formatDateAccordingToTodayNew} from '@helpers/date';
import replaceContent from '@helpers/dom/replaceContent';
import {priveToken} from '@/prive/api';

export type WcChat = {
  id: string, title: string, role: 'visitor' | 'advertiser' | 'moderating', siteId: string,
  site: {name: string, domain: string, icon: string | null} | null, listing: {title: string, emoji: string} | null,
  avatarUrl: string | null, initials: string, lastText: string, lastAt: number, lastMine: boolean,
  unread: number, pinned: number, muted: boolean, archived: boolean, source: {url: string, title?: string} | null
};

type Item = {chat: WcChat, el?: DialogElement, row: CustomSortedDialog, list?: number, rebuild?: boolean};
const items = new Map<string, Item>();
let chats: WcChat[] = [];

const api = async(path: string, body?: any) => {
  const r = await fetch(path, {method: body ? 'POST' : 'GET', headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + priveToken()}, body: body ? JSON.stringify(body) : undefined});
  return {status: r.status, j: await r.json().catch((): any => ({}))};
};

const GLOBE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const SHIELD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6l-7-3Z" fill="currentColor"/></svg>';
const okUrl = (u: string) => !!u && /^(\/|https:\/\/)/.test(u);
const favOf = (c: WcChat) => (c.site?.icon && okUrl(c.site.icon)) ? c.site.icon : (c.site?.domain ? 'https://' + c.site.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '') + '/favicon.ico' : '');

function avatar(c: WcChat) {
  const av = document.createElement('div');
  av.className = 'prive-wc-av';
  const ini = document.createElement('span'); ini.className = 'prive-wc-ini'; ini.textContent = c.initials || '?';
  av.append(ini);
  if(okUrl(c.avatarUrl)) {
    const img = new Image(); img.alt = ''; img.referrerPolicy = 'no-referrer'; img.decoding = 'async'; img.className = 'prive-wc-pic';
    img.onload = () => { if(img.naturalWidth > 2) av.classList.add('has-pic'); }; img.onerror = () => img.remove();
    img.src = c.avatarUrl; av.append(img);
  }
  const b = document.createElement('span');
  b.className = 'prive-wc-badge' + (c.role === 'moderating' ? ' is-mod' : '');
  b.title = c.role === 'moderating' ? 'Moderating · ' + (c.site?.name || 'website') : 'via ' + (c.site?.name || 'website');
  b.innerHTML = c.role === 'moderating' ? SHIELD : GLOBE;
  const fav = c.role === 'moderating' ? '' : favOf(c);
  if(fav) {
    const fi = new Image(); fi.alt = ''; fi.referrerPolicy = 'no-referrer'; fi.decoding = 'async';
    fi.onload = () => { if(fi.naturalWidth > 2) { b.classList.add('has-fav'); b.replaceChildren(fi); } };
    fi.src = fav;
  }
  av.append(b);
  return av;
}

function paint(it: Item) {
  const c = it.chat, d = it.el; if(!d) return;
  d.updateTitle?.(c.title);
  const sub = d.dom.lastMessageSpan;
  const via = document.createElement('span'); via.className = 'prive-wc-via';
  via.textContent = c.role === 'moderating' ? 'Moderating · ' : (c.lastMine ? 'You: ' : '');
  const tx = document.createElement('span'); tx.textContent = c.lastText || ('via ' + (c.site?.name || 'website'));
  sub.replaceChildren(via, tx);
  replaceContent(d.dom.lastTimeSpan, formatDateAccordingToTodayNew(new Date(c.lastAt)));
  d.setBadgeState({muted: c.muted, pinned: !!c.pinned, unread: c.unread > 0, unreadText: String(c.unread),
    unreadAvatar: false, mentions: false, reactions: false, pollVotes: false} as any);
  if(d.dom.unreadBadge && c.unread > 0) d.dom.unreadBadge.textContent = c.unread > 999 ? '999+' : String(c.unread);
  d.dom.listEl.classList.toggle('prive-wc-mod', c.role === 'moderating');
}

function build(it: Item) {
  const c = it.chat;
  const d = appDialogsManager.addDialogNew({
    peerId: NULL_PEER_ID, fromName: c.title, avatarElement: avatar(c), controlled: true, dontSetActive: true,
    isMainList: true, rippleEnabled: true, noIcons: true, wrapOptions: {}
  } as any);
  const li = d.dom.listEl;
  li.dataset.priveWc = c.id; li.classList.add('prive-wc-row'); li.setAttribute('href', '#prive-wc');
  li.setAttribute('aria-label', c.title + ', via ' + (c.site?.name || 'website') + (c.unread ? `, ${c.unread} unread` : ''));
  // own hold / right-click (tweb's chat context menu skips these rows): long-press 500 ms on touch, contextmenu on desktop
  const fire = () => document.dispatchEvent(new CustomEvent('prive-wc-menu', {detail: c.id}));
  li.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); fire(); }, true);
  let t = 0, x0 = 0, y0 = 0; const clear = () => { if(t) clearTimeout(t); t = 0; };
  li.addEventListener('touchstart', (e) => { const q = e.touches[0]; x0 = q.clientX; y0 = q.clientY; clear(); t = window.setTimeout(() => { t = 0; try { navigator.vibrate?.(10); } catch(_) {} fire(); }, 500); }, {passive: true});
  li.addEventListener('touchmove', (e) => { const q = e.touches[0]; if(Math.abs(q.clientX - x0) > 10 || Math.abs(q.clientY - y0) > 10) clear(); }, {passive: true});
  li.addEventListener('touchend', clear); li.addEventListener('touchcancel', clear);
  it.el = d; paint(it);
  return li;
}

// pinned rows join Telegram's pinned block (just below Telegram's pins), the rest sort by their last message
const indexOf = (c: WcChat) => c.pinned ? (0x7fff0000 - 1 - (chats.filter((x) => x.pinned && x.pinned > c.pinned).length & 0xff)) * 0x10000 : Math.floor(c.lastAt / 1000) * 0x10000;

function rowFor(c: WcChat): Item {
  let it = items.get(c.id);
  if(it) { const avChanged = it.chat.avatarUrl !== c.avatarUrl || it.chat.role !== c.role; it.chat = c; if(avChanged && it.el) it.rebuild = true; return it; }
  it = {chat: c, row: null};
  const self = it;
  it.row = new CustomSortedDialog({render: () => build(self), destroy: () => { self.el?.destroy?.(); self.el = undefined; }, getIndex: () => indexOf(self.chat)});
  items.set(c.id, it);
  return it;
}

let syncing: Promise<void> = Promise.resolve();
function sync() {
  return syncing = syncing.then(async() => {
    const xds = (appDialogsManager as any).xds || {};
    const counts: Record<number, number> = {};
    const seen = new Set<string>();
    for(const c of chats) {
      const it = rowFor(c); seen.add(c.id);
      const want = c.archived ? FOLDER_ID_ARCHIVE : FOLDER_ID_ALL;
      if(it.list !== undefined && it.list !== want) { xds[it.list]?.sortedList?.delete(it.row, false); it.list = undefined; }
      const sl = xds[want]?.sortedList;
      if(!sl) continue;
      counts[want] = (counts[want] || 0) + 1;
      // only inside the part of the list Telegram has loaded so far (older rows join as the user scrolls down), so a
      // trimmed tail is not refilled with our rows and paging keeps following Telegram's own cursor
      if(!sl.has(it.row) && !xds[want].hasReachedTheEnd) {
        let min = Infinity;
        try { for(const x of sl.getSortedItems() as any[]) if(!(x.value instanceof CustomSortedDialog) && typeof x.index === 'number' && x.index < min) min = x.index; } catch(e) {}
        if(min !== Infinity && indexOf(c) < min) continue;
      }
      try {
        if(it.rebuild && sl.has(it.row)) { sl.delete(it.row, false); it.row.destroy(); }
        it.rebuild = false;
        if(sl.has(it.row)) { paint(it); await sl.update(it.row); } else { await sl.add(it.row); paint(it); }
        it.list = want;
      } catch(e) { console.warn('[prive] wc row', e); }
    }
    for(const [id, it] of items) {
      if(seen.has(id)) continue;
      if(it.list !== undefined) xds[it.list]?.sortedList?.delete(it.row, false);
      it.row.destroy(); items.delete(id);
    }
    for(const fid of [FOLDER_ID_ALL, FOLDER_ID_ARCHIVE]) xds[fid]?.sortedList?.setPriveCountOffset?.(counts[fid] || 0);
  }).catch((e) => console.warn('[prive] wc sync', e));
}

let loading = false;
export async function reloadWcChats() {
  if(loading || !priveToken()) return; loading = true;
  try {
    const r = await api('/api/wc/list');
    if(r.status === 200) { chats = r.j.chats || []; await sync(); }
  } finally { loading = false; }
}
export const wcChats = () => chats;

/* ---------- live updates: the Prive socket (same server, same session + unlock token) ---------- */
let sock: any;
function loadIo(): Promise<any> {
  if((window as any).io) return Promise.resolve((window as any).io);
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/socket.io/socket.io.js'; s.onload = () => res((window as any).io); s.onerror = rej; document.head.append(s); });
}
let tReload = 0;
const soon = () => { clearTimeout(tReload); tReload = window.setTimeout(reloadWcChats, 400); };
async function connect() {
  if(sock || !priveToken()) return;
  try {
    const io = await loadIo();
    sock = io({auth: (cb: any) => cb({token: priveToken(), unlock: (window as any).__priveUnlock?.()}), transports: ['websocket', 'polling']});
    sock.on('message', soon); sock.on('conv', soon); sock.on('site:activity', soon);
    sock.on('connect_error', () => {});
    sock.on('prive:locked', () => sock?.disconnect());
  } catch(e) { sock = null; }
}

/* ---------- opening a chat ---------- */
let overlay: HTMLElement;
export async function openWcChatById(convId: string) {
  if(!chats.some((x) => x.id === convId)) await reloadWcChats();
  openWcChat(convId);
}
export function openWcChat(convId: string) {
  const c = chats.find((x) => x.id === convId);
  closeWcChat(true);
  const q = new URLSearchParams({embed: 'tweb', solo: '1', tab: 'chats'});
  if(c?.role === 'moderating') { q.set('mod', convId); q.set('site', c.siteId); api('/api/wc/state', {convId, read: 1}).then(soon); }
  else q.set('open', convId);
  overlay = document.createElement('div');
  overlay.className = 'prive-wc-chat';
  const f = document.createElement('iframe');
  f.src = '/app/?' + q; f.title = c ? c.title : 'Website chat'; f.setAttribute('allow', 'clipboard-write');
  overlay.append(f);
  const center = window.innerWidth >= 925 && document.getElementById('column-center');
  (center || document.body).append(overlay);
  overlay.classList.toggle('in-center', !!center);
  document.body.classList.add('prive-wc-open');
  requestAnimationFrame(() => overlay?.classList.add('show'));
  items.forEach((it) => it.el?.dom.listEl.classList.toggle('active', it.chat.id === convId));
  if(c && c.unread && c.role !== 'moderating') { c.unread = 0; const it = items.get(c.id); if(it) paint(it); }
}
export function closeWcChat(instant = false) {
  const o = overlay; overlay = undefined;
  document.body.classList.remove('prive-wc-open');
  items.forEach((it) => it.el?.dom.listEl.classList.remove('active'));
  if(!o) return;
  if(instant) { o.remove(); return; }
  o.classList.remove('show'); setTimeout(() => o.remove(), 260);
  soon();
}

/* ---------- hold / right-click menu ---------- */
function menu(convId: string) {
  const c = chats.find((x) => x.id === convId); if(!c) return;
  const el = document.createElement('div'); el.className = 'prive-asheet-root';
  const body = document.createElement('div'); body.className = 'prive-asheet-in'; el.append(body);
  const close = () => { el.classList.remove('is-open'); setTimeout(() => el.remove(), 220); };
  el.addEventListener('click', (e) => { if(e.target === el) close(); });
  const h = document.createElement('div'); h.className = 'prive-asheet-title'; h.textContent = c.title + ' · via ' + (c.site?.name || 'website'); body.append(h);
  const act = (label: string, cls: string, patch: any) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'prive-asheet-btn ' + cls; b.textContent = label;
    b.onclick = async() => { close(); if(!patch) return; const r = await api('/api/wc/state', {convId, ...patch}); if(r.status === 200) reloadWcChats(); };
    body.append(b);
  };
  act(c.pinned ? 'Unpin' : 'Pin', '', {pin: !c.pinned});
  act(c.muted ? 'Unmute' : 'Mute notifications', '', {mute: !c.muted});
  act(c.archived ? 'Unarchive' : 'Archive', '', {archive: !c.archived});
  if(c.unread) act('Mark as read', '', {read: 1});
  act('Cancel', 'cancel', null);
  document.body.append(el); requestAnimationFrame(() => el.classList.add('is-open'));
}

let installed = false;
export function installWcChats() {
  if(installed) return; installed = true;
  document.addEventListener('prive-wc-open', (e: any) => { if(Date.now() - lastMenu > 700) openWcChat(e.detail); }); // not the tap that ended a long-press
  document.addEventListener('prive-wc-menu', (e: any) => { if(Date.now() - lastMenu > 400) { lastMenu = Date.now(); menu(e.detail); } });
  window.addEventListener('message', (e) => {
    if(e.origin !== location.origin || !e.data) return;
    if(e.data.prive === 'close-chat') closeWcChat();
  });
  window.addEventListener('keydown', (e) => { if(e.key === 'Escape' && overlay) closeWcChat(); });
  const start = () => { reloadWcChats(); connect(); };
  import('@/prive/passlock').then((pl) => pl.onceUnlocked(start)).catch(start);
  document.addEventListener('prive-unlocked', () => { if(sock && !sock.connected) sock.connect(); soon(); });
  document.addEventListener('prive-filter-change', () => setTimeout(sync, 300));
  // the lists can be rebuilt by tweb (folder switch, archive opened, reconnect): put the rows back
  setInterval(() => {
    if(document.hidden || !chats.length) return;
    const xds = (appDialogsManager as any).xds || {};
    if(chats.some((c) => { const sl = xds[c.archived ? FOLDER_ID_ARCHIVE : FOLDER_ID_ALL]?.sortedList; return sl && !sl.has(rowFor(c).row); })) sync();
  }, 1500);
  setInterval(() => { if(!document.hidden) reloadWcChats(); }, 60e3);
}
let lastMenu = 0;
