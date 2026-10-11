/*
 * Prive Web: the Websites tab, Telegram-settings style, exactly two sections.
 *  1. "Websites you follow": icon, name, domain, unread updates badge. Tap = the site full-screen as a mini app
 *     (siteSheet). Long-press / right-click (or Edit) = mute updates or unfollow. "N of 4" counter and "Add website"
 *     (at the limit it explains and offers to remove one).
 *  2. "Connect your website": sites the user owns or moderates (tap = that site's setup/admin screen), then the
 *     "Connect your website" button. Both go through openWebsiteSetup(), the stable entry point that the automatic
 *     setup (autosite-ui.js: PriveAutoSetup.openConnect / openSite(key)) runs behind, in the Prive server frame.
 * Website Connect chats stay one tap away (header button) in the same frame.
 */
import {createSignal, For, Show, onMount} from 'solid-js';
import {render} from 'solid-js/web';
import {SliderSuperTab} from '@components/slider';
import Row from '@components/rowTsx';
import Section from '@components/section';
import {toast} from '@components/toast';
import ButtonIcon from '@components/buttonIcon';
import appSidebarLeft from '@components/sidebarLeft';
import {priveToken, loadPrivePrefs} from '@/prive/api';
import {openSiteSheet} from '@/prive/siteSheet';
import {PriveWebsiteFrameTab} from '@/prive/tabs';

type Followed = {feedId: string, siteId: string | null, name: string, host: string, url: string, icon: string | null, frameable: boolean | null, unread: number, muted: boolean};
type Owned = {id: string, key: string, name: string, domain: string, role: string, verified: boolean};
type Data = {limit: number, count: number, followed: Followed[], owned: Owned[]};

const api = async(path: string, body?: any) => {
  const r = await fetch(path, {method: body ? 'POST' : 'GET', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + priveToken()}, body: body ? JSON.stringify(body) : undefined});
  return {status: r.status, j: await r.json().catch((): any => ({}))};
};

/** Stable entry point: "Connect your website" (no key) or the setup/admin screen of an owned site (key). */
export function openWebsiteSetup(siteKey?: string) {
  appSidebarLeft.createTab(PriveWebsiteFrameTab).open(undefined, undefined, {as: siteKey || 'connect', title: siteKey ? 'Website' : 'Connect your website'});
}
/** advertiser invite link: the one-time consent screen (autosite-ui.js) */
export function openAdvertiserInvite(claim: string) {
  appSidebarLeft.createTab(PriveWebsiteFrameTab).open(undefined, undefined, {as: 'offer', claim, title: 'Advertiser invite'});
}
/** Identity Sync creator offer (one tap): open the same consent screen when the server has one for this account */
export async function checkCreatorOffers() {
  try {
    const r = await api('/api/identity/offers');
    if(r.status === 200 && r.j?.offers?.length) appSidebarLeft.createTab(PriveWebsiteFrameTab).open(undefined, undefined, {as: 'offer', title: 'Advertiser invite'});
  } catch(e) {}
}
export function openWebsiteChats(openConv?: string) {
  appSidebarLeft.createTab(PriveWebsiteFrameTab).open(undefined, openConv, {title: 'Website chats'});
}

/** long-press (touch, 500 ms) or right-click -> cb; the click that ends a long-press is swallowed */
let holdFired = false;
function bindHold(el: HTMLElement, cb: () => void, tap: () => void) {
  // our own tap handler: tweb's Row drops a click whose target changed since mousedown (its ripple), which happens on rows re-rendered under the pointer
  el.addEventListener('click', (e) => { if((e.target as HTMLElement).closest('.prive-ws-more')) return; if(holdFired) { holdFired = false; return; } tap(); });
  let t = 0, x = 0, y = 0;
  const clear = () => { if(t) clearTimeout(t); t = 0; };
  el.addEventListener('touchstart', (e) => { const p = e.touches[0]; x = p.clientX; y = p.clientY; clear(); t = window.setTimeout(() => { t = 0; holdFired = true; setTimeout(() => holdFired = false, 700); try { navigator.vibrate?.(10); } catch(_) {} cb(); }, 500); }, {passive: true});
  el.addEventListener('touchmove', (e) => { const p = e.touches[0]; if(Math.abs(p.clientX - x) > 10 || Math.abs(p.clientY - y) > 10) clear(); }, {passive: true});
  el.addEventListener('touchend', clear); el.addEventListener('touchcancel', clear);
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); if(holdFired) return; cb(); });
  el.style.setProperty('-webkit-touch-callout', 'none'); el.style.userSelect = 'none';
}

/** a small Noir bottom sheet (Telegram action-sheet style) */
function sheet(build: (body: HTMLElement, close: () => void) => void) {
  const el = document.createElement('div'); el.className = 'prive-asheet';
  const body = document.createElement('div'); body.className = 'prive-asheet-in'; el.append(body);
  const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 220); };
  el.addEventListener('click', (e) => { if(e.target === el) close(); });
  build(body, close);
  document.body.append(el); requestAnimationFrame(() => el.classList.add('show'));
  return close;
}
const btn = (label: string, cls: string, onClick: () => void) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'prive-asheet-btn ' + cls; b.textContent = label; b.onclick = onClick; return b; };

function Favicon(props: {name: string, icon: string | null, url: string}) {
  const [ok, setOk] = createSignal(false);
  const src = () => props.icon || (() => { try { return new URL('/favicon.ico', props.url).href; } catch(e) { return ''; } })();
  return (
    <span class="prive-ws-fav" classList={{'has-img': ok()}}>
      {(props.name[0] || '?').toUpperCase()}
      <Show when={src()}><img alt="" referrerPolicy="no-referrer" src={src()} onLoad={(e) => setOk((e.currentTarget as HTMLImageElement).naturalWidth > 2)} onError={() => setOk(false)} /></Show>
    </span>
  );
}

export class PriveWebsitesTab extends SliderSuperTab {
  public static noSame = true;
  private dispose: VoidFunction;

  public init(section?: string, openConv?: string) {
    this.container.classList.add('prive-websites-native');
    this.title.replaceChildren(document.createTextNode('Websites'));
    const [data, setData] = createSignal<Data>(null);
    const [edit, setEdit] = createSignal(false);
    const [busy, setBusy] = createSignal(false);
    const load = async() => { const r = await api('/api/websites'); if(r.status === 200) setData(r.j); return r; };

    // header: Website chats + Edit
    const chatsBtn = ButtonIcon('comments', {ariaLabel: 'Website chats' as any});
    chatsBtn.classList.add('prive-ws-chats-btn');
    chatsBtn.addEventListener('click', () => openWebsiteChats());
    const editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.className = 'prive-ws-edit'; editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => { setEdit(!edit()); editBtn.textContent = edit() ? 'Done' : 'Edit'; });
    this.header.append(chatsBtn, editBtn);

    const unfollow = async(f: Followed) => {
      const r = await api('/api/updates/feed/' + encodeURIComponent(f.feedId) + '/follow', {follow: false});
      if(r.status === 200) { toast('Unfollowed ' + f.name); await load(); loadPrivePrefs(true); document.dispatchEvent(new CustomEvent('prive-stories-reload')); }
      else toast(r.j.error || 'Could not unfollow');
    };
    const setMuted = async(f: Followed, muted: boolean) => {
      const r = await api('/api/updates/feed/' + encodeURIComponent(f.feedId) + '/follow', {muted});
      if(r.status === 200) { toast(muted ? 'Updates muted' : 'Updates unmuted'); load(); } else toast(r.j.error || 'Could not change that');
    };
    const actions = (f: Followed) => sheet((b, close) => {
      const h = document.createElement('div'); h.className = 'prive-asheet-title'; h.textContent = f.name; b.append(h);
      b.append(btn(f.muted ? 'Unmute updates' : 'Mute updates', '', () => { close(); setMuted(f, !f.muted); }));
      b.append(btn('Unfollow', 'danger', () => { close(); unfollow(f); }));
      b.append(btn('Cancel', 'cancel', close));
    });
    const limitSheet = (d: Data) => sheet((b, close) => {
      const h = document.createElement('div'); h.className = 'prive-asheet-title'; h.textContent = `You follow ${d.limit} of ${d.limit} websites`;
      const p = document.createElement('p'); p.className = 'prive-asheet-text'; p.textContent = `Prive follows up to ${d.limit} websites. Remove one to add another.`;
      b.append(h, p);
      for(const f of d.followed) b.append(btn('Remove ' + f.name, 'danger', () => { close(); unfollow(f).then(() => addSheet()); }));
      b.append(btn('Cancel', 'cancel', close));
    });
    const addSheet = () => {
      const d = data(); if(d && d.count >= d.limit) return limitSheet(d);
      sheet((b, close) => {
        const h = document.createElement('div'); h.className = 'prive-asheet-title'; h.textContent = 'Add website';
        const inp = document.createElement('input'); inp.className = 'prive-asheet-input'; inp.type = 'url'; inp.placeholder = 'example.com'; inp.autocapitalize = 'off'; inp.spellcheck = false;
        const err = document.createElement('p'); err.className = 'prive-asheet-err';
        const go = btn('Add', 'primary', async() => {
          if(busy()) return; setBusy(true); go.textContent = 'Adding…'; err.textContent = '';
          const r = await api('/api/websites/add', {url: inp.value});
          setBusy(false); go.textContent = 'Add';
          if(r.status === 200) { close(); setData(r.j); loadPrivePrefs(true); document.dispatchEvent(new CustomEvent('prive-stories-reload')); toast(r.j.already ? 'Already following' : 'Following ' + (r.j.site?.name || 'website')); return; }
          if(r.status === 409) { close(); load().then(() => limitSheet({...data(), ...r.j, count: r.j.limit})); return; }
          err.textContent = r.j.error || 'Could not add that website';
        });
        inp.addEventListener('keydown', (e) => { if(e.key === 'Enter') go.click(); });
        b.append(h, inp, err, go, btn('Cancel', 'cancel', close));
        setTimeout(() => inp.focus(), 250);
      });
    };
    const open = (f: Followed) => openSiteSheet({id: f.siteId || 'feed_' + f.feedId, url: f.url, name: f.name, icon: f.icon || undefined, frameable: f.frameable ?? undefined} as any);

    this.dispose = render(() => {
      onMount(load);
      return (
        <div class="prive-ws">
          <Section
            name={<span>Websites you follow</span>}
            nameRight={<Show when={data()}><span class="prive-ws-count">{data().count} of {data().limit}</span></Show>}
            caption={<span>Tap a website to open it in Prive. Hold it to mute its updates or unfollow.</span>}
          >
            <Show when={data()} fallback={<div class="prive-ws-loading">Loading…</div>}>
              <For each={data().followed}>{(f) => (
                <Row
                  clickable={() => {}}
                  ref={(el: HTMLElement) => bindHold(el, () => actions(f), () => edit() ? actions(f) : open(f))}
                >
                  <Row.Media size="abitbigger"><Favicon name={f.name} icon={f.icon} url={f.url} /></Row.Media>
                  <Row.Title titleRight={
                    edit() ? <button type="button" class="prive-ws-more" aria-label={'Options for ' + f.name} onClick={(e) => { e.stopPropagation(); actions(f); }}>•••</button> :
                    f.unread > 0 && !f.muted ? <span class="prive-ws-badge">{f.unread}</span> : (f.muted ? <span class="prive-ws-muted">Muted</span> : undefined)
                  }>{f.name}</Row.Title>
                  <Row.Subtitle>{f.host}</Row.Subtitle>
                </Row>
              )}</For>
              <Row clickable={addSheet} class="prive-ws-add">
                <Row.Icon icon="add" />
                <Row.Title>{data().count >= data().limit ? `Add website (${data().limit} of ${data().limit})` : 'Add website'}</Row.Title>
              </Row>
            </Show>
          </Section>
          <Section
            name={<span>Connect your website</span>}
            caption={<span>Let visitors of your website chat with you on Prive without sharing contact details.</span>}
          >
            <Show when={data()}>
              <For each={data().owned}>{(s) => (
                <Row clickable={() => openWebsiteSetup(s.key)}>
                  <Row.Media size="abitbigger"><Favicon name={s.name} icon={null} url={'https://' + (s.domain || 'invalid') + '/'} /></Row.Media>
                  <Row.Title titleRight={<span class="prive-ws-role">{s.role}</span>}>{s.name}</Row.Title>
                  <Row.Subtitle>{s.domain}</Row.Subtitle>
                </Row>
              )}</For>
            </Show>
            <Row clickable={() => openWebsiteSetup()} class="prive-ws-connect">
              <Row.Icon icon="link" />
              <Row.Title>Connect your website</Row.Title>
            </Row>
          </Section>
        </div>
      );
    }, this.scrollable.container);

    // a Website Connect chat to open (notification / Chat on Prive link): straight into the chats frame
    let pc: any = null; try { pc = JSON.parse(localStorage.getItem('prive_connect') || 'null'); } catch(e) {}
    if(openConv || section || (pc && Date.now() - pc.at < 3600e3)) setTimeout(() => appSidebarLeft.createTab(PriveWebsiteFrameTab).open(section, openConv, {title: 'Website chats'}), 0);
    document.addEventListener('prive-unlocked', load);
    this.middlewareHelper.get().onDestroy(() => { document.removeEventListener('prive-unlocked', load); this.dispose?.(); });
  }
}
