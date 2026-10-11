/*
 * Prive: website updates in place of Telegram Stories. A horizontal row of round site avatars above the chat list
 * (gold ring = unseen updates). Tapping opens the full-screen, story-style viewer (served by /app, same session),
 * which marks updates seen on the server, so the rings, the Websites badges and Android agree.
 */
import {openSiteSheet} from '@/prive/siteSheet';

type StorySite = {id: string, name: string, host: string, url: string, icon?: string, unread: number, siteKey?: string, items: any[]};

const token = () => localStorage.getItem('prive_token');
let row: HTMLDivElement, overlay: HTMLDivElement, frame: HTMLIFrameElement, timer: number;

async function load() {
  if(!row) return;
  if(!token()) { row.classList.add('hide'); return; }
  try {
    const r = await fetch('/api/updates/stories', {headers: {Authorization: 'Bearer ' + token()}});
    if(!r.ok) throw 0;
    render((await r.json()).sites || []);
  } catch(e) {}
}

function render(sites: StorySite[]) {
  row.replaceChildren();
  row.classList.toggle('hide', !sites.length);
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
    row.append(b);
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

export function installSiteStories(): HTMLDivElement {
  row = document.createElement('div');
  row.className = 'prive-stories hide';
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
  window.addEventListener('storage', (e) => { if(e.key === 'prive_token') load(); });
  document.addEventListener('visibilitychange', () => { if(!document.hidden) load(); });
  clearInterval(timer); timer = window.setInterval(load, 60e3);
  setTimeout(load, 300);
  return row;
}
