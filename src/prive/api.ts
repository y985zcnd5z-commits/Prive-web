/*
 * Prive (unofficial Telegram client) — client side of the Prive server (Website Connect, modes, website shortcuts).
 * Same origin as /web, so the Prive session token is shared with /app via localStorage.
 */
import {createRoot, createSignal} from 'solid-js';

export type PriveMode = 'client' | 'admin';
export type PriveSite = {id: string, url: string, name: string, icon?: string, frameable?: boolean};
export type PrivePrefs = {mode: PriveMode | null, userSites: PriveSite[], theme?: string | null, push?: {enabled: boolean, publicKey?: string}};

const MODE_KEY = 'prive_mode', TOKEN_KEY = 'prive_token';

export const priveToken = () => localStorage.getItem(TOKEN_KEY);
export const localMode = (): PriveMode | null => {
  const m = localStorage.getItem(MODE_KEY);
  return m === 'admin' || m === 'client' ? m : null;
};

const store = createRoot(() => {
  const [prefs, setPrefs] = createSignal<PrivePrefs>({mode: localMode(), userSites: []});
  const [signedIn, setSignedIn] = createSignal(!!priveToken());
  return {prefs, setPrefs, signedIn, setSignedIn};
});
export const privePrefs = store.prefs;
export const priveSignedIn = store.signedIn;
export const priveMode = (): PriveMode => store.prefs().mode || localMode() || 'client';

async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch('/api' + path, {
    ...init,
    headers: {'Authorization': 'Bearer ' + priveToken(), 'Content-Type': 'application/json', ...(init.headers || {})}
  });
  if(r.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    store.setSignedIn(false);
  }
  if(!r.ok) throw r.status;
  return r.json();
}

let loading: Promise<void>;
export function loadPrivePrefs(force?: boolean) {
  store.setSignedIn(!!priveToken());
  if(!priveToken()) {
    store.setPrefs({...store.prefs(), mode: localMode()});
    return Promise.resolve();
  }
  if(loading && !force) return loading;
  return loading = api<PrivePrefs>('/prefs').then((p) => {
    if(p.mode) localStorage.setItem(MODE_KEY, p.mode);
    else if(localMode()) {
      p.mode = localMode();
      api('/prefs/mode', {method: 'POST', body: JSON.stringify({mode: p.mode})}).catch(() => {});
    }
    store.setPrefs({...p, userSites: p.userSites || []});
  }).catch(() => {}).finally(() => setTimeout(() => loading = undefined, 3000));
}

export async function setPriveMode(mode: PriveMode) {
  localStorage.setItem(MODE_KEY, mode);
  store.setPrefs({...store.prefs(), mode});
  if(priveToken()) await api('/prefs/mode', {method: 'POST', body: JSON.stringify({mode})}).catch(() => {});
  window.dispatchEvent(new CustomEvent('prive-prefs'));
}

// Website Connect notifications: Web Push through the /app service worker (scope /app/).
const b64u = (s: string) => {
  const p = '='.repeat((4 - s.length % 4) % 4);
  const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...r].map((c) => c.charCodeAt(0)));
};
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export async function pushIsOn() {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/app/');
    return !!(reg && await reg.pushManager.getSubscription()) && Notification.permission === 'granted';
  } catch(e) {
    return false;
  }
}
export async function setPush(on: boolean): Promise<string> {
  if(!priveToken()) return 'Sign in to Prive first';
  if(!pushSupported()) return 'Not supported in this browser (on iPhone: add Prive to the Home Screen first)';
  if(!on) {
    const reg = await navigator.serviceWorker.getRegistration('/app/');
    const sub = reg && await reg.pushManager.getSubscription();
    if(sub) {
      await api('/push/unsubscribe', {method: 'POST', body: JSON.stringify({endpoint: sub.endpoint})}).catch(() => {});
      await sub.unsubscribe();
    }
    return '';
  }
  const v = await api<{enabled: boolean, publicKey: string}>('/push/vapid');
  if(!v.enabled) return 'Push is not configured on the server';
  if(await Notification.requestPermission() !== 'granted') return 'Notifications are blocked for this site';
  const reg = await navigator.serviceWorker.register('/app-sw.js', {scope: '/app/'});
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: b64u(v.publicKey)});
  await api('/push/subscribe', {method: 'POST', body: JSON.stringify({subscription: sub.toJSON()})});
  (reg.active || reg.installing || reg.waiting)?.postMessage({type: 'token', token: priveToken()});
  return '';
}

addEventListener('storage', (e: StorageEvent) => {
  if(e.key === TOKEN_KEY || e.key === MODE_KEY) loadPrivePrefs(true);
});
addEventListener('prive-prefs', () => loadPrivePrefs(true));
