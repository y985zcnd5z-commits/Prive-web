/*
 * Prive tabs inside Telegram's left column (same slider, header and back button as Telegram's own tabs).
 *  - PriveWebsitesTab: the single "Websites" entry (Website Connect chats + saved websites; for administrators also
 *    the connected site(s) with the moderator tools). Its content is the Prive server view, full height, no extra header.
 *  - PriveModeTab: Client / Website administrator, as Telegram radio rows.
 */
import {render} from 'solid-js/web';
import {For} from 'solid-js';
import {SliderSuperTab} from '@components/slider';
import Row from '@components/rowTsx';
import Section from '@components/section';
import {IconTsx} from '@components/iconTsx';
import {priveMode, setPriveMode, PriveMode, loadPrivePrefs} from '@/prive/api';

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
    frame.src = '/app/?' + q.toString();
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

export class PriveModeTab extends SliderSuperTab {
  public init() {
    this.title.replaceChildren(document.createTextNode('Prive mode'));
    const div = document.createElement('div');
    const modes: [PriveMode, string, string, Icon][] = [
      ['client', 'Client', 'Chat with advertisers from websites; your websites as tabs above your chats', 'person_filled'],
      ['admin', 'Website administrator', 'Connect your website, monitor and take over its chats, reply as advertiser, assistant or team', 'admin_filled']
    ];
    const dispose = render(() => {
      const current = () => priveMode();
      return (
        <Section caption={<span>You can switch at any time. Your Telegram chats are not affected.</span>}>
          <For each={modes}>{([mode, title, sub, icon]) => (
            <Row clickable={() => setPriveMode(mode)}>
              <Row.Icon icon={icon} />
              <Row.Title titleRight={current() === mode ? <IconTsx icon="check" class="prive-check" /> : undefined}>{title}</Row.Title>
              <Row.Subtitle>{sub}</Row.Subtitle>
            </Row>
          )}</For>
        </Section>
      );
    }, div);
    this.scrollable.append(div);
    this.middlewareHelper.get().onDestroy(dispose);
  }
}
