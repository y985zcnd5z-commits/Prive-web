/*
 * Prive password (optional, off by default): Telegram-passcode-style lock in front of the Prive view.
 * Verified on the Prive server (scrypt, per-user lockouts); "Forgot password" re-verifies the Telegram account
 * through the Prive bot. Leaving Prive for Telegram never asks; Telegram -> Prive does when it is set.
 */
import {verifyTelegramFor} from '@/prive/tglink';

const ON_KEY = 'prive_pass_on';
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

const LOCK_SVG = '<svg viewBox="0 0 24 24" width="30" height="30"><rect x="5" y="10.5" width="14" height="10" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

type Field = {label: string, key: string};
/** One full-screen Noir passcode screen. resolve(values) on submit (submit may reject with a message to shake). */
function screen(opts: {title: string, sub?: string, fields: Field[], button: string, cancel?: string, forgot?: boolean,
  submit: (v: Record<string, string>) => Promise<string | true>}): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'prive-lock';
    el.innerHTML = `<div class="prive-lock-in"><div class="prive-lock-icon">${LOCK_SVG}</div><h2></h2><p class="prive-lock-sub"></p>
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
      if(ok) { err.textContent = ''; done(true); } else err.textContent = 'Could not verify your Telegram account. Try again in a minute.';
    });
    document.body.append(el);
    requestAnimationFrame(() => { el.classList.add('show'); inputs[0].focus(); });
  });
}

const why = (r: {status: number, j: any}) =>
  r.j.error === 'locked' ? `Too many attempts. Try again in ${r.j.retryAfter > 90 ? Math.ceil(r.j.retryAfter / 60) + ' min' : r.j.retryAfter + ' s'}.` :
  r.j.error === 'wrong' ? (r.j.triesLeft != null && r.j.triesLeft <= 2 ? `Wrong password. ${r.j.triesLeft} attempt${r.j.triesLeft === 1 ? '' : 's'} left.` : 'Wrong password') :
  r.j.error || 'Something went wrong';

/** Forgot: prove it's still the same Telegram account (Prive bot), which clears the password. */
export async function forgotPassword(): Promise<boolean> {
  const r = await verifyTelegramFor('pass-reset').catch((): any => null);
  if(r && r.reset) { localStorage.setItem(ON_KEY, '0'); return true; }
  return false;
}

/** Telegram -> Prive: ask for the password when one is set. Resolves true when Prive may open. */
export async function requireUnlock(reason?: string): Promise<boolean> {
  if(!(await passEnabled())) return true;
  return screen({
    title: 'Enter your Prive password', sub: reason || 'Prive is locked on this account.',
    fields: [{label: 'Password', key: 'p'}], button: 'Unlock', forgot: true,
    submit: async(v) => {
      if(!v.p) return 'Enter your password';
      const r = await api('/verify', {password: v.p});
      return r.status === 200 ? true : why(r);
    }
  });
}

/** Settings > Prive password: set / change / turn off */
export async function openPassSettings(): Promise<void> {
  const on = await passEnabled();
  if(!on) {
    const ok = await screen({
      title: 'Set a Prive password', sub: 'Asked when you switch from Telegram to Prive, on all your devices. Switching to Telegram never asks.',
      fields: [{label: 'New password', key: 'a'}, {label: 'Repeat password', key: 'b'}], button: 'Turn on',
      submit: async(v) => {
        if((v.a || '').length < 4) return 'Use at least 4 characters';
        if(v.a !== v.b) return "Passwords don't match";
        const r = await api('/set', {password: v.a});
        return r.status === 200 ? true : why(r);
      }
    });
    if(ok) localStorage.setItem(ON_KEY, '1');
    return;
  }
  const action = await chooser();
  if(action === 'change') {
    await screen({
      title: 'Change Prive password', fields: [{label: 'Current password', key: 'c'}, {label: 'New password', key: 'a'}, {label: 'Repeat new password', key: 'b'}],
      button: 'Change', forgot: true,
      submit: async(v) => {
        if((v.a || '').length < 4) return 'Use at least 4 characters';
        if(v.a !== v.b) return "Passwords don't match";
        const r = await api('/set', {password: v.a, current: v.c});
        return r.status === 200 ? true : why(r);
      }
    });
  } else if(action === 'off') {
    const ok = await screen({
      title: 'Turn password off', fields: [{label: 'Current password', key: 'c'}], button: 'Turn off', forgot: true,
      submit: async(v) => { const r = await api('/disable', {password: v.c}); return r.status === 200 ? true : why(r); }
    });
    if(ok) localStorage.setItem(ON_KEY, '0');
  }
}

function chooser(): Promise<'change' | 'off' | null> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'prive-lock prive-lock-menu';
    el.innerHTML = `<div class="prive-lock-in"><div class="prive-lock-icon">${LOCK_SVG}</div><h2>Prive password</h2>
      <p class="prive-lock-sub">On. Asked when switching from Telegram to Prive.</p>
      <button type="button" class="prive-lock-btn" data-a="change">Change password</button>
      <button type="button" class="prive-lock-btn danger" data-a="off">Turn password off</button></div>
      <button type="button" class="prive-lock-cancel">Close</button>`;
    const done = (v: any) => { el.classList.remove('show'); setTimeout(() => el.remove(), 200); resolve(v); };
    el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => done((b as HTMLElement).dataset.a)));
    el.querySelector('.prive-lock-cancel').addEventListener('click', () => done(null));
    document.body.append(el);
    requestAnimationFrame(() => el.classList.add('show'));
  });
}
