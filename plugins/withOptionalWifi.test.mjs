import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const { setWifiFeatureOptional } = createRequire(import.meta.url)('./withOptionalWifi.js');
const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));

function manifest(features) {
  return { manifest: features === undefined ? {} : { 'uses-feature': features } };
}

describe('setWifiFeatureOptional', () => {
  it('is registered before config-tv', () => {
    const plugins = app.expo.plugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));
    const wifi = plugins.indexOf('./plugins/withOptionalWifi');
    const tv = plugins.indexOf('@react-native-tvos/config-tv');
    expect(wifi).toBeGreaterThan(-1);
    expect(tv).toBeGreaterThan(wifi);
  });

  it('adds android.hardware.wifi with required=false', () => {
    const result = setWifiFeatureOptional(manifest(undefined));
    expect(result.manifest['uses-feature']).toEqual([
      {
        $: {
          'android:name': 'android.hardware.wifi',
          'android:required': 'false',
        },
      },
    ]);
  });

  it('leaves touchscreen, faketouch, and leanback unchanged', () => {
    const tv = [
      { $: { 'android:name': 'android.hardware.touchscreen', 'android:required': 'false' } },
      { $: { 'android:name': 'android.hardware.faketouch', 'android:required': 'false' } },
      { $: { 'android:name': 'android.software.leanback', 'android:required': 'true' } },
    ];
    const result = setWifiFeatureOptional(manifest(tv.map((item) => ({ $: { ...item.$ } }))));
    const features = result.manifest['uses-feature'];
    expect(features.slice(0, 3)).toEqual(tv);
    expect(features).toHaveLength(4);
    expect(features[3].$).toEqual({
      'android:name': 'android.hardware.wifi',
      'android:required': 'false',
    });
  });

  it('sets an existing wifi feature to optional without adding a second entry', () => {
    const result = setWifiFeatureOptional(
      manifest([
        { $: { 'android:name': 'android.hardware.wifi', 'android:required': 'true' } },
        { $: { 'android:name': 'android.software.leanback', 'android:required': 'false' } },
      ]),
    );
    expect(result.manifest['uses-feature']).toEqual([
      { $: { 'android:name': 'android.hardware.wifi', 'android:required': 'false' } },
      { $: { 'android:name': 'android.software.leanback', 'android:required': 'false' } },
    ]);
  });
});
