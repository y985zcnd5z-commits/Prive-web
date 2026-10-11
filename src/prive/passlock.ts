/*
 * Prive password: MANDATORY, Telegram-passcode-style app lock.
 *  - After the first login the user must create one (no skip).
 *  - Asked every time Prive is opened or reloaded, and when it comes back after more than ~1 minute in the background.
 *  - Settings can change it, never turn it off.
 * Verified on the Prive server (scrypt, per-user attempt limits / lockouts); "Forgot password?" re-verifies the
 * Telegram account through @Prive2026Bot, which clears it, and the user creates a new one right away.
 */
import {verifyTelegramFor} from '@/prive/tglink';
import {bioAvailable, bioOn, bioUnlock, bioRegister, bioRemove, bioSync, bioForget, bioLabel, bioAction} from '@/prive/faceid';

const ON_KEY = 'prive_pass_on';

// Unlock token from the last password/passkey unlock: memory only (a reload = locked). The Prive server refuses this
// session's logged-in requests without it (423). Same-origin Prive frames (Websites tab) read it via window.__priveUnlock.
let UT: string | null = null;
(window as any).__priveUnlock = () => UT;
const setUT = (j: any) => { if(j && j.unlock) UT = j.unlock; };
{
  const realFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let url: URL;
    try { url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, location.href); } catch(e) { return realFetch(input, init); }
    if(url.origin !== location.origin || !url.pathname.startsWith('/api/')) return realFetch(input, init);
    if(UT && (typeof input === 'string' || input instanceof URL)) {
      const h = new Headers(init?.headers || {}); h.set('X-Prive-Unlock', UT); init = {...init, headers: h};
    }
    return realFetch(input, init).then((r) => {
      if(r.status === 423 && !url.pathname.startsWith('/api/prive-pass') && !locked) lockNow(true);
      return r;
    });
  };
}
const tok = () => localStorage.getItem('prive_token');
const api = (path: string, body?: any) => fetch('/api/prive-pass' + path, {
  method: body ? 'POST' : 'GET',
  headers: {'Content-Type': 'application/json', ...(tok() ? {Authorization: 'Bearer ' + tok()} : {})},
  body: body ? JSON.stringify(body) : undefined
}).then(async(r) => ({status: r.status, j: await r.json().catch((): any => ({}))}));

export function passCachedOn() { return localStorage.getItem(ON_KEY) === '1'; }
export async function passEnabled(): Promise<boolean> {
  if(!tok()) return passCachedOn();
  try {
    const r = await api('');
    if(r.status === 200) { localStorage.setItem(ON_KEY, r.j.enabled ? '1' : '0'); return !!r.j.enabled; }
  } catch(e) {}
  return passCachedOn();
}

const FACE_SVG = '<svg viewBox="0 0 32 32" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 10V7a3 3 0 0 1 3-3h3M22 4h3a3 3 0 0 1 3 3v3M28 22v3a3 3 0 0 1-3 3h-3M10 28H7a3 3 0 0 1-3-3v-3"/><path d="M11 12v2M21 12v2M16 12v6h-1.5M12 21.5a6 6 0 0 0 8 0"/></svg>';
const LOCK_SVG = '<svg viewBox="0 0 24 24" width="30" height="30"><rect x="5" y="10.5" width="14" height="10" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

type Field = {label: string, key: string};
/** One full-screen Noir passcode screen. resolve(values) on submit (submit may reject with a message to shake). */
function screen(opts: {title: string, sub?: string, fields: Field[], button: string, cancel?: string | false, forgot?: boolean, instant?: boolean,
  submit: (v: Record<string, string>) => Promise<string | true>, onForgot?: () => void,
  bio?: {label: string, auto: boolean, run: () => Promise<{ok: true, j: any} | {ok: false, why: string}>}}): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'prive-lock';
    el.innerHTML = `<div class="prive-lock-in"><div class="prive-lock-icon">${LOCK_SVG}</div><h2></h2><p class="prive-lock-sub"></p>
      <button type="button" class="prive-lock-bio" hidden><span class="prive-lock-bio-ico">${FACE_SVG}</span><span class="prive-lock-bio-t"></span></button>
      <form autocomplete="off"></form><p class="prive-lock-err" role="alert"></p>
      <button type="button" class="prive-lock-forgot">Forgot password?</button></div>
      <button type="button" class="prive-lock-cancel"></button>`;
    el.querySelector('h2').textContent = opts.title;
    el.querySelector('.prive-lock-sub').textContent = opts.sub || '';
    const form = el.querySelector('form');
    const inputs: HTMLInputElement[] = [];
    for(const f of opts.fields) {
      const i = document.createElement('input');
      i.type = 'password'; i.placeholder = f.label; i.dataset.k = f.key; i.autocomplete = 'off';
      i.setAttribute('aria-label', f.label); i.maxLength = 128;
      form.append(i); inputs.push(i);
    }
    const btn = document.createElement('button'); btn.type = 'submit'; btn.className = 'prive-lock-btn'; btn.textContent = opts.button;
    form.append(btn);
    const err = el.querySelector('.prive-lock-err') as HTMLElement;
    const forgot = el.querySelector('.prive-lock-forgot') as HTMLButtonElement;
    forgot.hidden = !opts.forgot;
    const cancel = el.querySelector('.prive-lock-cancel') as HTMLButtonElement;
    cancel.textContent = opts.cancel || 'Cancel';
    if(opts.cancel === false) cancel.remove();
    if(opts.instant) el.classList.add('show', 'instant');
    const done = (v: boolean) => { el.classList.remove('show'); setTimeout(() => el.remove(), 200); resolve(v); };
    cancel.addEventListener('click', () => done(false));
    const shake = (msg: string) => {
      err.textContent = msg;
      const box = el.querySelector('.prive-lock-in');
      box.classList.remove('shake'); void (box as HTMLElement).offsetWidth; box.classList.add('shake');
      navigator.vibrate?.(60);
      inputs[0].select?.();
    };
    form.addEventListener('submit', async(e) => {
      e.preventDefault();
      const v: Record<string, string> = {};
      inputs.forEach((i) => v[i.dataset.k] = i.value);
      btn.disabled = true;
      try {
        const r = await opts.submit(v);
        if(r === true) done(true); else shake(r);
      } catch(e) { shake('Something went wrong. Try again.'); }
      btn.disabled = false;
    });
    forgot.addEventListener('click', async() => {
      forgot.disabled = true; err.textContent = 'Verifying your Telegram account…';
      const ok = await forgotPassword();
      forgot.disabled = false;
      if(ok) { err.textContent = ''; if(opts.onForgot) { el.remove(); opts.onForgot(); return; } done(true); } else err.textContent = 'Could not verify your Telegram account. Try again in a minute.';
    });
    // Face ID: asked automatically when the lock opens; if the browser wants a tap first (iOS Home Screen app) or it
    // was cancelled, the big button stays; the password is always there below it
    const bioBtn = el.querySelector('.prive-lock-bio') as HTMLButtonElement;
    let bioBusy = false;
    const runBio = async() => {
      if(bioBusy || !opts.bio) return; bioBusy = true; bioBtn.disabled = true; err.textContent = '';
      try {
        const r = await opts.bio.run();
        if(r.ok === true) { done(true); return; }
        const why = (r as {why: string}).why;
        if(why === 'gone') { bioBtn.hidden = true; el.classList.remove('has-bio'); inputs[0].focus(); }
        else if(why !== 'blocked' && why !== 'cancelled') err.textContent = why;
      } catch(e) {} finally { bioBusy = false; bioBtn.disabled = false; }
    };
    if(opts.bio) {
      bioBtn.hidden = false; el.classList.add('has-bio');
      (el.querySelector('.prive-lock-bio-t') as HTMLElement).textContent = opts.bio.label;
      bioBtn.addEventListener('click', runBio);
    }
    document.body.append(el);
    requestAnimationFrame(() => {
      el.classList.add('show');
      if(opts.bio?.auto) runBio(); else inputs[0].focus();
    });
  });
}

const why = (r: {status: number, j: any}) =>
  r.j.error === 'locked' ? `Too many attempts. Try again in ${r.j.retryAfter > 90 ? Math.ceil(r.j.retryAfter / 60) + ' min' : r.j.retryAfter + ' s'}.` :
  r.j.error === 'wrong' ? (r.j.triesLeft != null && r.j.triesLeft <= 2 ? `Wrong password. ${r.j.triesLeft} attempt${r.j.triesLeft === 1 ? '' : 's'} left.` : 'Wrong password') :
  r.j.error || 'Something went wrong';

/** Forgot: prove it's still the same Telegram account (Prive bot), which clears the password. */
export async function forgotPassword(): Promise<boolean> {
  const r = await verifyTelegramFor('pass-reset').catch((): any => null);
  if(r && r.reset) { localStorage.setItem(ON_KEY, '0'); bioForget(); localStorage.removeItem('prive_bio_offered'); return true; } // the reset also removed the passkeys
  return false;
}

const MIN = 4;
const newPw = (v: Record<string, string>) => (v.a || '').length < MIN ? `Use at least ${MIN} characters` : v.a !== v.b ? "Passwords don't match" : '';

/** First login (or after "Forgot password?"): create the Prive password. No way to skip. */
function setupScreen(instant = true, afterReset = false): Promise<boolean> {
  return screen({
    title: 'Create your Prive password', instant, cancel: false,
    sub: afterReset ? 'Your Telegram account is verified. Choose a new Prive password.' : 'Prive asks for it every time you open the app, on all your devices.',
    fields: [{label: 'New password', key: 'a'}, {label: 'Repeat password', key: 'b'}], button: 'Create password',
    submit: async(v) => {
      const e = newPw(v); if(e) return e;
      const r = await api('/set', {password: v.a});
      if(r.status === 200) { localStorage.setItem(ON_KEY, '1'); setUT(r.j); return true; }
      return why(r);
    }
  });
}
/** The lock screen (every open / after the background timeout). Resolves when unlocked. */
function unlockScreen(instant = true, bio = false): Promise<boolean> {
  return new Promise((resolve) => {
    screen({
      bio: bio ? {label: bioAction(), auto: true, run: async() => { const r = await bioUnlock(api); if(r.ok === true) setUT(r.j); return r; }} : undefined,
      title: 'Enter your Prive password', sub: 'Prive is locked.', instant, cancel: false,
      fields: [{label: 'Password', key: 'p'}], button: 'Unlock', forgot: true,
      submit: async(v) => {
        if(!v.p) return 'Enter your password';
        const r = await api('/verify', {password: v.p});
        if(r.status === 200) setUT(r.j);
        return r.status === 200 ? true : why(r);
      },
      onForgot: () => setupScreen(true, true).then(async(v) => { await offerBio(); resolve(v); }) // reset by Telegram re-verification -> new password now (+ Face ID again)
    }).then(resolve);
  });
}

/** Kept for callers (Chat on Prive etc.): the app is always unlocked once it's usable. */
export async function requireUnlock(_reason?: string): Promise<boolean> { await whenUnlocked(); return true; }

let locked = false, waiters: Array<() => void> = [], unlockedOnce = false, afterUnlock: Array<() => void> = [];
/** run fn once Prive has been unlocked in this page (now, if it already was): deep links that must not open behind the lock */
export function onceUnlocked(fn: () => void) { if(unlockedOnce && !locked) fn(); else afterUnlock.push(fn); }
const whenUnlocked = () => locked ? new Promise<void>((r) => waiters.push(r)) : Promise.resolve();
function setLocked(v: boolean) {
  const was = locked;
  locked = v;
  document.documentElement.classList.toggle('prive-locked', v);
  if(v && UT) { // tell the server too, so this session's API/socket access stops now (not at the TTL)
    const t = UT; UT = null;
    try { fetch('/api/prive-pass/lock', {method: 'POST', keepalive: true, headers: {'Authorization': 'Bearer ' + tok(), 'X-Prive-Unlock': t}}); } catch(e) {}
  }
  if(!v) {
    const w = waiters; waiters = []; w.forEach((f) => f());
    if(was) { // data refused while locked: load it now, and let embedded Prive views reconnect
      import('@/prive/api').then((m) => m.loadPrivePrefs(true)).catch(() => {});
      document.dispatchEvent(new CustomEvent('prive-stories-reload'));
      document.dispatchEvent(new CustomEvent('prive-unlocked'));
      unlockedOnce = true; const a = afterUnlock; afterUnlock = []; a.forEach((f) => { try { f(); } catch(e) {} });
      document.querySelectorAll<HTMLIFrameElement>('iframe[src^="/app/"]').forEach((f) => f.contentWindow?.postMessage({prive: 'unlocked'}, location.origin));
    }
  }
}

/** Blocking "connecting" cover while the Prive account is linked to this Telegram account (first login). */
function waitForToken(): Promise<void> {
  if(tok()) return Promise.resolve();
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'prive-lock show instant prive-lock-wait';
    el.innerHTML = `<div class="prive-lock-in"><div class="prive-lock-icon">${LOCK_SVG}</div><h2>Connecting to Prive…</h2><p class="prive-lock-sub">Verifying your Telegram account with the Prive bot. This takes a few seconds.</p><p class="prive-lock-err" role="alert"></p><button type="button" class="prive-lock-btn" hidden>Try again</button></div>`;
    document.body.append(el);
    const retry = el.querySelector('.prive-lock-btn') as HTMLButtonElement;
    const kick = () => import('@/prive/tglink').then((m) => m.priveAutoLink()).catch(() => {});
    retry.addEventListener('click', () => { retry.hidden = true; (el.querySelector('.prive-lock-err') as HTMLElement).textContent = ''; kick(); later(); });
    let t: number;
    const later = () => { clearTimeout(t); t = window.setTimeout(() => { if(!tok()) { retry.hidden = false; (el.querySelector('.prive-lock-err') as HTMLElement).textContent = 'Still connecting. Check your connection and try again.'; } }, 25e3); };
    later();
    const iv = window.setInterval(() => { if(tok()) { clearInterval(iv); clearTimeout(t); el.remove(); resolve(); } }, 400);
  });
}

let busy = false;
async function lockNow(instant: boolean) {
  if(busy) return;
  busy = true; setLocked(true);
  try {
    await waitForToken();
    let st: {status: number, j: any}, cov: HTMLElement;
    for(let i = 0; ; i++) { // need the server's answer (enabled?) — keep retrying while offline, behind a cover
      st = await api('').catch((): any => ({status: 0, j: {}}));
      if(st.status === 200 || st.status === 401) break;
      if(!cov) {
        cov = document.createElement('div'); cov.className = 'prive-lock show instant prive-lock-wait';
        cov.innerHTML = `<div class="prive-lock-in"><div class="prive-lock-icon">${LOCK_SVG}</div><h2>Prive is locked</h2><p class="prive-lock-sub">Can't reach Prive right now. Retrying…</p></div>`;
        document.body.append(cov);
      }
      await new Promise((r) => setTimeout(r, Math.min(8000, 1000 * (i + 1))));
    }
    cov?.remove();
    if(st.status === 401) { // Prive session no longer valid: link this Telegram account again, then lock as usual
      localStorage.removeItem('prive_token');
      import('@/prive/tglink').then((m) => m.priveAutoLink()).catch(() => {});
      busy = false; return lockNow(instant);
    }
    localStorage.setItem(ON_KEY, st.j.enabled ? '1' : '0');
    bioSync(st.j.passkeys);
    if(st.j.enabled) await unlockScreen(instant, bioOn() && await bioAvailable());
    else { await setupScreen(instant); await offerBio(); }
  } finally { busy = false; }
  setLocked(false);
}

const BG_LOCK_MS = 60e3;
/** Called once when the signed-in app starts (prive/ui.ts). */
export function installAppLock() {
  lockNow(true);
  // keep the server-side unlock alive while Prive is in the foreground (it expires a few minutes after the app goes away)
  setInterval(() => {
    if(locked || !UT || document.hidden) return;
    api('/renew', {}).then((r) => { if(r.status === 423 && !locked) lockNow(true); }).catch(() => {});
  }, 60e3);
  // an embedded Prive view (Websites tab) was refused as locked
  window.addEventListener('message', (e) => { if(e.origin === location.origin && e.data && e.data.prive === 'locked' && !locked) lockNow(true); });
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if(document.hidden) { hiddenAt = Date.now(); return; }
    if(hiddenAt && Date.now() - hiddenAt > BG_LOCK_MS && !locked) lockNow(true);
    hiddenAt = 0;
  });
  // iOS Home Screen apps can be frozen without visibilitychange: pagehide/pageshow carry the same signal
  window.addEventListener('pagehide', () => { hiddenAt = hiddenAt || Date.now(); });
  window.addEventListener('pageshow', (e) => { if((e as PageTransitionEvent).persisted && hiddenAt && Date.now() - hiddenAt > BG_LOCK_MS && !locked) lockNow(true); hiddenAt = 0; });
}

/** right after the password is created: offer Face ID on this device (once; Settings can turn it on later) */
async function offerBio() {
  if(bioOn() || !(await bioAvailable()) || localStorage.getItem('prive_bio_offered')) return;
  localStorage.setItem('prive_bio_offered', '1');
  await new Promise<void>((resolve) => {
    const el = document.createElement('div');
    el.className = 'prive-lock prive-lock-offer';
    el.innerHTML = `<div class="prive-lock-in"><div class="prive-lock-icon">${FACE_SVG}</div><h2></h2><p class="prive-lock-sub"></p><p class="prive-lock-err" role="alert"></p>
      <button type="button" class="prive-lock-btn"></button><button type="button" class="prive-lock-forgot prive-lock-later">Not now</button></div>`;
    el.querySelector('h2').textContent = bioAction() + '?';
    el.querySelector('.prive-lock-sub').textContent = `Open Prive with ${bioLabel()} instead of typing your password. Your password still works, and you can change this in Settings.`;
    const btn = el.querySelector('.prive-lock-btn') as HTMLButtonElement; btn.textContent = 'Use ' + bioLabel();
    const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 200); resolve(); };
    btn.addEventListener('click', async() => {
      btn.disabled = true; const r = await bioRegister(api); btn.disabled = false;
      if(r === true) close(); else (el.querySelector('.prive-lock-err') as HTMLElement).textContent = r;
    });
    el.querySelector('.prive-lock-later').addEventListener('click', close);
    document.body.append(el); requestAnimationFrame(() => el.classList.add('show'));
  });
}

/** Settings > "Unlock with Face ID" (this device). */
export const bioSetting = {
  available: bioAvailable, on: bioOn, label: bioAction,
  async set(on: boolean): Promise<true | string> { if(on) return bioRegister(api); await bioRemove(api); return true; }
};

/** Settings > Prive password: change it (it can't be turned off). */
export async function openPassSettings(): Promise<void> {
  if(!(await passEnabled())) { await setupScreen(false); return; }
  await screen({
    title: 'Change Prive password', sub: 'The Prive password is always on. It is asked every time you open Prive.',
    fields: [{label: 'Current password', key: 'c'}, {label: 'New password', key: 'a'}, {label: 'Repeat new password', key: 'b'}],
    button: 'Change password', forgot: true,
    submit: async(v) => {
      const e = newPw(v); if(e) return e;
      const r = await api('/set', {password: v.a, current: v.c});
      if(r.status === 200) setUT(r.j);
      return r.status === 200 ? true : why(r);
    },
    onForgot: () => { setupScreen(true, true); }
  });
}
