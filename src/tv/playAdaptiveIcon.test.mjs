import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { restoreAdaptiveLauncherIcon } = require('../../plugins/withPlayAdaptiveIcon.js');

function manifest(icon) {
  return {
    manifest: {
      application: [
        {
          $: {
            'android:icon': icon,
            'android:banner': '@drawable/tv_banner',
            'android:roundIcon': '@mipmap/ic_launcher_round',
          },
        },
      ],
    },
  };
}

describe('Play adaptive icon restore', () => {
  it('puts the adaptive icon back when config-tv selected the wide TV drawable', () => {
    const result = restoreAdaptiveLauncherIcon(manifest('@drawable/tv_icon'));
    const attrs = result.manifest.application[0].$;
    expect(attrs['android:icon']).toBe('@mipmap/ic_launcher');
    expect(attrs['android:banner']).toBe('@drawable/tv_banner');
    expect(attrs['android:roundIcon']).toBe('@mipmap/ic_launcher_round');
  });

  it('leaves an icon that is already the adaptive launcher', () => {
    const result = restoreAdaptiveLauncherIcon(manifest('@mipmap/ic_launcher'));
    expect(result.manifest.application[0].$['android:icon']).toBe('@mipmap/ic_launcher');
  });

  it('does nothing when the manifest has no application', () => {
    const empty = { manifest: {} };
    expect(restoreAdaptiveLauncherIcon(empty)).toBe(empty);
  });
});
