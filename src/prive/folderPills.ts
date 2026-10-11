/*
 * Prive: the chat-list pill row (replaces Telegram's folder tabs).
 *  - The list shows every chat by default (no "All" tab).
 *  - Channels is a toggle filter: tap = only broadcast channels, tap again = back to all chats. It switches the chat
 *    list to Prive's local Channels filter (filtersStorage, PRIVE_CHANNELS_FILTER_ID): a real, paged, Telegram-sorted
 *    virtual list (pinned, then by last message) of normal rows. Never one of the user's Telegram folders.
 *  - One launcher chip per connected website (0-4; the row scrolls sideways) with the site's favicon and name: opens the
 *    site full-screen as a mini app (siteSheet). Launchers never change the filter. A dot marks unseen website updates.
 * Motion (prive-web.css): press scale + spring back, sliding gold highlight on the active chip, chips fade/slide in.
 */
import {createEffect, createRoot} from 'solid-js';
import appDialogsManager from '@lib/appDialogsManager';
import rootScope from '@lib/rootScope';
import {FOLDER_ID_ALL, PRIVE_CHANNELS_FILTER_ID} from '@appManagers/constants';
import {privePrefs, priveToken, type PriveSite} from '@/prive/api';
import {openSiteSheet} from '@/prive/siteSheet';

export type PriveListFilter = 'all' | 'channels';
let current: PriveListFilter = 'all';
let bar: HTMLDivElement;
export const priveListFilter = () => current;

let channelsListReady = false;
async function setFilter(f: PriveListFilter) {
  current = f;
  const ch = bar.querySelector<HTMLElement>('[data-f="channels"]');
  ch?.classList.toggle('active', f === 'channels');
  ch?.setAttribute('aria-pressed', String(f === 'channels'));
  document.body.classList.toggle('prive-filter-active', f !== 'all');
  try {
    if(f === 'channels' && !channelsListReady) {
      const filter = await rootScope.managers.filtersStorage.getFilter(PRIVE_CHANNELS_FILTER_ID);
      (appDialogsManager as any).addFilter(filter); // its own list + scroller, like a folder tab (tabs are hidden in Prive)
      channelsListReady = true;
    }
    const id = f === 'channels' ? PRIVE_CHANNELS_FILTER_ID : FOLDER_ID_ALL;
    const adm = appDialogsManager as any;
    if(adm.filterId !== id) {
      adm.xds?.[id]?.clear(); // same as Telegram's own folder switch: the list reloads from the dialogs storage
      await appDialogsManager.setFilterIdAndChangeTab(id);
    }
    // there is no folder tab for it (the tabs are hidden in Prive), so show its scroller directly
    for(const [fid, r] of Object.entries<any>(adm.filtersRendered || {})) r?.container?.classList.toggle('active', +fid === id);
    adm.xds?.[id]?.scrollable?.container?.scrollTo({top: 0});
  } catch(e) { console.warn('[prive] channels filter', e); }
  document.dispatchEvent(new CustomEvent('prive-filter-change', {detail: f})); // wcChats.ts puts its rows back into All
}

const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch(e) { return u; } };
const faviconFor = (s: PriveSite) => s.icon || (() => { try { return new URL('/favicon.ico', s.url).href; } catch(e) { return ''; } })(); // no third-party favicon service

function siteButton(s: PriveSite, i: number) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'prive-pill-site prive-chip-in'; b.dataset.site = s.id;
  if((s as any).feedId) b.dataset.feed = (s as any).feedId;
  b.style.setProperty('--i', String(i));
  const name = s.name || hostOf(s.url);
  b.setAttribute('aria-label', 'Open ' + name);
  const fav = document.createElement('span'); fav.className = 'prive-pill-fav'; fav.textContent = (name[0] || '?').toUpperCase();
  const icon = faviconFor(s);
  if(icon) {
    const img = document.createElement('img'); img.alt = ''; img.referrerPolicy = 'no-referrer'; img.decoding = 'async'; img.src = icon;
    img.onload = () => { if(img.naturalWidth > 2) fav.classList.add('has-img'); else img.remove(); }; img.onerror = () => img.remove();
    fav.append(img);
  }
  const label = document.createElement('span'); label.className = 'prive-pill-label'; label.textContent = name;
  const dot = document.createElement('span'); dot.className = 'prive-pill-dot'; dot.setAttribute('aria-hidden', 'true');
  b.append(fav, label, dot);
  b.addEventListener('click', () => openSiteSheet(s)); // a launcher: the list filter stays as it is
  return b;
}

/** unseen website updates -> dot on that site's chip */
async function paintUnseen() {
  if(!bar || !priveToken()) return;
  try {
    const r = await fetch('/api/updates/stories', {headers: {Authorization: 'Bearer ' + priveToken()}});
    if(!r.ok) return;
    const j = await r.json();
    const byFeed = new Map<string, number>(); const byHost = new Map<string, number>();
    for(const x of j.sites || []) { byFeed.set(x.id, x.unread || 0); if(x.host) byHost.set(String(x.host).replace(/^www\./, ''), x.unread || 0); }
    bar.querySelectorAll<HTMLElement>('.prive-pill-site').forEach((b) => {
      const s = (privePrefs()?.userSites || []).find((x) => x.id === b.dataset.site);
      const n = (b.dataset.feed && byFeed.get(b.dataset.feed)) || (s && byHost.get(hostOf(s.url))) || 0;
      b.classList.toggle('has-unseen', n > 0);
      b.setAttribute('aria-label', 'Open ' + (b.querySelector('.prive-pill-label')?.textContent || '') + (n > 0 ? `, ${n} new update${n > 1 ? 's' : ''}` : ''));
    });
  } catch(e) {}
}

/** `_openWebsites` is kept for callers of the old row (it had a generic Websites tab). */
export function installFolderPills(_openWebsites?: () => void): HTMLDivElement {
  bar = document.createElement('div');
  bar.className = 'prive-pills prive-pills-v2 prive-pills-v3';
  bar.setAttribute('role', 'toolbar');
  const ch = document.createElement('button');
  ch.type = 'button'; ch.dataset.f = 'channels'; ch.className = 'prive-pill-filter prive-chip-in';
  ch.innerHTML = '<svg class="prive-pill-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1Zm12.5-2.5a6 6 0 0 1 0 9M15 10a2.5 2.5 0 0 1 0 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="prive-pill-label">Channels</span>';
  ch.setAttribute('aria-pressed', 'false');
  ch.addEventListener('click', () => setFilter(current === 'channels' ? 'all' : 'channels'));
  bar.append(ch);
  // one launcher per connected website, live as sites are added/removed (new chips fade/slide in, removed ones fade out)
  let lastKey = '';
  createRoot(() => createEffect(() => {
    const sites = (privePrefs()?.userSites || []).filter((s) => s?.url).slice(0, 4); // up to 4 connected websites
    const key = JSON.stringify(sites.map((s) => [s.id, s.name, s.url, s.icon]));
    if(key === lastKey) return;
    lastKey = key;
    const keep = new Set(sites.map((s) => s.id));
    bar.querySelectorAll<HTMLElement>('.prive-pill-site').forEach((n) => {
      if(keep.has(n.dataset.site)) { n.remove(); return; } // re-added below in order
      const r = n.cloneNode(true) as HTMLElement; r.classList.remove('prive-chip-in'); r.classList.add('prive-chip-out');
      n.replaceWith(r); r.addEventListener('animationend', () => r.remove(), {once: true}); setTimeout(() => r.remove(), 400);
    });
    sites.forEach((s, i) => bar.append(siteButton(s, i + 1)));
    bar.dataset.sites = String(sites.length);
    paintUnseen();
  }));
  document.addEventListener('prive-stories-reload', () => paintUnseen());
  setInterval(() => { if(!document.hidden) paintUnseen(); }, 120e3);
  return bar;
}
