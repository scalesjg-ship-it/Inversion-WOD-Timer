import { AppRegistry, Platform, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import BrandScreen from '../app/(tabs)/brand';
import { BrandingProvider } from '../src/branding/BrandingProvider';
import { PreferencesProvider } from '../src/preferences/PreferencesProvider';
import { chrome } from '../src/theme/chrome';
import { tvTabBarHeight } from '../src/tv/controls';

const previewTv = (globalThis as { __AMERICANA_PREVIEW_TV?: boolean }).__AMERICANA_PREVIEW_TV !== false;

Object.defineProperty(Platform, 'isTV', {
  configurable: true,
  get: () => previewTv,
});

function PhoneFrame() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: chrome.bg }}>
        <BrandingProvider>
          <PreferencesProvider>
            <BrandScreen />
          </PreferencesProvider>
        </BrandingProvider>
      </View>
    </SafeAreaProvider>
  );
}

function Frame() {
  const { width, height } = useWindowDimensions();
  if (!previewTv) return <PhoneFrame />;
  const tabBarHeight = tvTabBarHeight(height, 0, width);
  return (
    <SafeAreaProvider>
    <View style={{ width, height, backgroundColor: chrome.bg }}>
      <View style={{ height: height - tabBarHeight, overflow: 'hidden' }}>
        <BrandingProvider>
          <PreferencesProvider>
            <BrandScreen />
          </PreferencesProvider>
        </BrandingProvider>
      </View>
      <View
        style={{
          height: tabBarHeight,
          borderTopWidth: 2,
          borderTopColor: chrome.line,
          backgroundColor: chrome.bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
        }}
      >
        <Text style={{ color: chrome.muted, fontFamily: 'OswaldMedium', fontSize: Math.max(16, Math.round(28 * (height / 1080))) }}>WOD</Text>
        <Text style={{ color: chrome.text, fontFamily: 'OswaldMedium', fontSize: Math.max(16, Math.round(28 * (height / 1080))) }}>Settings</Text>
        <Text style={{ color: chrome.muted, fontFamily: 'OswaldMedium', fontSize: Math.max(16, Math.round(28 * (height / 1080))) }}>Help</Text>
      </View>
    </View>
    </SafeAreaProvider>
  );
}

AppRegistry.registerComponent('Brand', () => Frame);
const rootTag = document.getElementById('root');
if (!rootTag) throw new Error('missing screenshot root');
AppRegistry.runApplication('Brand', {
  rootTag: rootTag,
});
