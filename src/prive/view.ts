/*
 * Prive: which face of the app this device shows for the logged-in account.
 *  'prive'    = everything Prive adds (Websites, website circles, pill tabs, translation, Noir, glass bar)
 *  'telegram' = the same MTProto session with every Prive customisation off (stock WebK look and behaviour)
 * Per device (localStorage). Switching reloads the page; the Telegram session is untouched, so no re-login.
 */
export type PriveView = 'prive' | 'telegram';
export const VIEW_KEY = 'prive_view';

export function currentView(): PriveView {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(VIEW_KEY) === 'telegram' ? 'telegram' : 'prive';
  } catch(e) {
    return 'prive';
  }
}

/** Evaluated once per page load (a switch reloads the page). Always false inside workers. */
export const IS_TELEGRAM_VIEW = currentView() === 'telegram';

export function setView(view: PriveView, reload = true) {
  try { localStorage.setItem(VIEW_KEY, view); } catch(e) {}
  if(reload) location.reload();
}
