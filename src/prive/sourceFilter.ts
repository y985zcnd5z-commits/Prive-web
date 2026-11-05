/*
 * Which chats the list shows. Tapping the bottom Chats button while the list
 * is already showing opens the menu (All / Telegram / Website / Unread).
 * The choice is remembered (localStorage 'prive_src_filter').
 */
import {createRoot, createSignal} from 'solid-js';
import {createAnchoredMenuToggle} from '@helpers/dom/anchoredMenuToggle';

export type SourceFilter = 'all' | 'tg' | 'web' | 'unread';

const KEY = 'prive_src_filter';
const OPTS: [SourceFilter, string, string][] = [
  ['all', 'All Chats', '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'],
  ['tg', 'Telegram Chats', '<path d="M21 4 3 11l6 2 2 6 3-4 5 4z"/><path d="m9 13 8-6"/>'],
  ['web', 'Website Chats', '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'],
  ['unread', 'Unread Chats', '<path d="M14.6 4.4A8 8 0 0 0 5 15.4L4 20l5.4-.9A8 8 0 0 0 20.6 9.4"/><circle cx="18.6" cy="5.4" r="2.4" fill="currentColor" stroke="none"/>']
];

const [filter, setFilter] = createRoot(() => createSignal<SourceFilter>('all'));

export function readStoredSource(): SourceFilter {
  const v = localStorage.getItem(KEY);
  return v === 'tg' || v === 'web' || v === 'unread' ? v : 'all';
}

export function sourceFilter(): SourceFilter {
  return filter();
}

export function applySourceFilter(next: SourceFilter = readStoredSource()) {
  setFilter(next);
  if(next === 'all') localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, next);
  document.body.classList.toggle('prive-src-tg', next === 'tg');
  document.body.classList.toggle('prive-src-web', next === 'web');
  document.body.classList.toggle('prive-unread-list', next === 'unread');
  document.dispatchEvent(new CustomEvent('prive-src-filter', {detail: next}));
  try {
    (document.querySelector('#folders-container .scrollable-y.active, #folders-container .scrollable-y') as HTMLElement)
      ?.scrollTo({top: 0});
  } catch(e) {}
}

/** Virtual-list row height. Reads the filter signal so a change lays the list out again. */
export function sourceRowSize(item: {type: string, value: any}, fallback: number) {
  const current = filter();
  if(current === 'all' || !item) return fallback;
  const website = item.type === 'custom-sorted-dialog' && item.value?.listKind === 'website';
  if(current === 'web') return website ? fallback : 0;
  if(current === 'tg') return website ? 0 : fallback;
  if(current === 'unread') {
    if(website) return item.value?.isUnread?.() ? fallback : 0;
    if(item.type === 'dialog') {
      const text = item.value?.dom?.unreadBadge?.textContent;
      return text ? fallback : 0;
    }
  }
  return fallback;
}

const menu = createAnchoredMenuToggle({
  markAnchor: (anchor, open) => anchor.classList.toggle('prive-src-anchor-open', open),
  build: (anchor, close) => {
    const current = filter();
    const root = document.createElement('div');
    root.className = 'prive-src-menu';
    root.setAttribute('role', 'menu');
    root.setAttribute('aria-label', 'Chats');
    const dismiss = document.createElement('div');
    dismiss.className = 'prive-src-back';
    const box = document.createElement('div');
    box.className = 'prive-src-box';
    for(const [id, label, icon] of OPTS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'prive-src-item' + (id === current ? ' on' : '');
      button.setAttribute('role', 'menuitemradio');
      button.setAttribute('aria-checked', String(id === current));
      button.innerHTML = `<span class="prive-src-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span><span class="prive-src-label"></span><svg class="prive-src-ico" viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`;
      button.querySelector('.prive-src-label').textContent = label;
      button.addEventListener('click', () => {
        applySourceFilter(id);
        box.querySelectorAll('.prive-src-item').forEach((item) => {
          const on = item === button;
          item.classList.toggle('on', on);
          item.setAttribute('aria-checked', String(on));
        });
        close();
      });
      box.append(button);
    }
    root.append(dismiss, box);
    document.body.append(root);
    const rect = anchor.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - 258, rect.left));
    box.style.left = left + 'px';
    const below = rect.top < window.innerHeight / 2;
    if(below) box.style.top = (rect.bottom + 8) + 'px';
    else box.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
    box.style.transformOrigin = `${rect.left + rect.width / 2 - left}px ${below ? '0' : '100%'}`;
    return {root, dismiss};
  }
});

export function toggleSourceMenu(anchor: HTMLElement) {
  menu.toggle(anchor);
}

export function closeSourceMenu() {
  menu.close();
}

let escapeInstalled = false;
export function installSourceFilter() {
  applySourceFilter(readStoredSource());
  if(escapeInstalled) return;
  escapeInstalled = true;
  window.addEventListener('keydown', (event) => {
    if(event.key === 'Escape') menu.close();
  });
}

const DEMO_ROWS: {title: string, sub: string, website?: boolean, unread?: number}[] = [
  {title: 'Mira Solis', sub: 'The keys are under the mat', unread: 2},
  {title: 'Northwind Market', sub: 'Your order is ready', website: true, unread: 1},
  {title: 'Jonah Hale', sub: 'See you Thursday'},
  {title: 'Harbor Studio', sub: 'Invoice sent', website: true}
];

/** Synthetic list and Chats button. No session, no network. `?menuDemo=1`. */
export function mountSourceMenuDemo() {
  document.body.classList.add('prive-menu-demo', 'prive-tabbar-shown');
  document.body.replaceChildren();
  const phone = document.createElement('div');
  phone.className = 'prive-demo-phone';
  const list = document.createElement('div');
  list.id = 'folders-container';
  list.className = 'prive-demo-list';
  for(const row of DEMO_ROWS) {
    const item = document.createElement('div');
    item.className = 'chatlist-chat prive-demo-row' + (row.website ? ' prive-wc-row' : '');
    const name = document.createElement('b');
    name.textContent = row.title;
    const sub = document.createElement('span');
    sub.textContent = row.sub;
    item.append(name, sub);
    if(row.unread) {
      const badge = document.createElement('i');
      badge.className = 'dialog-subtitle-badge-unread';
      badge.textContent = String(row.unread);
      item.append(badge);
    }
    list.append(item);
  }
  const bar = document.createElement('nav');
  bar.className = 'prive-tabbar';
  bar.setAttribute('aria-label', 'Navigation');
  const chats = document.createElement('button');
  chats.type = 'button';
  chats.className = 'prive-tabbar-item active';
  chats.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5c-4.97 0-9 3.47-9 7.75 0 2.3 1.17 4.37 3.03 5.79-.13 1.2-.6 2.43-1.53 3.46 1.98-.05 3.66-.8 4.86-1.67.84.2 1.7.3 2.64.3 4.97 0 9-3.47 9-7.88S16.97 3.5 12 3.5z"/></svg><span>Chats</span>';
  chats.addEventListener('click', () => toggleSourceMenu(chats));
  bar.append(chats);
  phone.append(list, bar);
  document.body.append(phone);
  installSourceFilter();
}
