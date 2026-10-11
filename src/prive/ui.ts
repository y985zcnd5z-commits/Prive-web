/*
 * Prive additions to Telegram's chat list UI:
 *  - mobile: Telegram Android's floating frosted-glass pill tab bar (Chats, Contacts, Websites, Settings, Profile)
 *  - client mode: the user's websites as Telegram-folder-style tabs above the chat list
 * Desktop keeps Telegram's left-column layout (no bottom bar).
 */
import {createEffect, createRoot} from 'solid-js';
import mediaSizes from '@helpers/mediaSizes';
import type {AppSidebarLeft} from '@components/sidebarLeft';
import {AppContactsTab} from '@components/solidJsTabs/tabs';
import {AppSettingsTab, AppEditProfileTab, getEditProfileInitArgs} from '@components/solidJsTabs';
import {PriveWebsitesTab} from '@/prive/tabs';
import {loadPrivePrefs, privePrefs, PriveSite} from '@/prive/api';

type TabKey = 'chats' | 'contacts' | 'websites' | 'settings' | 'profile';
const SVG: Record<TabKey, string> = {
  chats: '<path d="M12 3.5c-4.97 0-9 3.47-9 7.75 0 2.3 1.17 4.37 3.03 5.79-.13 1.2-.6 2.43-1.53 3.46 1.98-.05 3.66-.8 4.86-1.67.84.2 1.7.3 2.64.3 4.97 0 9-3.47 9-7.88S16.97 3.5 12 3.5z"/>',
  contacts: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20c.6-3.6 3.7-6 7.5-6s6.9 2.4 7.5 6"/>',
  websites: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5M12 3.5C9.6 5.9 8.4 8.7 8.4 12s1.2 6.1 3.6 8.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8l2 .4.6 2.3 1.6.9 2.2-.8 1.4 1.5-.8 2.2.9 1.6 2.3.6.4 2-.4 2-2.3.6-.9 1.6.8 2.2-1.4 1.5-2.2-.8-1.6.9-.6 2.3-2 .4-2-.4-.6-2.3-1.6-.9-2.2.8-1.4-1.5.8-2.2-.9-1.6-2.3-.6-.4-2 .4-2 2.3-.6.9-1.6-.8-2.2 1.4-1.5 2.2.8 1.6-.9.6-2.3z"/>',
  profile: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3.2"/><path d="M6.2 18.4c1.2-2.2 3.3-3.4 5.8-3.4s4.6 1.2 5.8 3.4"/>'
};
const LABEL: Record<TabKey, string> = {chats: 'Chats', contacts: 'Contacts', websites: 'Websites', settings: 'Settings', profile: 'Profile'};

export function installPriveUI(sidebar: AppSidebarLeft) {
  // sign in to Prive with this Telegram account automatically (verified by Telegram via the Prive bot)
  setTimeout(() => import('@/prive/tglink').then((m) => m.priveAutoLink()), 1500);
  document.body.classList.add('prive-ui');
  loadPrivePrefs();
  import('@/prive/translate').then((m) => {
    m.syncPriveTranslation();
    let last = localStorage.getItem('prive_token');
    const resync = () => {
      const now = localStorage.getItem('prive_token');
      if(now !== last) { last = now; m.syncPriveTranslation(); }
    };
    window.addEventListener('storage', resync);
    window.addEventListener('prive-prefs', resync);
  });

  // ---------- floating glass tab bar (mobile) ----------
  const bar = document.createElement('nav');
  bar.className = 'prive-tabbar';
  bar.setAttribute('aria-label', 'Prive');
  let active: TabKey = 'chats';
  const buttons = {} as Record<TabKey, HTMLButtonElement>;
  (Object.keys(LABEL) as TabKey[]).forEach((key) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'prive-tabbar-item';
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${SVG[key]}</svg><span>${LABEL[key]}</span>`;
    b.addEventListener('click', () => select(key));
    buttons[key] = b;
    bar.append(b);
  });
  document.body.append(bar);

  const setActive = (key: TabKey) => {
    active = key;
    (Object.keys(buttons) as TabKey[]).forEach((k) => buttons[k].classList.toggle('active', k === key));
  };
  setActive('chats');

  async function select(key: TabKey) {
    if(key === active && key !== 'chats') return;
    sidebar.closeEverythingInside();
    setActive(key);
    if(key === 'contacts') sidebar.createTab(AppContactsTab).open();
    else if(key === 'websites') sidebar.createTab(PriveWebsitesTab).open();
    else if(key === 'settings') sidebar.createTab(AppSettingsTab).open();
    else if(key === 'profile') sidebar.createTab(AppEditProfileTab).open(getEditProfileInitArgs(true));
  }

  // Arrived from a website's Chat on Prive button: open Websites with that Website Connect chat (the embedded
  // /app does wc:open after the verified sign-in, shows the one-time consent and opens the chat).
  const pendingConnect = () => { try { const p = JSON.parse(localStorage.getItem('prive_connect') || 'null'); return p && Date.now() - p.at < 3600e3 ? p : null; } catch(e) { return null; } };
  const checkConnect = () => { if(pendingConnect()) { active = 'chats'; select('websites'); } };
  setTimeout(checkConnect, 800);
  window.addEventListener('prive-connect', checkConnect);
  window.addEventListener('storage', (e: StorageEvent) => { if(e.key === 'prive_connect' && e.newValue) checkConnect(); });

  // Show the bar only on the root screens of the mobile layout (like Telegram: hidden inside a chat or a sub-screen).
  const history = () => ((sidebar as any).historyTabIds as any[]) || [];
  const update = () => {
    const h = history();
    if(!h.length && active !== 'chats') setActive('chats');
    const rootLevel = h.length <= 1;
    const show = mediaSizes.isMobile && document.body.classList.contains('is-left-column-shown') && rootLevel &&
      !document.body.classList.contains('prive-auth') && !document.querySelector('.prive-websites-tab.prive-inner-open.active');
    document.body.classList.toggle('prive-tabbar-shown', show);
  };
  const prev = sidebar.onTabsCountChange;
  sidebar.onTabsCountChange = () => {
    prev?.();
    queueMicrotask(update);
  };
  mediaSizes.addEventListener('changeScreen', update);
  new MutationObserver(update).observe(document.body, {attributes: true, attributeFilter: ['class']});
  window.addEventListener('message', () => setTimeout(update, 0));
  update();

  // ---------- client: website tabs above the chat list (Telegram folder-tab style) ----------
  const strip = document.createElement('div');
  strip.className = 'prive-site-tabs';
  const place = () => {
    if(strip.isConnected) return;
    const header = document.querySelector('#column-left .item-main .sidebar-header');
    header?.insertAdjacentElement('afterend', strip);
  };
  const openSite = (s: PriveSite) => {
    // like a Telegram Mini App: sheet over the client, no browser chrome
    import('@/prive/siteSheet').then((m) => m.openSiteSheet(s));
  };
  createRoot(() => createEffect(() => {
    const p = privePrefs();
    const sites = p.userSites || []; // one Prive for everyone: website tabs whenever the user has saved sites
    place();
    strip.replaceChildren();
    strip.classList.toggle('hide', !sites.length);
    sites.forEach((s) => {
      const b = document.createElement('div');
      b.className = 'prive-site-tab';
      b.title = s.url;
      const letter = () => {
        const i = document.createElement('i');
        i.textContent = (s.name || '?')[0].toUpperCase();
        return i;
      };
      let icon: HTMLElement = letter();
      if(s.icon) {
        const img = document.createElement('img');
        img.src = s.icon;
        img.referrerPolicy = 'no-referrer';
        img.alt = '';
        img.onerror = () => img.replaceWith(letter());
        icon = img;
      }
      const span = document.createElement('span');
      
      span.textContent = s.name;
      b.append(icon, span);
      b.addEventListener('click', () => openSite(s));
      strip.append(b);
    });
  }));
  setTimeout(place, 1000);
}
