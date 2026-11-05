/**
 * Toggle for a menu whose dismiss layer covers its trigger.
 *
 * The layer listens to pointerdown and stops hit-testing in that same turn
 * (`pointer-events` drops when the open class is removed, or the node goes
 * away). The click that finishes the press is then hit-tested again and lands
 * on the trigger underneath, which would toggle the menu straight back open.
 * Touch and a mouse click both do this: pointerdown, pointerup, then click.
 *
 * The click that belongs to the dismissing press is swallowed. The next press
 * is a new gesture and toggles normally, so open → close → open still works.
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

export function swallowClickFromThisPointerGesture(doc: Document = document) {
  let armed = true;
  const disarm = () => {
    if(!armed) return;
    armed = false;
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('pointerdown', onLaterPointerDown, true);
    doc.removeEventListener('pointerup', onPointerUp, true);
    doc.removeEventListener('pointercancel', onPointerUp, true);
  };
  const onClick = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    disarm();
  };
  // Capture, added during the dismiss pointerdown: that event is already past
  // capture, so it must not count as a new press and drop the guard early.
  const onLaterPointerDown = () => {
    disarm();
  };
  const onPointerUp = () => {
    doc.removeEventListener('pointerup', onPointerUp, true);
    doc.removeEventListener('pointercancel', onPointerUp, true);
    // Click is dispatched after pointerup, before timers. If this press was
    // cancelled and no click comes, the guard must not eat a later keypress.
    doc.defaultView?.setTimeout(disarm, 0);
  };

  doc.addEventListener('click', onClick, true);
  doc.addEventListener('pointerdown', onLaterPointerDown, true);
  doc.addEventListener('pointerup', onPointerUp, true);
  doc.addEventListener('pointercancel', onPointerUp, true);
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
