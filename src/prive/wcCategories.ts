/*
 * Generic website-chat categories. A site may mark a bridged chat with:
 *   category_id     stable token, e.g. fan-support, creator-support
 *   category_label  display string
 *   category_icon   https URL, a site-relative path, or null
 * The staged bridge contract nests those fields on conversation, both on list
 * rows and on message.created. The same three names are also read on the row
 * itself when a list endpoint forwards them flat. Nothing else is a category:
 * kind (including "staff"), site name and any URL are ignored.
 * A row with no complete pair stays in Website Chats and in the All mix.
 * A categorized row is excluded from both and appears only in its category.
 *
 * Port onto live Prive+ (v388 a963bf6) unchanged. In wcChats.sync, do not add a
 * row to All / Archive when !wcRowInMix(row). In sourceFilter.ts, append
 * wcMenuEntries() after Website Chats and store the choice as cat:<category_id>.
 * Server list payload, if it does not already nest conversation: add only
 * category_id, category_label, category_icon. Do not infer a category from kind.
 */
export type WcCategory = {id: string, label: string, icon: string | null};
export type WcListChoice = 'all' | 'tg' | 'web' | `cat:${string}`;

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const ICON_RE = /^(https:\/\/|\/)[^\s<>"']+$/;

export function wcCategoryId(v: unknown): string {
  if(typeof v !== 'string') return '';
  const s = v.trim();
  return ID_RE.test(s) ? s : '';
}

export function wcCategoryLabel(v: unknown): string {
  if(typeof v !== 'string') return '';
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if(!s || s.length > 80) return '';
  return s;
}

export function wcCategoryIcon(v: unknown): string | null {
  if(v == null || v === '') return null;
  if(typeof v !== 'string') return null;
  const s = v.trim();
  if(!ICON_RE.test(s) || s.startsWith('//')) return null;
  return s;
}

function bags(row: any): any[] {
  if(!row || typeof row !== 'object') return [];
  const out: any[] = [];
  if(row.conversation && typeof row.conversation === 'object') out.push(row.conversation);
  out.push(row);
  return out;
}

/** Category from conversation first, then the same fields on the row. */
export function wcCategoryOf(row: any): WcCategory | null {
  for(const bag of bags(row)) {
    const id = wcCategoryId(bag.category_id);
    const label = wcCategoryLabel(bag.category_label);
    if(!id || !label) continue;
    return {id, label, icon: wcCategoryIcon(bag.category_icon)};
  }
  return null;
}

/** One entry per category_id, in the order the rows first mention them. */
export function wcCategories(rows: any[]): WcCategory[] {
  const out: WcCategory[] = [];
  const seen = new Map<string, WcCategory>();
  for(const row of rows || []) {
    const c = wcCategoryOf(row);
    if(!c) continue;
    const prev = seen.get(c.id);
    if(!prev) { seen.set(c.id, c); out.push(c); continue; }
    if(!prev.icon && c.icon) prev.icon = c.icon;
  }
  return out;
}

export function wcListChoice(stored: string | null | undefined): WcListChoice {
  if(stored === 'tg' || stored === 'web') return stored;
  if(stored && stored.startsWith('cat:')) {
    const id = wcCategoryId(stored.slice(4));
    if(id) return `cat:${id}`;
  }
  return 'all';
}

/** True when the row belongs in All and in Website Chats. */
export function wcRowInMix(row: any): boolean {
  return !wcCategoryOf(row);
}

/** Website rows only. Telegram rows are not in this set; `tg` matches none of them. */
export function wcRowInChoice(row: any, choice: WcListChoice): boolean {
  const cat = wcCategoryOf(row);
  if(choice === 'tg') return false;
  if(choice === 'all' || choice === 'web') return !cat;
  return !!cat && cat.id === choice.slice(4);
}

export type WcMenuEntry = {
  id: WcListChoice,
  label: string,
  pill: string,
  icon: string | null,
  category: boolean,
  unread: number
};

const BASE: WcMenuEntry[] = [
  {id: 'all', label: 'All Chats', pill: 'Chats', icon: null, category: false, unread: 0},
  {id: 'tg', label: 'Telegram Chats', pill: 'Telegram', icon: null, category: false, unread: 0},
  {id: 'web', label: 'Website Chats', pill: 'Website', icon: null, category: false, unread: 0}
];

function unreadOf(row: any): number {
  const n = Number(row?.unread);
  return n > 0 ? n : 0;
}

export function wcMenuEntries(rows: any[]): WcMenuEntry[] {
  return BASE.concat(wcCategories(rows).map((c) => {
    let unread = 0;
    for(const row of rows || []) {
      const got = wcCategoryOf(row);
      if(got && got.id === c.id) unread += unreadOf(row);
    }
    return {id: `cat:${c.id}` as WcListChoice, label: c.label, pill: c.label, icon: c.icon, category: true, unread};
  }));
}

export function wcPillLabel(choice: WcListChoice, entries: WcMenuEntry[]): string {
  if(choice === 'all') return 'Chats';
  const hit = entries.find((e) => e.id === choice);
  return hit ? hit.pill : 'Chats';
}

export type WcShownRow = {
  id: string,
  title: string,
  sub: string,
  initials: string,
  unread: number,
  website: boolean
};

function timeOf(row: any): number {
  const n = Number(row?.lastAt);
  return n > 0 ? n : 0;
}

function initialsOf(title: string): string {
  const parts = String(title || '').match(/(^|\s)[\p{L}\p{N}]/gu) || [];
  return parts.map((x) => x.trim()).slice(0, 2).join('').toUpperCase() || '?';
}

export function shownWebsiteRows(rows: any[], choice: WcListChoice): WcShownRow[] {
  const ordered = [...(rows || [])].sort((a, b) => timeOf(b) - timeOf(a));
  const out: WcShownRow[] = [];
  for(const row of ordered) {
    if(!wcRowInChoice(row, choice)) continue;
    const title = String(row.title || 'Website chat');
    out.push({
      id: String(row.id || row.conversation?.ref || title),
      title,
      sub: String(row.lastText || (row.site?.name ? 'via ' + row.site.name : '')),
      initials: String(row.initials || initialsOf(title)),
      unread: unreadOf(row),
      website: true
    });
  }
  return out;
}

let sourceRows: any[] = [];

export function setWcCategorySource(rows: any[]) {
  sourceRows = rows || [];
  if(typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('prive-wc-categories'));
}

export function wcCategorySource() {
  return sourceRows;
}

export function choiceCaption(choice: WcListChoice, label?: string): string {
  if(choice === 'all') return 'Telegram chats and website chats. Categorized website chats are not included.';
  if(choice === 'web') return 'Website chats only. Categorized chats are not included.';
  if(choice === 'tg') return 'Telegram chats only.';
  return (label || 'This category') + ' only.';
}
