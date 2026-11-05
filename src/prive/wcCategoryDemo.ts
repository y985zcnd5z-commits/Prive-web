/*
 * Synthetic website-chat rows for tests and the ?wc_cat_preview=1 screen.
 * Shape matches the staged bridge sample: list rows and message.created nest
 * conversation.category_id / category_label / category_icon. Not live data.
 */
import sample from '@/prive/bridge-payload-sample.json';
import {shownWebsiteRows, type WcListChoice, type WcShownRow} from '@/prive/wcCategories';

export const bridgePayloadSample = sample;

export function bridgeListRows() {
  return sample.list;
}

export function bridgeMessageCreated() {
  return sample['message.created'];
}

export const syntheticTelegram: WcShownRow[] = [
  {id: 'tg-demo-1', title: 'Weekend plans', sub: 'Are we still on for Saturday?', initials: 'WP', unread: 2, website: false},
  {id: 'tg-demo-2', title: 'Book club', sub: 'Next chapter is 12', initials: 'BC', unread: 0, website: false}
];

/** All mixes synthetic Telegram rows with uncategorized website chats. */
export function previewRows(choice: WcListChoice): WcShownRow[] {
  if(choice === 'tg') return syntheticTelegram;
  const site = shownWebsiteRows(sample.list, choice);
  if(choice === 'all') return syntheticTelegram.concat(site);
  return site;
}
