import { AppRegistry, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import CountdownScreen from '../app/countdown';
import SetupScreen from '../app/setup';
import BrandScreen from '../app/(tabs)/brand';
import WodScreen from '../app/(tabs)/index';
import RoundsScreen from '../app/(tabs)/rounds';
import { BrandingProvider } from '../src/branding/BrandingProvider';
import { TvTabBar } from '../src/components/TvTabBar';
import { TvTabFocusProvider } from '../src/components/TvTabFocus';
import { TimerSessionProvider } from '../src/session/TimerSession';
import { chrome } from '../src/theme/chrome';

Object.defineProperty(Platform, 'isTV', {
  configurable: true,
  get: () => true,
});

function Screen() {
  const tab = (globalThis as { __TV_TAB__?: string }).__TV_TAB__ ?? 'wod';
  if (tab === 'rounds' || tab === 'rounds-confirm') return <RoundsScreen />;
  if (tab === 'brand') return <BrandScreen />;
  if (tab === 'setup') return <SetupScreen />;
  if (tab === 'countdown') return <CountdownScreen />;
  return <WodScreen />;
}

function Frame() {
  const tab = (globalThis as { __TV_TAB__?: string }).__TV_TAB__ ?? 'wod';
  const stacked = tab === 'setup' || tab === 'countdown';
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: chrome.bg }}>
        <BrandingProvider>
          <TimerSessionProvider>
            <TvTabFocusProvider>
              {stacked ? null : <TvTabBar />}
              <View style={{ flex: 1, overflow: 'hidden' }}>
                <Screen />
              </View>
            </TvTabFocusProvider>
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
