/*
 * Website Chats and a selected category replace the mixed chat list with only
 * the website rows that belong there. Categorized rows are not added to the
 * All list (see wcChats.sync); this pane is where those rows are opened.
 */
import {choiceCaption, shownWebsiteRows, wcCategorySource, wcMenuEntries} from '@/prive/wcCategories';
import {sourceFilter} from '@/prive/sourceFilter';
import {fillChoiceList} from '@/prive/wcChoiceList';
import {openWcChat} from '@/prive/wcChats';

function paint(pane: HTMLElement) {
  const choice = sourceFilter();
  const on = choice === 'web' || choice.startsWith('cat:');
  pane.hidden = !on;
  if(!on) { pane.replaceChildren(); return; }
  const entries = wcMenuEntries(wcCategorySource());
  const hit = entries.find((e) => e.id === choice);
  const name = hit ? hit.label : 'Website Chats';
  pane.setAttribute('aria-label', name);
  const cap = document.createElement('p');
  cap.className = 'prive-wc-pane-cap';
  cap.textContent = choiceCaption(choice, hit?.label);
  const rows = shownWebsiteRows(wcCategorySource(), choice);
  const list = document.createElement('div');
  list.className = 'prive-wc-pane-rows';
  list.setAttribute('role', 'list');
  if(!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'prive-wc-pane-empty';
    empty.textContent = choice === 'web' ? 'No website chats' : 'No chats in this category';
    list.append(empty);
  } else fillChoiceList(list, rows, (id) => openWcChat(id));
  pane.replaceChildren(cap, list);
}

export function installWcCategoryPane() {
  const mount = () => {
    const folders = document.getElementById('folders-container');
    if(!folders?.parentElement || document.querySelector('.prive-wc-pane-list')) return !!folders;
    const pane = document.createElement('div');
    pane.className = 'prive-wc-pane-list';
    pane.hidden = true;
    folders.parentElement.insertBefore(pane, folders);
    const go = () => paint(pane);
    document.addEventListener('prive-src-filter', go);
    document.addEventListener('prive-wc-categories', go);
    go();
    return true;
  };
  if(mount()) return;
  const t = window.setInterval(() => { if(mount()) window.clearInterval(t); }, 500);
  window.setTimeout(() => window.clearInterval(t), 20000);
}
