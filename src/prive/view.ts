/*
 * Prive is the only face of the app (the Telegram view and the Prive/Telegram switcher were removed).
 * IS_TELEGRAM_VIEW stays as a constant false so old guards compile away. Devices that still have the old
 * per-device flag ('prive_view' = 'telegram') simply land in Prive.
 */
export type PriveView = 'prive';
export const IS_TELEGRAM_VIEW = false as const;
export const currentView = (): PriveView => 'prive';
try { if(typeof window !== 'undefined') { window.localStorage.removeItem('prive_view'); window.localStorage.removeItem('prive_switch_pending'); } } catch(e) {}
