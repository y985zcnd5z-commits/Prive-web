/*
 * Prive tabs inside Telegram's left column (same slider, header and back button as Telegram's own tabs).
 *  - PriveWebsitesTab: the single "Websites" entry (Website Connect chats, updates, saved websites, and the
 *    moderator tools for sites the user owns or moderates; 'Connect your website' at the bottom). Its content is the Prive server view, full height, no extra header.
 */
import {SliderSuperTab} from '@components/slider';
import {loadPrivePrefs} from '@/prive/api';

export class PriveWebsitesTab extends SliderSuperTab {
  public static noSame = true;
  private frame: HTMLIFrameElement;

  public init(section?: string) {
    this.container.classList.add('prive-websites-tab');
    this.title.replaceChildren(document.createTextNode('Websites'));
    const frame = this.frame = document.createElement('iframe');
    frame.className = 'prive-embed';
    frame.title = 'Websites';
    frame.allow = 'clipboard-write; notifications';
    const q = new URLSearchParams({embed: 'tweb', tab: 'websites'});
    if(section) q.set('section', section);
    q.set('theme', document.documentElement.classList.contains('night') ? 'noir' : 'light');
    try {
      const pc = JSON.parse(localStorage.getItem('prive_connect') || 'null');
      if(pc && Date.now() - pc.at < 3600e3) { q.set('connect', pc.site); if(pc.listing) q.set('listing', pc.listing); }
      localStorage.removeItem('prive_connect');
    } catch(e) {}
    frame.src = '/app/?' + q.toString();
    if(!localStorage.getItem('prive_token')) import('@/prive/tglink').then((m) => m.priveAutoLink());
    this.scrollable.container.replaceWith(frame);
    // The embedded view asks us to go back (its own chat screen closed) or tells us prefs changed.
    const onMessage = (e: MessageEvent) => {
      if(e.origin !== location.origin || e.source !== frame.contentWindow || !e.data || !e.data.prive) return;
      if(e.data.prive === 'prefs') loadPrivePrefs(true);
      if(e.data.prive === 'site' && e.data.site) import('@/prive/siteSheet').then((m) => m.openSiteSheet(e.data.site));
      if(e.data.prive === 'inner') this.container.classList.toggle('prive-inner-open', !!e.data.open);
    };
    window.addEventListener('message', onMessage);
    this.middlewareHelper.get().onDestroy(() => window.removeEventListener('message', onMessage));
  }
}
