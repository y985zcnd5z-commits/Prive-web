/*
 * Synthetic preview of website-chat categories (?wc_cat_preview=1).
 * No Telegram session and no live site. The rows are bridge-payload-sample.json.
 */
import Modes from '@config/modes';
import {choiceCaption, wcMenuEntries, wcPillLabel, type WcListChoice} from '@/prive/wcCategories';
import {bridgeListRows, previewRows} from '@/prive/wcCategoryDemo';
import {fillChoiceList} from '@/prive/wcChoiceList';
import {closeWcSourceMenu, toggleWcSourceMenu} from '@/prive/wcSourceMenu';

let choice: WcListChoice = 'all';
let opener: HTMLButtonElement;
let restore: HTMLElement | undefined;

function caption() {
  const hit = wcMenuEntries(bridgeListRows()).find((e) => e.id === choice);
  return choiceCaption(choice, hit?.label);
}

function showNote(title: string, from: HTMLElement) {
  restore = from;
  const root = document.createElement('div');
  root.className = 'prive-wc-catprev-note';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'prive-wc-note-title');
  const card = document.createElement('div');
  card.className = 'prive-wc-catprev-card';
  const h = document.createElement('h2');
  h.id = 'prive-wc-note-title';
  h.textContent = title;
  const p = document.createElement('p');
  p.textContent = 'Synthetic preview. This chat is not opened on a live site.';
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = 'Close';
  const close = () => {
    root.remove();
    document.removeEventListener('keydown', onKey);
    if(Modes.a11y) restore?.focus();
  };
  const onKey = (e: KeyboardEvent) => { if(e.key === 'Escape') close(); };
  b.addEventListener('click', close);
  root.addEventListener('click', (e) => { if(e.target === root) close(); });
  document.addEventListener('keydown', onKey);
  card.append(h, p, b);
  root.append(card);
  document.body.append(root);
  if(Modes.a11y) b.focus();
}

function paint(list: HTMLElement, cap: HTMLElement, pillLabel: HTMLElement) {
  cap.textContent = caption();
  pillLabel.textContent = wcPillLabel(choice, wcMenuEntries(bridgeListRows()));
  opener.setAttribute('aria-pressed', String(choice !== 'all'));
  opener.classList.toggle('active', choice !== 'all');
  const rows = previewRows(choice);
  if(!rows.length) {
    list.replaceChildren();
    const empty = document.createElement('p');
    empty.className = 'prive-wc-pane-empty';
    empty.textContent = choice.startsWith('cat:') ? 'No chats in this category' : 'No chats';
    list.append(empty);
    return;
  }
  fillChoiceList(list, rows, (id) => {
    const row = rows.find((r) => r.id === id);
    const btn = list.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
    showNote(row ? row.title : 'Chat', btn || opener);
  });
}

export function startWcCategoryPreview() {
  document.title = 'Website chat categories';
  document.body.classList.add('prive-wc-catprev-on');
  document.body.replaceChildren();
  const root = document.createElement('div');
  root.className = 'prive-wc-catprev';
  const h = document.createElement('h1');
  h.className = 'prive-wc-catprev-h';
  h.textContent = 'Chats';
  const bar = document.createElement('div');
  bar.className = 'prive-wc-catprev-bar';
  opener = document.createElement('button');
  opener.type = 'button';
  opener.className = 'prive-pill-filter prive-pill-src';
  opener.setAttribute('aria-haspopup', 'menu');
  opener.setAttribute('aria-expanded', 'false');
  opener.setAttribute('aria-pressed', 'false');
  const label = document.createElement('span');
  label.className = 'prive-pill-label';
  label.textContent = 'Chats';
  opener.append(label);
  opener.insertAdjacentHTML('beforeend', '<svg class="prive-pill-chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>');
  const cap = document.createElement('p');
  cap.className = 'prive-wc-pane-cap';
  const list = document.createElement('div');
  list.className = 'prive-wc-pane-rows';
  list.setAttribute('role', 'list');
  list.setAttribute('aria-label', 'Chats');
  const foot = document.createElement('p');
  foot.className = 'prive-wc-catprev-foot';
  foot.textContent = 'Synthetic preview. Not a live site.';
  opener.addEventListener('click', () => {
    toggleWcSourceMenu(opener, () => wcMenuEntries(bridgeListRows()), () => choice, (id) => {
      choice = id;
      closeWcSourceMenu(false);
      paint(list, cap, label);
    });
  });
  bar.append(opener);
  root.append(h, bar, cap, list, foot);
  document.body.append(root);
  paint(list, cap, label);
  window.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeWcSourceMenu(false); });
}
