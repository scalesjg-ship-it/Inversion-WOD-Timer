const fs = require('fs');
const path = require('path');

const app = require('./app.json');

const extraProguardRules = fs.readFileSync(path.join(__dirname, 'plugins/android-r8-rules.pro'), 'utf8');

const plugins = app.expo.plugins.map((plugin) => {
  const isBuildProperties =
    plugin === 'expo-build-properties' || (Array.isArray(plugin) && plugin[0] === 'expo-build-properties');
  if (!isBuildProperties) return plugin;
  const current = Array.isArray(plugin) ? (plugin[1] ?? {}) : {};
  return [
    'expo-build-properties',
    {
      ...current,
      android: {
        ...(current.android ?? {}),
        enableMinifyInReleaseBuilds: true,
        enableShrinkResourcesInReleaseBuilds: true,
        extraProguardRules,
      },
    },
  ];
});

module.exports = {
  expo: {
    ...app.expo,
    plugins,
  },
};
