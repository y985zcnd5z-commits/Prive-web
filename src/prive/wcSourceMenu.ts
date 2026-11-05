/*
 * Chats menu: All Chats, Telegram Chats, Website Chats, then one item per
 * category from wcMenuEntries(). Same roles as the live source menu so the
 * category rows can be dropped into v388 sourceFilter.ts after Website Chats.
 */
import Modes from '@config/modes';
import type {WcListChoice, WcMenuEntry} from '@/prive/wcCategories';

const SVG: Record<string, string> = {
  all: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  tg: '<path d="M21 4 3 11l6 2 2 6 3-4 5 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m9 13 8-6" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  web: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  cat: '<path d="M4 7h6l2 2h8v9H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'
};

function iconEl(entry: WcMenuEntry) {
  const name = entry.id === 'tg' ? 'tg' : entry.id === 'web' ? 'web' : entry.category ? 'cat' : 'all';
  const wrap = document.createElement('span');
  wrap.innerHTML = `<svg class="prive-src-ico" viewBox="0 0 24 24" aria-hidden="true">${SVG[name]}</svg>`;
  const svg = wrap.firstElementChild as SVGElement;
  if(entry.category && entry.icon) {
    const img = document.createElement('img');
    img.className = 'prive-src-img';
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    img.src = entry.icon;
    img.addEventListener('error', () => img.remove());
    svg.insertAdjacentElement('afterend', img);
    const box = document.createElement('span');
    box.className = 'prive-src-icobox';
    box.append(svg, img);
    return box;
  }
  return svg;
}

type Ctx = {
  anchor: HTMLElement,
  entries: () => WcMenuEntry[],
  current: () => WcListChoice,
  onPick: (id: WcListChoice) => void
};

let menu: HTMLDivElement | undefined;
let ctx: Ctx | undefined;
let swallowUntil = 0;

function focusItem(box: HTMLElement, el: HTMLElement) {
  if(!Modes.a11y) return;
  box.querySelectorAll<HTMLElement>('[role="menuitemradio"]').forEach((n) => n.setAttribute('tabindex', n === el ? '0' : '-1'));
  el.focus();
}

function fillBox(box: HTMLElement) {
  if(!ctx) return;
  const entries = ctx.entries();
  const current = ctx.current();
  box.replaceChildren();
  const known = entries.some((e) => e.id === current);
  entries.forEach((entry, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'prive-src-item' + (entry.id === current ? ' on' : '') + (entry.category ? ' is-category' : '');
    b.dataset.choice = entry.id;
    b.setAttribute('role', 'menuitemradio');
    b.setAttribute('aria-checked', String(entry.id === current));
    if(Modes.a11y) b.tabIndex = (known ? entry.id === current : i === 0) ? 0 : -1;
    const check = document.createElement('span');
    check.className = 'prive-src-check';
    check.setAttribute('aria-hidden', 'true');
    check.innerHTML = '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const label = document.createElement('span');
    label.className = 'prive-src-label';
    label.textContent = entry.label;
    b.append(check, label, iconEl(entry));
    if(entry.unread > 0) {
      const n = document.createElement('span');
      n.className = 'prive-src-unread';
      n.textContent = entry.unread > 99 ? '99+' : String(entry.unread);
      b.append(n);
    }
    const extra = entry.unread > 0 ? `, ${entry.unread} unread` : '';
    b.setAttribute('aria-label', entry.label + extra);
    b.addEventListener('click', () => ctx?.onPick(entry.id));
    b.addEventListener('keydown', (e) => {
      if(!Modes.a11y) return;
      const items = [...box.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
      const at = items.indexOf(b);
      let next = -1;
      if(e.key === 'ArrowDown') next = (at + 1) % items.length;
      else if(e.key === 'ArrowUp') next = (at - 1 + items.length) % items.length;
      else if(e.key === 'Home') next = 0;
      else if(e.key === 'End') next = items.length - 1;
      else if(e.key === 'Escape') { e.preventDefault(); closeWcSourceMenu(false); return; }
      if(next < 0) return;
      e.preventDefault();
      focusItem(box, items[next]);
    });
    box.append(b);
  });
}

function place(anchor: HTMLElement, box: HTMLElement) {
  const r = anchor.getBoundingClientRect();
  const left = Math.max(8, Math.min(window.innerWidth - 280, r.left));
  box.style.left = left + 'px';
  const below = r.top < window.innerHeight / 2;
  box.style.top = '';
  box.style.bottom = '';
  if(below) box.style.top = (r.bottom + 8) + 'px';
  else box.style.bottom = (window.innerHeight - r.top + 8) + 'px';
}

export function closeWcSourceMenu(fromDismiss = false) {
  const m = menu;
  if(!m) return;
  const anchor = ctx?.anchor;
  menu = undefined;
  ctx = undefined;
  anchor?.setAttribute('aria-expanded', 'false');
  anchor?.classList.remove('prive-src-anchor-open');
  if(fromDismiss) swallowUntil = performance.now() + 400;
  m.classList.remove('show');
  const done = () => m.remove();
  m.addEventListener('transitionend', done, {once: true});
  setTimeout(done, 220);
}

export function toggleWcSourceMenu(anchor: HTMLElement, entries: () => WcMenuEntry[], current: () => WcListChoice, onPick: (id: WcListChoice) => void) {
  if(performance.now() < swallowUntil) return;
  if(menu) { closeWcSourceMenu(false); return; }
  ctx = {anchor, entries, current, onPick};
  const m = menu = document.createElement('div');
  m.className = 'prive-src-menu';
  m.setAttribute('role', 'presentation');
  const back = document.createElement('div');
  back.className = 'prive-src-back';
  back.addEventListener('pointerdown', (e) => { e.preventDefault(); closeWcSourceMenu(true); });
  const box = document.createElement('div');
  box.className = 'prive-src-box';
  box.setAttribute('role', 'menu');
  box.setAttribute('aria-label', 'Chats');
  fillBox(box);
  m.append(back, box);
  document.body.append(m);
  place(anchor, box);
  anchor.setAttribute('aria-expanded', 'true');
  anchor.classList.add('prive-src-anchor-open');
  requestAnimationFrame(() => m.classList.add('show'));
  if(Modes.a11y) {
    const on = box.querySelector<HTMLElement>('.prive-src-item.on') || box.querySelector<HTMLElement>('.prive-src-item');
    on?.focus();
  }
}

if(typeof document !== 'undefined') {
  document.addEventListener('prive-wc-categories', () => {
    const box = menu?.querySelector('.prive-src-box');
    if(box) fillBox(box as HTMLElement);
  });
}
