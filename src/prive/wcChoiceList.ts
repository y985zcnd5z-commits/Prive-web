import type {WcShownRow} from '@/prive/wcCategories';

/** Buttons for one chat-list choice. Labels are text, never HTML. */
export function fillChoiceList(container: HTMLElement, rows: WcShownRow[], onOpen: (id: string) => void) {
  container.replaceChildren();
  for(const row of rows) {
    const li = document.createElement('div');
    li.setAttribute('role', 'listitem');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'prive-wc-choice-row' + (row.website ? ' is-website' : ' is-telegram');
    b.dataset.id = row.id;
    const av = document.createElement('span');
    av.className = 'prive-wc-choice-av';
    av.textContent = row.initials;
    av.setAttribute('aria-hidden', 'true');
    const body = document.createElement('span');
    body.className = 'prive-wc-choice-body';
    const title = document.createElement('span');
    title.className = 'prive-wc-choice-title';
    title.textContent = row.title;
    const sub = document.createElement('span');
    sub.className = 'prive-wc-choice-sub';
    sub.textContent = row.sub;
    body.append(title, sub);
    b.append(av, body);
    if(row.unread > 0) {
      const u = document.createElement('span');
      u.className = 'prive-wc-choice-unread';
      u.textContent = row.unread > 999 ? '999+' : String(row.unread);
      b.append(u);
    }
    const where = row.website ? ', website chat' : ', Telegram chat';
    const unread = row.unread > 0 ? `, ${row.unread} unread` : '';
    b.setAttribute('aria-label', row.title + where + unread);
    b.addEventListener('click', () => onOpen(row.id));
    li.append(b);
    container.append(li);
  }
}
