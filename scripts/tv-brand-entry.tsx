import { AppRegistry, Platform, Text, useWindowDimensions, View } from 'react-native';

import BrandScreen from '../app/(tabs)/brand';
import { BrandingProvider } from '../src/branding/BrandingProvider';
import { chrome } from '../src/theme/chrome';
import { tvTabBarHeight } from '../src/tv/controls';

Object.defineProperty(Platform, 'isTV', {
  configurable: true,
  get: () => true,
});

function Frame() {
  const { width, height } = useWindowDimensions();
  const tabBarHeight = tvTabBarHeight(height, 0, width);
  return (
    <View style={{ width, height, backgroundColor: chrome.bg }}>
      <View style={{ height: height - tabBarHeight, overflow: 'hidden' }}>
        <BrandingProvider>
          <BrandScreen />
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
        <Text style={{ color: chrome.muted, fontFamily: 'OswaldMedium', fontSize: Math.max(16, Math.round(28 * (height / 1080))) }}>Rounds</Text>
        <Text style={{ color: chrome.text, fontFamily: 'OswaldMedium', fontSize: Math.max(16, Math.round(28 * (height / 1080))) }}>Brand</Text>
      </View>
    </View>
  );
}

AppRegistry.registerComponent('Brand', () => Frame);
const rootTag = document.getElementById('root');
if (!rootTag) throw new Error('missing screenshot root');
AppRegistry.runApplication('Brand', {
  rootTag: rootTag,
});
