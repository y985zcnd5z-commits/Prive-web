import {bridgeListRows} from '../prive/wcCategoryDemo';
import {wcMenuEntries, type WcListChoice} from '../prive/wcCategories';
import {closeWcSourceMenu, toggleWcSourceMenu} from '../prive/wcSourceMenu';
import {setSourceFilter, sourceFilter} from '../prive/sourceFilter';

const entries = () => wcMenuEntries(bridgeListRows());

afterEach(() => {
  closeWcSourceMenu(false);
  document.querySelectorAll('.prive-src-menu').forEach((n) => n.remove());
  document.body.className = '';
  delete document.body.dataset.priveWcCat;
  localStorage.removeItem('prive_src_filter');
});

describe('chats source menu', () => {
  test('lists categories after Website Chats and not a staff row that has no category', () => {
    document.body.innerHTML = '<button id="chats">Chats</button>';
    const btn = document.getElementById('chats') as HTMLButtonElement;
    toggleWcSourceMenu(btn, entries, () => 'all', () => {});
    const labels = [...document.querySelectorAll('.prive-src-label')].map((n) => n.textContent);
    expect(labels).toEqual(['All Chats', 'Telegram Chats', 'Website Chats', 'Creator Support', 'Fan Support']);
    expect(labels.join(' ')).not.toContain('Jordan');
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    const fan = document.querySelector<HTMLButtonElement>('[data-choice="cat:fan-support"]');
    expect(fan?.getAttribute('role')).toBe('menuitemradio');
    expect(fan?.getAttribute('aria-checked')).toBe('false');
    expect(document.querySelector('[data-choice="all"]')?.getAttribute('aria-checked')).toBe('true');
    expect(fan?.querySelector('.prive-src-unread')?.textContent).toBe('5');
  });

  test('picking a category reports that choice and a second tap closes', () => {
    document.body.innerHTML = '<button id="chats">Chats</button>';
    const btn = document.getElementById('chats') as HTMLButtonElement;
    const picked: WcListChoice[] = [];
    toggleWcSourceMenu(btn, entries, () => 'web', (id) => picked.push(id));
    document.querySelector<HTMLButtonElement>('[data-choice="cat:creator-support"]')?.click();
    expect(picked).toEqual(['cat:creator-support']);
    toggleWcSourceMenu(btn, entries, () => 'all', () => {});
    expect(document.querySelector('.prive-src-menu.show')).toBeNull();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  test('the remembered filter opens the category list and leaves All', () => {
    setSourceFilter('cat:fan-support');
    expect(sourceFilter()).toBe('cat:fan-support');
    expect(localStorage.getItem('prive_src_filter')).toBe('cat:fan-support');
    expect(document.body.classList.contains('prive-wc-pane')).toBe(true);
    expect(document.body.classList.contains('prive-src-cat')).toBe(true);
    expect(document.body.dataset.priveWcCat).toBe('fan-support');
    setSourceFilter('web');
    expect(document.body.classList.contains('prive-src-web')).toBe(true);
    expect(document.body.classList.contains('prive-src-cat')).toBe(false);
    expect(document.body.dataset.priveWcCat).toBeUndefined();
    setSourceFilter('all');
    expect(sourceFilter()).toBe('all');
    expect(localStorage.getItem('prive_src_filter')).toBeNull();
    expect(document.body.classList.contains('prive-wc-pane')).toBe(false);
  });
});
