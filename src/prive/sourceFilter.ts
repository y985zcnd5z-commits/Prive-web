/*
 * Which chats the list shows: All, Telegram, Website chats, or one website-chat
 * category. Tapping the Chats pill opens the menu. The choice is remembered in
 * localStorage `prive_src_filter` (`tg`, `web`, or `cat:<category_id>`).
 *
 * Port onto live v388 src/prive/sourceFilter.ts: keep the Unread row,
 * setPriveSrcSignal, and swallowClickFromThisPointerGesture. Build items with
 * wcMenuEntries() and place category rows after Website Chats. Categories are
 * generic labels from the payload, not a fixed site list.
 */
import {wcCategorySource, wcListChoice, wcMenuEntries, wcPillLabel, type WcListChoice} from '@/prive/wcCategories';
import {closeWcSourceMenu, toggleWcSourceMenu} from '@/prive/wcSourceMenu';

const KEY = 'prive_src_filter';
let pill: HTMLElement | undefined;

export function sourceFilter(): WcListChoice {
  try { return wcListChoice(localStorage.getItem(KEY)); } catch(e) { return 'all'; }
}

function paintPill() {
  if(!pill) return;
  const f = sourceFilter();
  const label = pill.querySelector('.prive-pill-label');
  if(label) label.textContent = wcPillLabel(f, wcMenuEntries(wcCategorySource()));
  pill.classList.toggle('active', f !== 'all');
  pill.setAttribute('aria-pressed', String(f !== 'all'));
}

export function applySourceFilter(f = sourceFilter()) {
  document.body.classList.toggle('prive-src-tg', f === 'tg');
  document.body.classList.toggle('prive-src-web', f === 'web');
  document.body.classList.toggle('prive-src-cat', f.startsWith('cat:'));
  document.body.classList.toggle('prive-wc-pane', f === 'web' || f.startsWith('cat:'));
  if(f.startsWith('cat:')) document.body.dataset.priveWcCat = f.slice(4);
  else delete document.body.dataset.priveWcCat;
  paintPill();
}

export function setSourceFilter(f: WcListChoice) {
  try {
    if(f === 'all') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, f);
  } catch(e) {}
  applySourceFilter(f);
  document.dispatchEvent(new CustomEvent('prive-src-filter', {detail: f}));
  try {
    (document.querySelector('#folders-container .scrollable-y.active, #folders-container .scrollable-y') as HTMLElement)?.scrollTo({top: 0});
  } catch(e) {}
}

export function watchChatsPill(btn: HTMLElement) {
  pill = btn;
  paintPill();
}

export function toggleSourceMenu(anchor: HTMLElement) {
  toggleWcSourceMenu(anchor, () => wcMenuEntries(wcCategorySource()), sourceFilter, (id) => {
    setSourceFilter(id);
    closeWcSourceMenu(false);
  });
}

export function closeSourceMenu() { closeWcSourceMenu(false); }

export function installSourceFilter() {
  applySourceFilter();
  document.addEventListener('prive-wc-categories', () => applySourceFilter());
  window.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeWcSourceMenu(false); });
}

(window as any).priveOpenWebsiteChats = () => {
  try {
    window.dispatchEvent(new Event('prive-go-chats'));
    setSourceFilter('web');
    return true;
  } catch(e) { return false; }
};
