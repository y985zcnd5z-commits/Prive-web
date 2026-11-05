import {afterEach, describe, expect, it} from 'vitest';
import {
  applySourceFilter,
  closeSourceMenu,
  installSourceFilter,
  sourceFilter,
  toggleSourceMenu
} from '@/prive/sourceFilter';

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function click(target: Element) {
  return target.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
}

function pointerDown(target: Element) {
  target.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, cancelable: true}));
}

function pointerUp() {
  document.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, cancelable: true}));
}

function labels() {
  const menus = document.querySelectorAll('.prive-src-menu');
  const menu = menus[menus.length - 1];
  return [...menu.querySelectorAll('.prive-src-label')].map((node) => node.textContent);
}

afterEach(() => {
  closeSourceMenu();
  applySourceFilter('all');
  localStorage.removeItem('prive_src_filter');
  document.body.classList.remove('prive-src-tg', 'prive-src-web', 'prive-unread-list');
  document.body.replaceChildren();
});

describe('chats source menu', () => {
  it('lists the four chat sources and selects one', () => {
    installSourceFilter();
    const chats = document.createElement('button');
    chats.type = 'button';
    chats.addEventListener('click', () => toggleSourceMenu(chats));
    document.body.append(chats);

    click(chats);
    expect(labels()).toEqual(['All Chats', 'Telegram Chats', 'Website Chats', 'Unread Chats']);
    expect(chats.getAttribute('aria-expanded')).toBe('true');

    const website = [...document.querySelectorAll('.prive-src-item')].find((item) => item.textContent?.includes('Website Chats'));
    click(website);
    expect(sourceFilter()).toBe('web');
    expect(document.body.classList.contains('prive-src-web')).toBe(true);
    expect(chats.getAttribute('aria-expanded')).toBe('false');
    expect(localStorage.getItem('prive_src_filter')).toBe('web');
  });

  it('closes on a second press whose click falls through to the Chats button, then opens again', async() => {
    installSourceFilter();
    const chats = document.createElement('button');
    chats.type = 'button';
    chats.addEventListener('click', () => toggleSourceMenu(chats));
    document.body.append(chats);

    click(chats);
    expect(chats.getAttribute('aria-expanded')).toBe('true');

    pointerDown(document.querySelector('.prive-src-back'));
    expect(chats.getAttribute('aria-expanded')).toBe('false');
    click(chats);
    expect(chats.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('.prive-src-menu.show')).toBeNull();

    pointerUp();
    await flush();
    click(chats);
    expect(chats.getAttribute('aria-expanded')).toBe('true');
    expect(labels()).toEqual(['All Chats', 'Telegram Chats', 'Website Chats', 'Unread Chats']);
  });

  it('dismisses from outside the menu without activating the row underneath', async() => {
    installSourceFilter();
    const chats = document.createElement('button');
    chats.type = 'button';
    chats.addEventListener('click', () => toggleSourceMenu(chats));
    const row = document.createElement('button');
    let opened = 0;
    row.addEventListener('click', () => opened++);
    document.body.append(chats, row);

    click(chats);
    pointerDown(document.querySelector('.prive-src-back'));
    click(row);
    expect(opened).toBe(0);
    expect(chats.getAttribute('aria-expanded')).toBe('false');

    pointerUp();
    await flush();
    pointerDown(row);
    click(row);
    expect(opened).toBe(1);
  });

  it('stays closed when WKWebView delivers the click after pointerup yields', async() => {
    installSourceFilter();
    const chats = document.createElement('button');
    chats.type = 'button';
    chats.addEventListener('click', () => toggleSourceMenu(chats));
    document.body.append(chats);

    click(chats);
    expect(chats.getAttribute('aria-expanded')).toBe('true');

    pointerDown(document.querySelector('.prive-src-back'));
    expect(chats.getAttribute('aria-expanded')).toBe('false');
    document.dispatchEvent(new Event('touchstart', {bubbles: true, cancelable: true}));
    pointerUp();
    const touchEnd = new Event('touchend', {bubbles: true, cancelable: true});
    document.dispatchEvent(touchEnd);
    expect(touchEnd.defaultPrevented).toBe(true);

    await flush();
    chats.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true}));
    chats.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, cancelable: true}));
    click(chats);
    expect(chats.getAttribute('aria-expanded')).toBe('false');

    pointerDown(chats);
    click(chats);
    expect(chats.getAttribute('aria-expanded')).toBe('true');
    expect(labels()).toEqual(['All Chats', 'Telegram Chats', 'Website Chats', 'Unread Chats']);
  });
});
