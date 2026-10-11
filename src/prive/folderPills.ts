/*
 * Prive: the chat-list pill row (replaces Telegram's folder tabs in the Prive view).
 *  - The list shows every chat by default (no "All" tab).
 *  - Channels is a toggle filter: tap = only broadcast channels, tap again = back to all chats.
 *  - One launcher per connected website (0-2), labelled with the site's name: opens the site full-screen as a mini app
 *    (siteSheet: no browser chrome, same fallback card for sites that refuse framing). Launchers never change the filter.
 * Filtering is local to this device and never changes the user's Telegram folders. Prive-only chats (upcoming) will be
 * plain rows in the same list, so `matches` is the single place to teach them a filter.
 */
import {createEffect, createRoot} from 'solid-js';
import apiManagerProxy from '@lib/apiManagerProxy';
import appDialogsManager from '@lib/appDialogsManager';
import {FOLDER_ID_ALL} from '@appManagers/constants';
import {privePrefs, type PriveSite} from '@/prive/api';
import {openSiteSheet} from '@/prive/siteSheet';

export type PriveListFilter = 'all' | 'channels';
let current: PriveListFilter = 'all';
let bar: HTMLDivElement;
export const priveListFilter = () => current;

function matches(peerId: number): boolean {
  if(current === 'all') return true;
  try {
    if(current === 'channels') {
      if(peerId >= 0) return false;
      const c = apiManagerProxy.getChat(-peerId as any) as any;
      return c?._ === 'channel' && !!c.pFlags?.broadcast;
    }
  } catch(e) {}
  return true;
}

function apply() {
  const rows = document.querySelectorAll<HTMLElement>('#folders-container .chatlist-chat[data-peer-id]');
  let shown = 0;
  rows.forEach((li) => {
    const ok = matches(+li.dataset.peerId);
    li.classList.toggle('prive-filtered', !ok);
    if(ok) shown++;
  });
  document.body.classList.toggle('prive-filter-active', current !== 'all');
  let empty = document.getElementById('prive-filter-empty');
  if(current !== 'all' && !shown) {
    if(!empty) {
      empty = document.createElement('div'); empty.id = 'prive-filter-empty'; empty.className = 'prive-filter-empty';
      document.getElementById('folders-container')?.prepend(empty);
    }
    empty.textContent = 'No channels yet';
  } else empty?.remove();
}

function setFilter(f: PriveListFilter) {
  current = f;
  bar.querySelector('[data-f="channels"]')?.classList.toggle('active', f === 'channels');
  bar.querySelector('[data-f="channels"]')?.setAttribute('aria-pressed', String(f === 'channels'));
  try { appDialogsManager.setFilterIdAndChangeTab(FOLDER_ID_ALL); } catch(e) {}
  apply();
  (document.querySelector('#folders-container .scrollable') as HTMLElement)?.scrollTo({top: 0});
}

const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch(e) { return u; } };

function siteButton(s: PriveSite) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'prive-pill-site'; b.dataset.site = s.id;
  const name = s.name || hostOf(s.url);
  b.setAttribute('aria-label', 'Open ' + name);
  const fav = document.createElement('span'); fav.className = 'prive-pill-fav'; fav.textContent = (name[0] || '?').toUpperCase();
  if(s.icon) {
    const img = document.createElement('img'); img.alt = ''; img.referrerPolicy = 'no-referrer'; img.src = s.icon;
    img.onload = () => fav.classList.add('has-img'); img.onerror = () => img.remove();
    fav.append(img);
  }
  const label = document.createElement('span'); label.className = 'prive-pill-label'; label.textContent = name;
  b.append(fav, label);
  b.addEventListener('click', () => openSiteSheet(s)); // a launcher: the list filter stays as it is
  return b;
}

/** `_openWebsites` is kept for callers of the old row (it had a generic Websites tab). */
export function installFolderPills(_openWebsites?: () => void): HTMLDivElement {
  bar = document.createElement('div');
  bar.className = 'prive-pills prive-pills-v2';
  bar.setAttribute('role', 'toolbar');
  const ch = document.createElement('button');
  ch.type = 'button'; ch.dataset.f = 'channels'; ch.className = 'prive-pill-filter'; ch.textContent = 'Channels';
  ch.setAttribute('aria-pressed', 'false');
  ch.addEventListener('click', () => setFilter(current === 'channels' ? 'all' : 'channels'));
  bar.append(ch);
  // one launcher per connected website, live as sites are added/removed
  let lastKey = '';
  createRoot(() => createEffect(() => {
    const sites = (privePrefs()?.userSites || []).filter((s) => s?.url).slice(0, 2);
    const key = JSON.stringify(sites.map((s) => [s.id, s.name, s.url, s.icon]));
    if(key === lastKey) return;
    lastKey = key;
    bar.querySelectorAll('.prive-pill-site').forEach((n) => n.remove());
    sites.forEach((s) => bar.append(siteButton(s)));
    bar.dataset.sites = String(sites.length);
  }));
  // keep filtering as the chat list renders/loads more rows
  let raf = 0;
  const mo = new MutationObserver(() => { if(current === 'all' || raf) return; raf = requestAnimationFrame(() => { raf = 0; apply(); }); });
  const watch = () => { const c = document.getElementById('folders-container'); if(c) mo.observe(c, {childList: true, subtree: true}); else setTimeout(watch, 500); };
  watch();
  return bar;
}
