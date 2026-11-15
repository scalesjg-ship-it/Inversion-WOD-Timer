import { AppRegistry, Platform, Text, View } from 'react-native';

import BrandScreen from '../app/(tabs)/brand';
import { BrandingProvider } from '../src/branding/BrandingProvider';
import { chrome } from '../src/theme/chrome';
import { tvTabBarHeight } from '../src/tv/controls';

Object.defineProperty(Platform, 'isTV', {
  configurable: true,
  get: () => true,
});

const tabBarHeight = tvTabBarHeight(1080, 0, 1920);

function Frame() {
  return (
    <View style={{ width: 1920, height: 1080, backgroundColor: chrome.bg }}>
      <View style={{ height: 1080 - tabBarHeight, overflow: 'hidden' }}>
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
        <Text style={{ color: chrome.muted, fontFamily: 'OswaldMedium', fontSize: 28 }}>WOD</Text>
        <Text style={{ color: chrome.muted, fontFamily: 'OswaldMedium', fontSize: 28 }}>Rounds</Text>
        <Text style={{ color: chrome.text, fontFamily: 'OswaldMedium', fontSize: 28 }}>Brand</Text>
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
