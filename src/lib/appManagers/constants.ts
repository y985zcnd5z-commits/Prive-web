import type {MyDialogFilter} from '@lib/storages/filters';

/**
 * Legacy Webogram's format, don't change dcID to camelCase. date is timestamp
 */
export type UserAuth = {dcID: number | string, date: number, id: PeerId};
export type REAL_FOLDER_ID = 0 | 1;

export const NULL_PEER_ID: PeerId = 0;
export const REPLIES_PEER_ID: PeerId = 1271266957;
export const VERIFICATION_CODES_BOT_ID = 489000;
export const REPLIES_HIDDEN_CHANNEL_ID: ChatId = 777;
export const HIDDEN_PEER_ID: PeerId = 2666000;
export const SERVICE_PEER_ID: PeerId = 777000;
export const MUTE_UNTIL = 0x7FFFFFFF;
export const BANNED_RIGHTS_UNTIL_FOREVER = 0x7FFFFFFF;
export const BOT_START_PARAM = '';
export const MAX_FILE_SAVE_SIZE = 20 * 1024 * 1024;
export const THUMB_TYPE_FULL = '';
export const TOPIC_COLORS = [0x6FB9F0, 0xFFD67E, 0xCB86DB, 0x8EEE98, 0xFF93B2, 0xFB6F5F];
export const ATTACH_MENU_BOT_ICON_NAME = 'default_static';
export const MESSAGES_ALBUM_MAX_SIZE = 10;
export const MESSAGE_ID_OFFSET = 0x100000000;
export const EPHEMERAL_MESSAGE_ID_OFFSET = MESSAGE_ID_OFFSET * 2;
export const EPHEMERAL_MESSAGE_ID_LIMIT = MESSAGE_ID_OFFSET * 3;
export const GENERAL_TOPIC_ID = MESSAGE_ID_OFFSET + 1;
export const CAN_HIDE_TOPIC = false;
export const T_ME_PREFIXES = new Set(['web', 'k', 'z', 'a']);
export const SEND_WHEN_ONLINE_TIMESTAMP = 0x7FFFFFFE;
export const SERVER_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/bmp', 'image/gif']);
export const STARS_CURRENCY = 'XTR';
export const TON_CURRENCY = 'TON';
export const SEND_PAID_WITH_STARS_DELAY = 5e3;
export const SEND_PAID_REACTION_ANONYMOUS_PEER_ID: PeerId = -1;
export const SUGGESTED_POST_WAIT_FOR_REWARD_HOURS = 24;
export const SUGGESTED_POST_DEFAULT_STARS_COMMISSION = 850;
export const PEER_FULL_TTL = 3 * 60e3;
// A request that raced updateChannelAvailableMessages is reissued so its answer cannot describe
// history the client has already purged. The cutoff generation only moves when available_min_id
// really changes, so this normally costs at most one extra round trip; the cap turns a peer whose
// cutoff keeps moving into a stale answer instead of an unbounded request loop.
export const CHANNEL_CUTOFF_RETRY_LIMIT = 5;

export const FOLDER_ID_ALL: REAL_FOLDER_ID = 0;
export const FOLDER_ID_ARCHIVE: REAL_FOLDER_ID = 1;
export const REAL_FOLDERS: Set<number> = new Set([FOLDER_ID_ALL, FOLDER_ID_ARCHIVE]);
// Prive: a device-local, never-synced "Channels" filter (the Channels pill). Not one of the user's Telegram folders.
export const PRIVE_CHANNELS_FILTER_ID = 99999;
export const START_LOCAL_ID = Math.max(...Array.from(REAL_FOLDERS)) + 1 as MyDialogFilter['localId'];

// Prive: Telegram Stories are hidden (website updates take their place).
// Workers have no localStorage: they always keep stories data, the UI (main thread) decides whether to show it.
export const TEST_NO_STORIES = (() => {
  try {
    if(typeof window === 'undefined') return false;
    return true; // Prive only: Telegram Stories are always replaced by website updates
  } catch(e) {
    return false;
  }
})();
export const TEST_NO_SAVED = false;
export const TEST_NO_STREAMING = false;
