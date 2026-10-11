/*
 * Prive per-chat translation: a language button in every chat. Choose a language (or Off) and incoming messages in
 * that chat are translated into it; the choice is remembered per chat (locally and on the Prive server).
 * Engine: Telegram's own translation when the account has Premium, otherwise the Prive server (/api/translate).
 */
import {IS_TELEGRAM_VIEW} from '@/prive/view';
import {createRoot, createSignal} from 'solid-js';
import showPickUserPopup from '@components/popups/pickUser';
import RowTsx from '@components/rowTsx';
import {wrapSolidComponent} from '@helpers/solid/wrapSolidComponent';
import SearchIndex from '@lib/searchIndex';
import {useAppSettings} from '@stores/appSettings';
import {toast} from '@components/toast';
import {IconTsx} from '@components/iconTsx';
import rootScope from '@lib/rootScope';
import {priveToken} from '@/prive/api';

const KEY = 'prive_tr';
type Lang = {code: string, name: string};
const FALLBACK: Lang[] = [['EN', 'English'], ['AR', 'Arabic'], ['PT', 'Portuguese'], ['ES', 'Spanish'], ['RU', 'Russian'], ['RO', 'Romanian'], ['FR', 'French'], ['HU', 'Hungarian'], ['BG', 'Bulgarian'], ['CS', 'Czech']].map(([code, name]) => ({code, name}));

const store = createRoot(() => {
  let initial: Record<string, string> = {};
  try {
    initial = JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch(e) {}
  const [chats, setChats] = createSignal<Record<string, string>>(initial);
  return {chats, setChats};
});

/** Lower-case language code chosen for this Telegram peer, or undefined when Prive translation is off. */
export const priveChatLang = (peerId: PeerId): string | undefined => IS_TELEGRAM_VIEW ? undefined : store.chats()['tg:' + peerId]?.toLowerCase();

let languages: Lang[];
async function loadLanguages(): Promise<Lang[]> {
  if(languages) return languages;
  try {
    const j = await (await fetch('/api/translate/languages')).json();
    languages = j.languages?.length ? j.languages : FALLBACK;
  } catch(e) {
    languages = FALLBACK;
  }
  return languages;
}
export const priveLangName = (code: string) => (languages || FALLBACK).find((l) => l.code === String(code).toUpperCase())?.name || '';

export function syncPriveTranslation() {
  rootScope.managers?.appTranslationsManager.setPriveToken(priveToken());
  loadLanguages();
  if(!priveToken()) return;
  fetch('/api/translate/chats', {headers: {Authorization: 'Bearer ' + priveToken()}}).then((r) => r.ok ? r.json() : null).then((j) => {
    if(!j?.chats) return;
    const merged = {...j.chats, ...store.chats()};
    store.setChats(merged);
    localStorage.setItem(KEY, JSON.stringify(merged));
  }).catch(() => {});
}

function setChatLang(peerId: PeerId, code: string | null) {
  const next = {...store.chats()};
  if(code) next['tg:' + peerId] = code;
  else delete next['tg:' + peerId];
  store.setChats(next);
  localStorage.setItem(KEY, JSON.stringify(next));
  const [, setAppSettings] = useAppSettings();
  // Telegram's translation pipeline renders the bubbles; Prive supplies the language + engine.
  if(code) {
    setAppSettings('translations', 'peers', peerId, code.toLowerCase());
    setAppSettings('translations', 'enabledPeers', peerId, true);
  } else {
    setAppSettings('translations', 'enabledPeers', peerId, undefined);
  }
  if(priveToken()) {
    fetch('/api/translate/chat', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + priveToken()},
      body: JSON.stringify({chat: 'tg:' + peerId, lang: code})
    }).catch(() => {});
  }
}

export async function showPriveLanguagePicker(peerId: PeerId) {
  if(!priveToken() && !rootScope.premium) {
    toast('Sign in to Prive to translate chats: Settings → Websites → Link with a code from the Prive app.');
    return;
  }
  const list = await loadLanguages();
  const current = store.chats()['tg:' + peerId];
  const index = new SearchIndex<string>({ignoreCase: true});
  const map = new Map<string, Lang>();
  map.set('OFF', {code: 'OFF', name: 'Off'});
  list.forEach((l) => {
    map.set(l.code, l);
    index.indexObjectArray(l.code, [l.code, l.name]);
  });

  const popup = showPickUserPopup({
    peerType: ['custom'],
    renderResultsFunc: (codes) => {
      const middleware = popup.selector.middlewareHelperLoader.get();
      codes.forEach((code) => {
        const l = map.get(code as any as string);
        if(!l) return;
        const selected = (l.code === 'OFF' && !current) || l.code === current;
        const row = wrapSolidComponent(() => (
          <RowTsx ref={(element) => { element.dataset.peerId = String(code); }} clickable>
            <RowTsx.Title titleRight={selected ? <IconTsx icon="check" class="prive-check" /> : undefined}>{l.name}</RowTsx.Title>
            <RowTsx.Subtitle>{l.code === 'OFF' ? 'Show messages as they were sent' : 'Translate incoming messages into ' + l.name}</RowTsx.Subtitle>
          </RowTsx>
        ), middleware);
        popup.selector.list.append(row);
      });
    },
    placeholder: 'Search',
    getMoreCustom: async(q) => ({
      result: (q ? [...index.search(q)] : ['OFF', ...list.map((l) => l.code)]) as any,
      isEnd: true
    }),
    onSelect: (results) => {
      const code = String(results[0]?.key || 'OFF');
      setChatLang(peerId, code === 'OFF' ? null : code);
      toast(code === 'OFF' ? 'Translation off for this chat' : 'Translating this chat into ' + priveLangName(code));
    },
    titleLangKey: 'Telegram.LanguageViewController',
    noPlaceholder: true,
    onClose: () => {}
  });
}
