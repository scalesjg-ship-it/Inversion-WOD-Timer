const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');

const BEGIN = '// @generated begin americana-notification-raw-keep';
const END = '// @generated end americana-notification-raw-keep';

/**
 * expo-notifications resolves cue sounds with Resources.getIdentifier("raw", name).
 * The React Native release bundle writes res/raw/keep.xml and that file wins the
 * resource merge, so a second keep.xml in src/main is discarded and R8 resource
 * shrinking removes start/warning/bell/tick. Append those names to the generated
 * keep file before release resources are merged.
 */
function notificationSoundResources(config) {
  const plugins = config.plugins ?? [];
  for (const plugin of plugins) {
    if (Array.isArray(plugin) && plugin[0] === 'expo-notifications') {
      const sounds = plugin[1] && Array.isArray(plugin[1].sounds) ? plugin[1].sounds : [];
      return sounds.map((file) => `@raw/${path.parse(String(file)).name}`);
    }
  }
  return [];
}

function gradleBlock(resources) {
  const list = resources.map((name) => `"${name}"`).join(', ');
  return `${BEGIN}
afterEvaluate {
    tasks.matching { it.name == "mergeReleaseResources" }.configureEach { task ->
        task.doFirst {
            def keepFile = file("build/generated/res/react/release/raw/keep.xml")
            if (!keepFile.exists()) return
            def text = keepFile.getText("UTF-8")
            def missing = [${list}].findAll { name -> name && !text.contains(name) }
            if (!missing.isEmpty()) {
                keepFile.write(text.replace('tools:keep="', 'tools:keep="' + missing.join(',') + ','), "UTF-8")
            }
        }
    }
}
${END}
`;
}

function upsertGradleBlock(contents, block) {
  const pattern = new RegExp(`${BEGIN}[\\s\\S]*?${END}\\n?`);
  if (pattern.test(contents)) return contents.replace(pattern, block);
  return `${contents.trimEnd()}\n\n${block}`;
}

function withAndroidResourceKeeps(config) {
  config = withDangerousMod(config, [
    'android',
    (mod) => {
      const stale = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/raw/keep.xml');
      if (fs.existsSync(stale)) fs.unlinkSync(stale);
      return mod;
    },
  ]);

  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error('Americana notification resource keeps require the Groovy app/build.gradle.');
    }
    const resources = notificationSoundResources(mod);
    if (resources.length === 0) return mod;
    mod.modResults.contents = upsertGradleBlock(mod.modResults.contents, gradleBlock(resources));
    return mod;
  });
}

module.exports = withAndroidResourceKeeps;
module.exports.notificationSoundResources = notificationSoundResources;
module.exports.gradleBlock = gradleBlock;
module.exports.upsertGradleBlock = upsertGradleBlock;
