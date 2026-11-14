const { AndroidConfig, withAndroidStyles } = require('expo/config-plugins');

/**
 * Light status and navigation icons for the dark phone UI.
 * SDK 58 already forces transparent system bars and ignores
 * androidStatusBar backgroundColor/translucent. This plugin only sets icon
 * appearance, which is not a deprecated edge-to-edge API, and it does not
 * touch iOS or tvOS.
 */
function setLightSystemBarIcons(styles) {
  const parent = AndroidConfig.Styles.getAppThemeGroup();
  let next = AndroidConfig.Styles.assignStylesValue(styles, {
    add: true,
    parent,
    name: 'android:windowLightStatusBar',
    value: 'false',
  });
  next = AndroidConfig.Styles.assignStylesValue(next, {
    add: true,
    parent,
    name: 'android:windowLightNavigationBar',
    value: 'false',
  });
  return next;
}

function withAndroidSystemBars(config) {
  return withAndroidStyles(config, (mod) => {
    mod.modResults = setLightSystemBarIcons(mod.modResults);
    return mod;
  });
}

module.exports = withAndroidSystemBars;
module.exports.setLightSystemBarIcons = setLightSystemBarIcons;
