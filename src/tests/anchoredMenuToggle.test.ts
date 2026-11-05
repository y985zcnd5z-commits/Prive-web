import {afterEach, describe, expect, it} from 'vitest';
import {createAnchoredMenuToggle} from '@helpers/dom/anchoredMenuToggle';

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function pointerDown(target: Element) {
  target.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, cancelable: true}));
}

function pointerUp() {
  document.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, cancelable: true}));
}

function click(target: Element) {
  return target.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
}

function setup() {
  const anchor = document.createElement('button');
  anchor.type = 'button';
  let opens = 0;
  const menu = createAnchoredMenuToggle({
    build: (_anchor, close) => {
      opens++;
      const root = document.createElement('div');
      root.className = 'menu';
      const dismiss = document.createElement('div');
      dismiss.className = 'menu-back';
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'menu-option';
      option.textContent = 'Option';
      option.addEventListener('click', () => close());
      root.append(dismiss, option);
      document.body.append(root);
      return {root, dismiss};
    }
  });
  anchor.addEventListener('click', () => menu.toggle(anchor));
  document.body.append(anchor);
  return {anchor, menu, opens: () => opens};
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('anchored menu toggle', () => {
  it('opens, closes, and opens again on plain clicks', () => {
    const {anchor, menu} = setup();
    click(anchor);
    expect(menu.isOpen()).toBe(true);
    click(anchor);
    expect(menu.isOpen()).toBe(false);
    click(anchor);
    expect(menu.isOpen()).toBe(true);
  });

  it('stays closed when the dismiss press retargets its click onto the trigger', async() => {
    const {anchor, menu, opens} = setup();
    click(anchor);
    expect(menu.isOpen()).toBe(true);
    expect(opens()).toBe(1);

    const dismiss = document.querySelector('.menu-back');
    pointerDown(dismiss);
    expect(menu.isOpen()).toBe(false);
    // The overlay has stopped hit-testing; the click of that same press
    // arrives on the trigger and must not open the menu again.
    click(anchor);
    expect(menu.isOpen()).toBe(false);
    expect(opens()).toBe(1);

    pointerUp();
    await flush();
    click(anchor);
    expect(menu.isOpen()).toBe(true);
    expect(opens()).toBe(2);
  });

  it('does not let the dismissing click activate whatever is underneath', async() => {
    const {anchor, menu} = setup();
    const other = document.createElement('button');
    let hits = 0;
    other.addEventListener('click', () => hits++);
    document.body.append(other);

    click(anchor);
    pointerDown(document.querySelector('.menu-back'));
    expect(menu.isOpen()).toBe(false);
    click(other);
    expect(hits).toBe(0);

    pointerUp();
    await flush();
    click(other);
    expect(hits).toBe(1);
  });

  it('still runs an option click, and a cancelled press does not swallow the next one', async() => {
    const {anchor, menu} = setup();
    click(anchor);
    click(document.querySelector('.menu-option'));
    expect(menu.isOpen()).toBe(false);

    click(anchor);
    expect(menu.isOpen()).toBe(true);
    pointerDown(document.querySelector('.menu-back'));
    expect(menu.isOpen()).toBe(false);
    pointerUp();
    await flush();
    click(anchor);
    expect(menu.isOpen()).toBe(true);
  });
});
