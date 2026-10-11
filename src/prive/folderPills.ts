/*
 * Prive: the 4 fixed chat-list filters in one rounded pill (Telegram iOS style), replacing Telegram's folder tabs.
 * All = every chat, Channels = broadcast channels, Websites = the Website Connect chats (Websites tab), Bots = bot chats.
 * Filtering is local to this device and never changes the user's Telegram folders.
 */
import apiManagerProxy from '@lib/apiManagerProxy';
import appDialogsManager from '@lib/appDialogsManager';
import {FOLDER_ID_ALL} from '@appManagers/constants';

type Filter = 'all' | 'channels' | 'websites' | 'bots';
const LABELS: [Filter, string][] = [['all', 'All'], ['channels', 'Channels'], ['websites', 'Websites'], ['bots', 'Bots']];
let current: Filter = 'all';
let bar: HTMLDivElement;

function matches(peerId: number): boolean {
  if(current === 'all') return true;
  try {
    if(current === 'bots') return peerId > 0 && !!(apiManagerProxy.getUser(peerId as any) as any)?.pFlags?.bot;
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
    empty.textContent = current === 'bots' ? 'No bot chats yet' : 'No channels yet';
  } else empty?.remove();
}

function select(f: Filter, openWebsites: () => void) {
  if(f === 'websites') { openWebsites(); return; }
  current = f;
  bar.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.f === f));
  try { appDialogsManager.setFilterIdAndChangeTab(FOLDER_ID_ALL); } catch(e) {}
  apply();
  const sc = document.querySelector('#folders-container .scrollable') as HTMLElement;
  sc?.scrollTo({top: 0});
}

export function installFolderPills(openWebsites: () => void): HTMLDivElement {
  bar = document.createElement('div');
  bar.className = 'prive-pills';
  bar.setAttribute('role', 'tablist');
  for(const [f, label] of LABELS) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.f = f; b.textContent = label;
    b.setAttribute('role', 'tab');
    if(f === current) b.classList.add('active');
    b.addEventListener('click', () => select(f, openWebsites));
    bar.append(b);
  }
  // keep filtering as the chat list renders/loads more rows
  let raf = 0;
  const mo = new MutationObserver(() => { if(current === 'all' || raf) return; raf = requestAnimationFrame(() => { raf = 0; apply(); }); });
  const watch = () => { const c = document.getElementById('folders-container'); if(c) mo.observe(c, {childList: true, subtree: true}); else setTimeout(watch, 500); };
  watch();
  // swipe left/right on the list switches All <-> Channels <-> Bots (nice-to-have)
  let sx = 0, sy = 0;
  const order: Filter[] = ['all', 'channels', 'bots'];
  document.addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, {passive: true});
  document.addEventListener('touchend', (e) => {
    if(!(e.target as HTMLElement)?.closest?.('#folders-container')) return;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if(Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    const i = order.indexOf(current) + (dx < 0 ? 1 : -1);
    if(i >= 0 && i < order.length) select(order[i], openWebsites);
  }, {passive: true});
  return bar;
}
