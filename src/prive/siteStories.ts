/*
 * Prive: website updates in place of Telegram Stories. A horizontal row of round site avatars above the chat list
 * (gold ring = unseen updates). Tapping opens the full-screen, story-style viewer (served by /app, same session),
 * which marks updates seen on the server, so the rings, the Websites badges and Android agree.
 */
import {openSiteSheet} from '@/prive/siteSheet';

type StorySite = {id: string, name: string, host: string, url: string, icon?: string, unread: number, siteKey?: string, items: any[]};

const token = () => localStorage.getItem('prive_token');
let row: HTMLDivElement, inner: HTMLDivElement, stack: HTMLButtonElement, hasSites = false, overlay: HTMLDivElement, frame: HTMLIFrameElement, timer: number;

async function load() {
  if(!row) return;
  if(!token()) { row.classList.add('hide'); return; }
  try {
    const r = await fetch('/api/updates/stories', {headers: {Authorization: 'Bearer ' + token()}});
    if(!r.ok) throw 0;
    render((await r.json()).sites || []);
  } catch(e) {}
}

function avatarFor(s: StorySite) {
  const av = document.createElement('span'); av.className = 'prive-story-av';
  const letter = () => { const i = document.createElement('i'); i.textContent = (s.name || '?')[0].toUpperCase(); return i; };
  if(s.icon) {
    const img = document.createElement('img');
    img.alt = ''; img.referrerPolicy = 'no-referrer';
    img.onerror = () => img.replaceWith(letter());
    img.onload = () => { if(img.naturalWidth < 8) img.replaceWith(letter()); };
    img.src = s.icon;
    av.append(img);
  } else av.append(letter());
  return av;
}

function renderStack(sites: StorySite[]) {
  stack.replaceChildren();
  stack.classList.toggle('hide', !sites.length);
  const unseen = sites.filter((s) => s.unread).length;
  stack.setAttribute('aria-label', `Website updates${unseen ? `, ${unseen} new` : ''}. Show`);
  stack.style.setProperty('--w', (sites.length ? 26 + (Math.min(3, sites.length) - 1) * 15 : 0) + 'px');
  for(const s of sites.slice(0, 3)) {
    const r = document.createElement('span');
    r.className = 'prive-stack-ring' + (s.unread ? ' unseen' : '');
    r.append(avatarFor(s));
    stack.append(r);
  }
}

function render(sites: StorySite[]) {
  renderStack(sites);
  inner.replaceChildren();
  row.classList.toggle('hide', !sites.length);
  hasSites = sites.length > 0;
  if(!hasSites) setProgress(0, false);
  for(const s of sites) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'prive-story' + (s.unread ? ' unseen' : '');
    b.setAttribute('aria-label', s.name + (s.unread ? `, ${s.unread} new update${s.unread > 1 ? 's' : ''}` : ''));
    const ring = document.createElement('span'); ring.className = 'prive-story-ring';
    const av = document.createElement('span'); av.className = 'prive-story-av';
    const letter = () => { const i = document.createElement('i'); i.textContent = (s.name || '?')[0].toUpperCase(); return i; };
    if(s.icon) {
      const img = document.createElement('img');
      img.alt = ''; img.referrerPolicy = 'no-referrer';
      img.onerror = () => img.replaceWith(letter());
      img.onload = () => { if(img.naturalWidth < 8) img.replaceWith(letter()); };
      img.src = s.icon;
      av.append(img);
    } else av.append(letter());
    ring.append(av);
    const name = document.createElement('span'); name.className = 'prive-story-name'; name.textContent = s.name;
    b.append(ring, name);
    b.addEventListener('click', () => openViewer(s.id));
    inner.append(b);
  }
}

function closeViewer() {
  if(!overlay) return;
  overlay.classList.remove('show');
  const o = overlay; overlay = frame = undefined;
  setTimeout(() => o.remove(), 220);
  load();
}

export function openViewer(feedId: string) {
  if(overlay) return;
  overlay = document.createElement('div');
  overlay.className = 'prive-stories-overlay';
  frame = document.createElement('iframe');
  frame.src = '/app/?embed=tweb&stories=' + encodeURIComponent(feedId);
  frame.allow = 'clipboard-write';
  frame.title = 'Website updates';
  overlay.append(frame);
  document.body.append(overlay);
  requestAnimationFrame(() => overlay?.classList.add('show'));
}

// ---------- Telegram-Stories-like folding: collapsed = small overlapping avatars in the header,
// pull down at the top of the chat list (or wheel up / tap the stack) = full-size circles with names;
// scrolling the list (or wheel down) folds them again. Collapsed by default. ----------
const FULL = 92; // px: expanded row height (56px ring + name + padding), like Telegram's
let progress = 0, expanded = false;
function setProgress(p: number, animate: boolean) {
  progress = Math.max(0, Math.min(1, p));
  for(const el of [row, stack]) el?.classList.toggle('prive-anim', animate);
  if(row) {
    row.style.height = (progress * FULL).toFixed(1) + 'px';
    row.style.setProperty('--p', progress.toFixed(3));
  }
  if(stack) stack.style.setProperty('--p', progress.toFixed(3));
  document.body.classList.toggle('prive-stories-open', progress > 0.5);
}
function snap(open: boolean) {
  expanded = open && hasSites;
  setProgress(expanded ? 1 : 0, true);
}
export function expandSiteStories(open = true) { snap(open); }

function scrollTopOf(t: EventTarget) {
  const sc = (t as HTMLElement)?.closest?.('.scrollable') as HTMLElement;
  return sc ? sc.scrollTop : 0;
}
function bindGestures() {
  const list = document.getElementById('folders-container');
  if(!list) { setTimeout(bindGestures, 600); return; }
  // touch: pull down at the top expands following the finger, release snaps
  let y0 = 0, x0 = 0, pulling = false, base = 0;
  list.addEventListener('touchstart', (e) => {
    if(!hasSites) return;
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; base = progress;
    pulling = scrollTopOf(e.target) <= 0;
  }, {passive: true});
  list.addEventListener('touchmove', (e) => {
    if(!pulling) return;
    const dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
    if(Math.abs(dx) > Math.abs(dy)) return;
    if(dy > 0 && !expanded) setProgress(base + dy / (FULL * 1.4), false);
    else if(dy < 0 && expanded) setProgress(1 + dy / FULL, false);
  }, {passive: true});
  list.addEventListener('touchend', () => {
    if(!pulling) return; pulling = false;
    if(!expanded) snap(progress > 0.35); else snap(progress > 0.65);
  }, {passive: true});
  // desktop: wheel up at the top expands, wheel down while open folds first
  let acc = 0, accTimer = 0;
  list.addEventListener('wheel', (e) => {
    if(!hasSites) return;
    const top = scrollTopOf(e.target) <= 0;
    if(e.deltaY < 0 && top && !expanded) {
      acc += -e.deltaY; clearTimeout(accTimer); accTimer = window.setTimeout(() => acc = 0, 250);
      if(acc > 40) { acc = 0; snap(true); }
    } else if(e.deltaY > 0 && expanded) {
      e.preventDefault(); snap(false);
    }
  }, {passive: false});
  // scrolling the list down folds the row (like Telegram)
  list.addEventListener('scroll', (e) => { if(expanded && scrollTopOf(e.target) > 8) snap(false); }, {capture: true, passive: true});
}

export function installSiteStories(): HTMLDivElement {
  stack = document.createElement('button');
  stack.type = 'button';
  stack.className = 'prive-stories-stack hide';
  // keep the header's search from grabbing focus (it would hide the stack before the click lands)
  for(const ev of ['pointerdown', 'mousedown', 'touchstart']) stack.addEventListener(ev, (e) => { e.stopPropagation(); if(ev !== 'touchstart') e.preventDefault(); }, {passive: false});
  stack.addEventListener('click', (e) => { e.stopPropagation(); snap(!expanded); });
  const placeStack = () => {
    const header = document.querySelector('#column-left .item-main .sidebar-header');
    if(header && !stack.isConnected) header.append(stack);
    else if(!header) setTimeout(placeStack, 600);
  };
  placeStack();
  setTimeout(bindGestures, 800);
  row = document.createElement('div');
  row.className = 'prive-stories hide';
  inner = document.createElement('div');
  inner.className = 'prive-stories-inner';
  row.append(inner);
  setProgress(0, false);
  row.setAttribute('role', 'list');
  row.setAttribute('aria-label', 'Website updates');
  window.addEventListener('message', (e) => {
    if(e.origin === location.origin && e.data && e.data.prive === 'prefs') setTimeout(load, 300);
    if(e.origin !== location.origin || !frame || e.source !== frame.contentWindow || !e.data || !e.data.prive) return;
    const d = e.data;
    if(d.prive === 'stories-close') closeViewer();
    else if(d.prive === 'connect' && d.site) {
      closeViewer();
      localStorage.setItem('prive_connect', JSON.stringify({site: d.site, listing: null, at: Date.now()}));
      window.dispatchEvent(new CustomEvent('prive-connect'));
    } else if(d.prive === 'site' && d.site) openSiteSheet(d.site);
  });
  window.addEventListener('prive-prefs', load);
  window.addEventListener('prive-stories-reload', load);
  window.addEventListener('storage', (e) => { if(e.key === 'prive_token') load(); });
  document.addEventListener('visibilitychange', () => { if(!document.hidden) load(); });
  clearInterval(timer); timer = window.setInterval(load, 60e3);
  setTimeout(load, 300);
  return row;
}
