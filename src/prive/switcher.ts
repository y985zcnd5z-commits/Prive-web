/*
 * Prive: account-switcher-style popup (Telegram iOS long-press Settings menu) to flip the SAME account between
 * the Prive view and the Telegram view, plus Telegram's own "Add Account".
 * Opens from: long-press / right-click on the Settings tab (Prive mobile bar), tap on the avatar in the Settings
 * header, and long-press / right-click on the hamburger menu button (both views, desktop too).
 */
import type {AppSidebarLeft} from '@components/sidebarLeft';
import rootScope from '@lib/rootScope';
import apiManagerProxy from '@lib/apiManagerProxy';
import {avatarNew} from '@components/avatarNew';
import {getMiddleware} from '@helpers/middleware';
import {currentView, setView, PriveView} from '@/prive/view';

const CHECK = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const TG = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#2AABEE"/><path d="M5.4 11.8l11.2-4.3c.5-.2 1 .1.8.9l-1.9 9c-.1.6-.5.8-1 .5l-2.9-2.1-1.4 1.3c-.2.2-.3.3-.6.3l.2-2.9 5.3-4.8c.2-.2 0-.3-.3-.1l-6.6 4.1-2.8-.9c-.6-.2-.6-.6.1-.9z" fill="#fff"/></svg>';

let sidebarRef: AppSidebarLeft;
let open: HTMLDivElement;

function myName() {
  try {
    const u = apiManagerProxy.getUser(rootScope.myId as any) as any;
    return [u?.first_name, u?.last_name].filter(Boolean).join(' ') || 'My account';
  } catch(e) { return 'My account'; }
}

function close() {
  if(!open) return;
  const o = open; open = undefined;
  o.classList.remove('show');
  setTimeout(() => o.remove(), 180);
}

export type SwitchGuard = (to: PriveView) => Promise<boolean>;
let guard: SwitchGuard = async() => true;
/** The Prive password (when set) plugs in here: Telegram -> Prive must be unlocked. */
export function setSwitchGuard(g: SwitchGuard) { guard = g; }

export async function switchTo(view: PriveView) {
  if(view === currentView()) return;
  if(!(await guard(view))) return;
  setView(view);
}

export function openSwitcher(anchor?: HTMLElement | {x: number, y: number}) {
  if(open) { if(Date.now() >= ignoreUntil) close(); return; }
  const cur = currentView();
  const wrap = document.createElement('div');
  wrap.className = 'prive-switcher' + (cur === 'telegram' ? ' is-tg' : '');
  const menu = document.createElement('div');
  menu.className = 'prive-switcher-menu';
  menu.setAttribute('role', 'menu');
  const mw = getMiddleware();
  const row = (view: PriveView, label: string, badge: string) => {
    const r = document.createElement('button');
    r.type = 'button'; r.className = 'prive-switcher-row'; r.setAttribute('role', 'menuitemradio');
    r.setAttribute('aria-checked', String(view === cur));
    const av = document.createElement('span'); av.className = 'prive-switcher-av';
    try { const a = avatarNew({middleware: mw.get(), size: 30, peerId: rootScope.myId}); av.append(a.node); } catch(e) {}
    const b = document.createElement('span'); b.className = 'prive-switcher-badge ' + view; b.innerHTML = badge; av.append(b);
    const t = document.createElement('span'); t.className = 'prive-switcher-text';
    t.innerHTML = `<b></b><small></small>`;
    t.firstElementChild.textContent = label; t.lastElementChild.textContent = myName();
    const c = document.createElement('span'); c.className = 'prive-switcher-check'; if(view === cur) c.innerHTML = CHECK;
    r.append(av, t, c);
    r.addEventListener('click', () => { if(Date.now() < ignoreUntil) return; close(); switchTo(view); });
    return r;
  };
  menu.append(row('prive', 'Prive', '<i>P</i>'), row('telegram', 'Telegram', TG));
  const sep = document.createElement('div'); sep.className = 'prive-switcher-sep'; menu.append(sep);
  const add = document.createElement('button');
  add.type = 'button'; add.className = 'prive-switcher-row prive-switcher-add';
  add.innerHTML = `<span class="prive-switcher-plus">${PLUS}</span><span class="prive-switcher-text"><b>Add Account</b></span>`;
  add.addEventListener('click', (e) => { if(Date.now() < ignoreUntil) return; close(); sidebarRef?.addAccount(e as MouseEvent); });
  menu.append(add);
  wrap.append(menu);
  wrap.addEventListener('click', (e) => { if(Date.now() < ignoreUntil) return; if(e.target === wrap) close(); });
  wrap.addEventListener('contextmenu', (e) => { e.preventDefault(); if(Date.now() < ignoreUntil) return; close(); });
  wrap.addEventListener('touchend', (e) => { if(Date.now() < ignoreUntil && e.target === wrap) e.preventDefault(); }, {passive: false});
  document.addEventListener('keydown', function esc(e) { if(e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
  document.body.append(wrap);
  // position: above a bottom anchor (tab bar), below a top anchor (avatar/hamburger), clamped to the viewport
  const W = 260, vw = window.innerWidth, vh = window.innerHeight;
  let x = vw / 2, y = vh / 2, above = false;
  if(anchor instanceof HTMLElement) {
    const rc = anchor.getBoundingClientRect();
    x = rc.left + rc.width / 2; above = rc.top > vh / 2; y = above ? rc.top - 8 : rc.bottom + 8;
  } else if(anchor) { x = anchor.x; y = anchor.y; above = y > vh / 2; }
  const left = Math.max(8, Math.min(vw - W - 8, x - W / 2));
  menu.style.left = left + 'px';
  if(above) { menu.style.bottom = (vh - y) + 'px'; menu.style.transformOrigin = `${x - left}px 100%`; } else { menu.style.top = y + 'px'; menu.style.transformOrigin = `${x - left}px 0`; }
  open = wrap;
  requestAnimationFrame(() => wrap.classList.add('show'));
  mw.get().onDestroy(() => {});
  setTimeout(() => { if(!wrap.isConnected) mw.destroy(); }, 60e3);
}

/** Clicks/contextmenus that are just the tail of the gesture which opened the popup are ignored until then. */
let ignoreUntil = 0;
const settle = (ms = 650) => { ignoreUntil = Date.now() + ms; };

/**
 * Long-press (touch or mouse, 450ms) or right-click on el opens the switcher, like Telegram's Settings tab.
 * The popup stays open after the finger lifts; sliding the finger onto an option and releasing selects it.
 * A short tap stays a normal click.
 */
export function bindLongPress(el: HTMLElement) {
  el.classList.add('prive-no-callout');
  let t: number, fired = false, hover: HTMLElement;
  const fire = () => { fired = true; settle(); navigator.vibrate?.(10); if(!open) openSwitcher(el); };
  const cancel = () => clearTimeout(t);
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault(); e.stopPropagation();
    if(fired || Date.now() < ignoreUntil) return; // the long-press already opened it (mobile fires contextmenu too)
    settle(); if(!open) openSwitcher(el);
  }, true);
  // touch
  el.addEventListener('touchstart', () => { fired = false; hover = undefined; cancel(); t = window.setTimeout(fire, 450); }, {passive: true});
  el.addEventListener('touchmove', (e) => {
    if(!fired) { cancel(); return; }
    const p = e.touches[0];
    const row = (document.elementFromPoint(p.clientX, p.clientY) as HTMLElement)?.closest?.('.prive-switcher-row') as HTMLElement;
    if(row !== hover) { hover?.classList.remove('hover'); row?.classList.add('hover'); hover = row; }
    e.preventDefault();
  }, {passive: false});
  el.addEventListener('touchend', (e) => {
    cancel();
    if(!fired) return;
    e.preventDefault(); // no synthetic click on the tab or the overlay
    settle();
    if(hover) { const r = hover; hover.classList.remove('hover'); hover = undefined; ignoreUntil = 0; r.click(); }
  }, {passive: false});
  el.addEventListener('touchcancel', cancel, {passive: true});
  // mouse long-press (desktop)
  el.addEventListener('mousedown', (e) => { if(e.button !== 0 || (e as any).sourceCapabilities?.firesTouchEvents) return; fired = false; cancel(); t = window.setTimeout(fire, 450); });
  el.addEventListener('mouseup', () => { cancel(); if(fired) settle(); });
  el.addEventListener('mouseleave', cancel);
  el.addEventListener('click', (e) => {
    if(fired || Date.now() < ignoreUntil) { e.stopImmediatePropagation(); e.preventDefault(); fired = false; }
  }, true);
}

export function installSwitcher(sidebar: AppSidebarLeft) {
  sidebarRef = sidebar;
  // tap on the avatar in the Settings header (capture: before the photo viewer)
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const av = t?.closest?.('.settings-container .profile-avatars-container, .settings-container .profile-avatars-avatar, .settings-container .avatar-full');
    if(!av || t.closest('.prive-switcher')) return;
    e.stopPropagation(); e.preventDefault();
    openSwitcher(av as HTMLElement);
  }, true);
  // hamburger: long-press / right-click
  const hook = () => {
    const btn = document.querySelector('#column-left .sidebar-header .btn-menu-toggle') as HTMLElement;
    if(btn && !btn.dataset.priveSwitch) { btn.dataset.priveSwitch = '1'; bindLongPress(btn); }
    else if(!btn) setTimeout(hook, 800);
  };
  hook();
  (window as any).priveOpenSwitcher = openSwitcher; // for the harness / debugging
}
