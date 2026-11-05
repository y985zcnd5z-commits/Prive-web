/**
 * Toggle for a menu whose dismiss layer covers its trigger.
 *
 * The layer listens to pointerdown and stops hit-testing in that same turn
 * (`pointer-events` drops when the open class is removed, or the node goes
 * away). The click that finishes the press is then hit-tested again and lands
 * on the trigger underneath, which would toggle the menu straight back open.
 *
 * Desktop delivers that click in the same turn as pointerup, before timers.
 * WKWebView on iOS does not: pointerdown, touchstart, pointerup, touchend,
 * then the synthetic mousedown/mouseup/click in a later task — after a
 * setTimeout(0) queued from pointerup. The guard has to still be armed when
 * that click arrives. touchend is cancelled too, which is what stops WebKit
 * from building the click; the click listener is the backup when it still fires.
 *
 * A later press (pointerdown, then its click) is a new gesture and toggles.
 */

type AnchoredMenuParts = {
  root: HTMLElement,
  dismiss: HTMLElement
};

export type AnchoredMenuToggle = {
  toggle: (anchor: HTMLElement) => void,
  close: () => void,
  isOpen: () => boolean
};

// WebKit's synthetic click can land up to ~300ms after touchend. Past this the
// press is over and a keypress must not be eaten.
const GHOST_CLICK_MS = 700;

export function swallowClickFromThisPointerGesture(doc: Document = document) {
  let armed = true;
  let laterPressAt = -1;
  const view = doc.defaultView;
  let timer = 0;
  const disarm = () => {
    if(!armed) return;
    armed = false;
    view?.clearTimeout(timer);
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('pointerdown', onLaterPointerDown, true);
    doc.removeEventListener('touchend', onTouchEnd, true);
  };
  const onClick = (event: Event) => {
    if(!armed) return;
    // Click of a press that started after the dismissing one.
    if(laterPressAt >= 0 && event.timeStamp >= laterPressAt) {
      disarm();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    disarm();
  };
  // Capture, added during the dismiss pointerdown: that event is already past
  // capture, so it must not count as a new press and drop the guard early.
  const onLaterPointerDown = (event: Event) => {
    laterPressAt = event.timeStamp;
  };
  const onTouchEnd = (event: Event) => {
    if(!armed || (laterPressAt >= 0 && event.timeStamp >= laterPressAt)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  doc.addEventListener('click', onClick, true);
  doc.addEventListener('pointerdown', onLaterPointerDown, true);
  doc.addEventListener('touchend', onTouchEnd, {capture: true, passive: false});
  timer = view?.setTimeout(disarm, GHOST_CLICK_MS) ?? 0;
}

export function createAnchoredMenuToggle(options: {
  build: (anchor: HTMLElement, close: () => void) => AnchoredMenuParts,
  markAnchor?: (anchor: HTMLElement, open: boolean) => void
}): AnchoredMenuToggle {
  let current: {root: HTMLElement, anchor: HTMLElement} | undefined;

  const finishClose = (fromDismissGesture: boolean) => {
    const open = current;
    if(!open) return;
    current = undefined;
    open.anchor.setAttribute('aria-expanded', 'false');
    options.markAnchor?.(open.anchor, false);
    if(fromDismissGesture) swallowClickFromThisPointerGesture(open.root.ownerDocument);
    open.root.inert = true;
    open.root.classList.remove('show');
    const root = open.root;
    root.ownerDocument.defaultView?.setTimeout(() => root.remove(), 220);
  };

  const toggle = (anchor: HTMLElement) => {
    if(current?.anchor === anchor) {
      finishClose(false);
      return;
    }
    if(current) finishClose(false);

    const handle = options.build(anchor, () => finishClose(false));
    handle.dismiss.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      finishClose(true);
    });
    handle.root.inert = true;
    current = {root: handle.root, anchor};
    anchor.setAttribute('aria-haspopup', 'menu');
    anchor.setAttribute('aria-expanded', 'true');
    options.markAnchor?.(anchor, true);

    const view = handle.root.ownerDocument.defaultView;
    view?.requestAnimationFrame(() => view.requestAnimationFrame(() => {
      if(current?.root !== handle.root) return;
      handle.root.inert = false;
      handle.root.classList.add('show');
    }));
  };

  return {
    toggle,
    close: () => finishClose(false),
    isOpen: () => !!current
  };
}
