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

// SUPABASE_URL and SUPABASE_ANON_KEY are placeholders until the build environment sets them.
// The anon key is the public client key. Never put the service role key here.
const supabaseUrl = typeof process.env.SUPABASE_URL === 'string' ? process.env.SUPABASE_URL.trim() : '';
const supabaseAnonKey = typeof process.env.SUPABASE_ANON_KEY === 'string' ? process.env.SUPABASE_ANON_KEY.trim() : '';

module.exports = {
  expo: {
    ...app.expo,
    plugins,
    extra: {
      ...app.expo.extra,
      supabaseUrl,
      supabaseAnonKey,
    },
  },
};
