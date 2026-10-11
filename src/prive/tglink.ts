/*
 * Prive Web: sign in to Prive automatically with the Telegram account that is logged in here, verified by Telegram.
 * Server gives a one-time nonce; we send "/start <nonce>" to the Prive bot with the user's own MTProto session
 * (messages.startBot); the Prive server's bot sees the Telegram-verified sender and, when our claimed user id
 * matches, hands us a Prive token. The bot chat is then removed. No UI, no codes. See prive-deploy/app/tglink.js.
 */
import rootScope from '@lib/rootScope';
import {priveToken, loadPrivePrefs} from '@/prive/api';

let running: Promise<boolean>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const post = (path: string, body: any) => fetch('/api' + path, {
  method: 'POST',
  headers: {'Content-Type': 'application/json', ...(priveToken() ? {Authorization: 'Bearer ' + priveToken()} : {})},
  body: JSON.stringify(body)
}).then(async(r) => ({status: r.status, j: await r.json().catch(() => ({}))}));

export function priveAutoLink(force?: boolean): Promise<boolean> {
  if(priveToken() && !force) return Promise.resolve(true);
  if(running) return running;
  return running = (async() => {
    const managers = rootScope.managers;
    const myId = rootScope.myId;
    if(!managers || !myId) return false;
    const cfg = await fetch('/api/tg/config').then((r) => r.json()).catch((): any => ({}));
    if(!cfg.enabled) return false;
    const b = await post('/tg/begin', {});
    if(b.status !== 200) return false;
    const {nonce, secret, bot} = b.j;
    let botPeerId: PeerId;
    try {
      const peer: any = await managers.appUsersManager.resolveUsername(bot);
      if(!peer?.id || !peer.pFlags?.bot) return false;
      botPeerId = (peer.id as UserId).toPeerId();
      await managers.appMessagesManager.startBot(peer.id, undefined, nonce);
      for(let i = 0; i < 25; i++) {
        await sleep(i ? 1200 : 700);
        const f = await post('/tg/finish', {nonce, secret, telegramUserId: String(myId)});
        if(f.status === 202) continue;
        if(f.status !== 200 || !f.j.token) return false;
        localStorage.setItem('prive_token', f.j.token); // also wakes the embedded /app frames (storage event)
        await loadPrivePrefs(true);
        managers.appTranslationsManager?.setPriveToken?.(f.j.token);
        window.dispatchEvent(new CustomEvent('prive-prefs'));
        return true;
      }
      return false;
    } catch(e) {
      console.warn('[prive] auto link failed', e);
      return false;
    } finally {
      // the bot deletes the /start message; drop the now-empty bot chat from the chat list
      if(botPeerId) setTimeout(() => managers.appMessagesManager.flushHistory({peerId: botPeerId, justClear: false, revoke: false}).catch(() => {}), 1500);
    }
  })().finally(() => setTimeout(() => running = undefined, 15000));
}

/**
 * Re-verify the Telegram identity of the signed-in Prive user through the Prive bot, for a server action
 * (e.g. purpose 'pass-reset' clears the Prive password). Resolves to the server's JSON on success.
 */
export async function verifyTelegramFor(purpose: string): Promise<any> {
  const managers = rootScope.managers, myId = rootScope.myId;
  if(!managers || !myId || !priveToken()) return null;
  const b = await post('/tg/begin', {});
  if(b.status !== 200) return null;
  const {nonce, secret, bot} = b.j;
  let botPeerId: PeerId;
  try {
    const peer: any = await managers.appUsersManager.resolveUsername(bot);
    if(!peer?.id || !peer.pFlags?.bot) return null;
    botPeerId = (peer.id as UserId).toPeerId();
    await managers.appMessagesManager.startBot(peer.id, undefined, nonce);
    for(let i = 0; i < 25; i++) {
      await sleep(i ? 1200 : 700);
      const f = await post('/tg/finish', {nonce, secret, telegramUserId: String(myId), purpose});
      if(f.status === 202) continue;
      return f.status === 200 ? f.j : null;
    }
    return null;
  } finally {
    if(botPeerId) setTimeout(() => managers.appMessagesManager.flushHistory({peerId: botPeerId, justClear: false, revoke: false}).catch(() => {}), 1500);
  }
}
