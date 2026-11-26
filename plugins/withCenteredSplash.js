const { withAndroidStyles, withDangerousMod, AndroidConfig } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Fire OS draws the splash bitmap from the start of the window unless the
 * layer-list item itself is gravity-centered with an explicit size. The mark
 * in splash-icon.png is already centered in the file.
 *
 * Info and dangerous mods run in reverse plugin order. List this plugin
 * before expo-splash-screen so this rewrite runs after that plugin's drawable.
 */
const SPLASH_DRAWABLE = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:drawable="@color/splashscreen_background" />
  <item
      android:gravity="center_horizontal|center_vertical"
      android:width="280dp"
      android:height="280dp">
    <bitmap
        android:gravity="fill"
        android:src="@drawable/splashscreen_logo" />
  </item>
</layer-list>
`;

function withCenteredSplash(config) {
  config = withDangerousMod(config, [
    'android',
    async (mod) => {
      const drawable = path.join(mod.modRequest.projectRoot, 'android/app/src/main/res/drawable/ic_launcher_background.xml');
      await fs.promises.mkdir(path.dirname(drawable), { recursive: true });
      await fs.promises.writeFile(drawable, SPLASH_DRAWABLE);
      return mod;
    },
  ]);

  return withAndroidStyles(config, (mod) => {
    mod.modResults = AndroidConfig.Styles.assignStylesValue(mod.modResults, {
      add: true,
      parent: { name: 'Theme.App.SplashScreen', parent: 'Theme.SplashScreen' },
      name: 'android:windowBackground',
      value: '@drawable/ic_launcher_background',
    });
    return mod;
  });
}

module.exports = withCenteredSplash;
module.exports.SPLASH_DRAWABLE = SPLASH_DRAWABLE;
