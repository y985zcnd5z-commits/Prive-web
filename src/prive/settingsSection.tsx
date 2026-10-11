/*
 * Prive rows inside Telegram's own Settings screen (one Settings menu for Telegram and Prive).
 */
import {createSignal, onCleanup, onMount, Show} from 'solid-js';
import Row from '@components/rowTsx';
import Section from '@components/section';
import {toast} from '@components/toast';
import themeController from '@helpers/themeController';
import rootScope from '@lib/rootScope';
import {priveSignedIn, loadPrivePrefs, pushIsOn, setPush, pushSupported} from '@/prive/api';
import {PriveWebsitesTab} from '@/prive/tabs';
import type SidebarSlider from '@components/slider';

export default function PriveSettingsSection(props: {slider: SidebarSlider}) {
  const [push, setPushState] = createSignal(false);
  const [night, setNight] = createSignal(themeController.isNight());
  onMount(() => {
    loadPrivePrefs();
    pushIsOn().then(setPushState);
  });
  const onTheme = () => setNight(themeController.isNight());
  rootScope.addEventListener('theme_changed', onTheme);
  onCleanup(() => rootScope.removeEventListener('theme_changed', onTheme));

  const text = (s: string) => document.createTextNode(s) as any;
  const toggleTheme = () => themeController.switchTheme(night() ? 'day' : 'night');
  const togglePush = async() => {
    const err = await setPush(!push());
    if(err) toast(err);
    setPushState(await pushIsOn());
  };

  return (
    <Section name={<span>Prive</span>} caption={<span>Prive · unofficial Telegram client · not affiliated with Telegram</span>}>
      <Row clickable={() => props.slider.createTab(PriveWebsitesTab).open()}>
        <Row.Icon icon="web_filled" />
        <Row.Title titleRight={priveSignedIn() ? undefined : text('Sign in')} titleRightSecondary>{text('Websites')}</Row.Title>
      </Row>
      <Show when={pushSupported()}>
        <Row clickable={togglePush}>
          <Row.Icon icon="bell_filled" />
          <Row.Title titleRight={text(push() ? 'On' : 'Off')} titleRightSecondary>{text('Notifications')}</Row.Title>
        </Row>
      </Show>
      <Row clickable={toggleTheme}>
        <Row.Icon icon="darkmode_filled" />
        <Row.Title titleRight={text(night() ? 'Noir' : 'Light')} titleRightSecondary>{text('Appearance')}</Row.Title>
      </Row>
    </Section>
  );
}
