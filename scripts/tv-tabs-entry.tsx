import { AppRegistry, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import CountdownScreen from '../app/countdown';
import SetupScreen from '../app/setup';
import TimerScreen from '../app/timer';
import BrandScreen from '../app/(tabs)/brand';
import WodScreen from '../app/(tabs)/index';
import { BrandingProvider } from '../src/branding/BrandingProvider';
import { TvTabBar } from '../src/components/TvTabBar';
import { TvTabFocusProvider } from '../src/components/TvTabFocus';
import { TimerSessionProvider } from '../src/session/TimerSession';
import { WatchLinkProvider } from '../src/watch/WatchLinkProvider';
import { chrome } from '../src/theme/chrome';

Object.defineProperty(Platform, 'isTV', {
  configurable: true,
  get: () => true,
});

// Apple TV reports ios. The preview matches that so the on-screen Back button stays off.
try {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => (globalThis as { __TV_OS__?: string }).__TV_OS__ ?? 'ios',
  });
} catch {
  (Platform as { OS: string }).OS = 'ios';
}

function Screen() {
  const tab = (globalThis as { __TV_TAB__?: string }).__TV_TAB__ ?? 'wod';
  if (tab === 'brand') return <BrandScreen />;
  if (tab === 'setup') return <SetupScreen />;
  if (tab === 'countdown') return <CountdownScreen />;
  if (tab === 'timer') return <TimerScreen />;
  return <WodScreen />;
}

function Frame() {
  const tab = (globalThis as { __TV_TAB__?: string }).__TV_TAB__ ?? 'wod';
  const frame = (globalThis as { __TV_FRAME__?: { width: number; height: number } }).__TV_FRAME__ ?? {
    width: 1920,
    height: 1080,
  };
  const stacked = tab === 'setup' || tab === 'countdown' || tab === 'timer';
  return (
    <SafeAreaProvider>
      <View style={{ width: frame.width, height: frame.height, backgroundColor: chrome.bg }}>
        <BrandingProvider>
          <TimerSessionProvider>
            <WatchLinkProvider>
            <TvTabFocusProvider>
              {stacked ? null : <TvTabBar />}
              <View style={{ flex: 1, width: frame.width, height: stacked ? frame.height : undefined }}>
                <Screen />
              </View>
            </TvTabFocusProvider>
            </WatchLinkProvider>
          </TimerSessionProvider>
        </BrandingProvider>
      </View>
    </SafeAreaProvider>
  );
}

AppRegistry.registerComponent('TvTabs', () => Frame);
const rootTag = document.getElementById('root');
if (!rootTag) throw new Error('missing screenshot root');
AppRegistry.runApplication('TvTabs', { rootTag });
