/*
 * Prive lock: Face ID / Touch ID / fingerprint unlock via a WebAuthn platform passkey (rpId priveconnect.com,
 * userVerification 'required'). One passkey per device (its id is kept in localStorage; the private key never leaves
 * the device's authenticator). The server verifies the signature and issues the same unlock token as the password.
 * The password always stays as the fallback; "Forgot password?" also removes the passkeys.
 */
const ID_KEY = 'prive_passkey_id';
type Api = (path: string, body?: any) => Promise<{status: number, j: any}>;

const b64u = {
  enc: (b: ArrayBuffer | Uint8Array) => { const u = b instanceof Uint8Array ? b : new Uint8Array(b); let s = ''; for(let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec: (s: string) => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); const u = new Uint8Array(b.length); for(let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
};

const ua = navigator.userAgent;
const IS_IOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
/** what to call it on this device */
export function bioLabel(): string {
  if(IS_IOS) return 'Face ID';
  if(/Macintosh/.test(ua)) return 'Touch ID';
  if(/Windows/.test(ua)) return 'Windows Hello';
  return 'fingerprint or face';
}
/** "Unlock with Face ID" / "Unlock with fingerprint or face" */
export const bioAction = () => 'Unlock with ' + bioLabel();

let availP: Promise<boolean>;
export function bioAvailable(): Promise<boolean> {
  return availP ??= (async() => {
    try {
      const PKC = (window as any).PublicKeyCredential;
      if(!PKC || !window.isSecureContext || !navigator.credentials) return false;
      return !!(await PKC.isUserVerifyingPlatformAuthenticatorAvailable());
    } catch(e) { return false; }
  })();
}
export const bioDeviceId = () => localStorage.getItem(ID_KEY);
export const bioOn = () => !!bioDeviceId();
export function bioForget() { localStorage.removeItem(ID_KEY); }
/** the server's list says which passkeys still exist (reset by "Forgot password?", removed on another device...) */
export function bioSync(serverIds: string[] | undefined) { const id = bioDeviceId(); if(id && Array.isArray(serverIds) && !serverIds.includes(id)) bioForget(); }

/** Create this device's passkey (needs an unlocked Prive). Returns an error message or true. */
export async function bioRegister(api: Api): Promise<true | string> {
  if(!(await bioAvailable())) return bioLabel() + ' is not available on this device';
  const o = await api('/passkey/register-options', {});
  if(o.status !== 200) return o.j.error || 'Could not start ' + bioLabel();
  const pk: PublicKeyCredentialCreationOptions = {
    ...o.j, challenge: b64u.dec(o.j.challenge), user: {...o.j.user, id: b64u.dec(o.j.user.id)},
    excludeCredentials: (o.j.excludeCredentials || []).map((c: any) => ({...c, id: b64u.dec(c.id)}))
  };
  let cred: PublicKeyCredential;
  try { cred = await navigator.credentials.create({publicKey: pk}) as PublicKeyCredential; } catch(e) {
    return (e as Error)?.name === 'InvalidStateError' ? bioLabel() + ' is already set up on this device' : bioLabel() + ' was cancelled';
  }
  const r = cred.response as AuthenticatorAttestationResponse;
  const spki = (r as any).getPublicKey?.(); const alg = (r as any).getPublicKeyAlgorithm?.(); const ad = (r as any).getAuthenticatorData?.();
  if(!spki || !ad) return 'This browser is too old for ' + bioLabel();
  const reg = await api('/passkey/register', {
    id: cred.id, clientDataJSON: b64u.enc(r.clientDataJSON), authenticatorData: b64u.enc(ad), publicKey: b64u.enc(spki), alg,
    label: bioLabel(), device: (localStorage.getItem('prive_device') || (() => { const d = Math.random().toString(36).slice(2, 12); localStorage.setItem('prive_device', d); return d; })())
  });
  if(reg.status !== 200) return reg.j.error || 'Could not save ' + bioLabel();
  localStorage.setItem(ID_KEY, reg.j.id);
  return true;
}

/** Remove this device's passkey (the local id goes even if the server call fails). */
export async function bioRemove(api: Api) {
  const id = bioDeviceId(); bioForget();
  if(id) await api('/passkey/remove', {id}).catch(() => {});
}

/**
 * Ask for Face ID and unlock. Resolves to the server's unlock answer ({unlock, ttl}) or an error:
 * 'blocked' = the browser wants a tap first (iOS Home Screen apps), 'cancelled', 'gone' (passkey no longer valid), or a message.
 */
export async function bioUnlock(api: Api): Promise<{ok: true, j: any} | {ok: false, why: string}> {
  const id = bioDeviceId(); if(!id) return {ok: false, why: 'gone'};
  const o = await api('/passkey/auth-options', {id});
  if(o.status === 404) { bioForget(); return {ok: false, why: 'gone'}; }
  if(o.status !== 200) return {ok: false, why: o.j.error === 'locked' ? 'Too many attempts. Use your password.' : (o.j.error || 'Try your password')};
  let cred: PublicKeyCredential;
  try {
    cred = await navigator.credentials.get({publicKey: {...o.j, challenge: b64u.dec(o.j.challenge), allowCredentials: o.j.allowCredentials.map((c: any) => ({...c, id: b64u.dec(c.id)}))}}) as PublicKeyCredential;
  } catch(e) {
    const n = (e as Error)?.name;
    return {ok: false, why: n === 'NotAllowedError' ? 'blocked' : n === 'AbortError' ? 'cancelled' : 'cancelled'};
  }
  if(!cred) return {ok: false, why: 'cancelled'};
  const r = cred.response as AuthenticatorAssertionResponse;
  const v = await api('/passkey/verify', {id: cred.id, clientDataJSON: b64u.enc(r.clientDataJSON), authenticatorData: b64u.enc(r.authenticatorData), signature: b64u.enc(r.signature)});
  if(v.status === 200) return {ok: true, j: v.j};
  if(v.status === 404) { bioForget(); return {ok: false, why: 'gone'}; }
  return {ok: false, why: v.j.error === 'locked' ? 'Too many attempts. Use your password.' : bioLabel() + ' didn\'t work. Use your password.'};
}
