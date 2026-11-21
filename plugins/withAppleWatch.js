const { withInfoPlist, withXcodeProject } = require('expo/config-plugins');

/**
 * Apple Watch companion for the iPhone app, plus the tvOS application service
 * the watch listens for.
 *
 * DeviceDiscoveryUI browses from tvOS and the watch advertises. The watch app is
 * embedded in the iPhone target only. EXPO_TV=1 prebuilds stay a single
 * com.garrettscales.americana bundle so the signed TestFlight workflow still
 * matches its profile check. @bacons/apple-targets is not used: it would add
 * the watch target to that tvOS project.
 */

const WATCH_BUNDLE_ID = 'com.garrettscales.americana.watchkitapp';
const WATCH_TARGET = 'AmericanaWatch';
const WATCH_SERVICE = 'Americana-Timer';

const WATCH_SOURCES = [
  'WatchApp.swift',
  'WatchSession.swift',
  'TimerFace.swift',
];

function isTvBuild(env = process.env) {
  return env.EXPO_TV === '1' || env.EXPO_TV === 'true';
}

const IOS_BUILD_NUMBER_PATTERN = /^[1-9]\d{0,8}$/;

/**
 * iPhone TestFlight passes IOS_BUILD_NUMBER. app.json stays 1.0.0 (18).
 * A tvOS prebuild ignores it so the Apple TV workflow is unchanged.
 */
function resolveIosArchiveBuild(env = process.env) {
  if (isTvBuild(env)) return null;
  const raw = env.IOS_BUILD_NUMBER;
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return null;
  if (!IOS_BUILD_NUMBER_PATTERN.test(text)) {
    throw new Error(
      `IOS_BUILD_NUMBER must be a positive integer CFBundleVersion with no leading zero (got ${JSON.stringify(text)})`,
    );
  }
  return text;
}

function tvApplicationServices() {
  return {
    Browses: [
      {
        NSApplicationServiceIdentifier: WATCH_SERVICE,
        NSApplicationServiceUsageDescription:
          'Americana finds your Apple Watch on this Wi-Fi so you can start, pause, and reset the gym timer from your wrist. Timer state stays between the watch and this TV and is not sent to a server.',
        NSApplicationServicePlatformSupport: ['watchOS'],
      },
    ],
  };
}

function unquote(value) {
  return String(value ?? '').replace(/^"|"$/g, '');
}

function targetNamed(project, name) {
  const section = project.pbxNativeTargetSection();
  for (const key of Object.keys(section)) {
    if (key.endsWith('_comment')) continue;
    if (unquote(section[key].name) === name) return key;
  }
  return null;
}

function watchBuildSettings(marketingVersion, buildNumber) {
  return {
    ASSETCATALOG_COMPILER_APPICON_NAME: 'AppIcon',
    CODE_SIGN_STYLE: 'Automatic',
    CURRENT_PROJECT_VERSION: `"${buildNumber}"`,
    ENABLE_PREVIEWS: 'YES',
    GENERATE_INFOPLIST_FILE: 'NO',
    INFOPLIST_FILE: '"../targets/watch/Info.plist"',
    LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks"',
    MARKETING_VERSION: `"${marketingVersion}"`,
    PRODUCT_BUNDLE_IDENTIFIER: `"${WATCH_BUNDLE_ID}"`,
    PRODUCT_NAME: `"${WATCH_TARGET}"`,
    SDKROOT: 'watchos',
    SKIP_INSTALL: 'YES',
    SUPPORTED_PLATFORMS: '"watchos watchsimulator"',
    SUPPORTS_MACCATALYST: 'NO',
    SWIFT_VERSION: '5.0',
    TARGETED_DEVICE_FAMILY: '4',
    WATCHOS_DEPLOYMENT_TARGET: '9.0',
  };
}

function applyWatchSettings(project, marketingVersion, buildNumber) {
  const settings = watchBuildSettings(marketingVersion, buildNumber);
  const configs = project.pbxXCBuildConfigurationSection();
  for (const key of Object.keys(configs)) {
    if (key.endsWith('_comment')) continue;
    const buildSettings = configs[key].buildSettings;
    if (!buildSettings) continue;
    if (unquote(buildSettings.PRODUCT_BUNDLE_IDENTIFIER) !== WATCH_BUNDLE_ID) continue;
    Object.assign(buildSettings, settings);
    delete buildSettings.IPHONEOS_DEPLOYMENT_TARGET;
  }
}

function dropUndefined(project) {
  const objects = project.hash.project.objects;
  for (const section of Object.values(objects)) {
    if (!section || typeof section !== 'object') continue;
    for (const key of Object.keys(section)) {
      const entry = section[key];
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      for (const field of Object.keys(entry)) {
        if (entry[field] === undefined) delete entry[field];
      }
    }
  }
}

function addWatchDependency(project, hostUuid, watchUuid) {
  const objects = project.hash.project.objects;
  if (!objects.PBXTargetDependency) objects.PBXTargetDependency = {};
  if (!objects.PBXContainerItemProxy) objects.PBXContainerItemProxy = {};
  const watch = project.pbxNativeTargetSection()[watchUuid];
  const host = project.pbxNativeTargetSection()[hostUuid];
  const proxyId = project.generateUuid();
  const depId = project.generateUuid();
  objects.PBXContainerItemProxy[proxyId] = {
    isa: 'PBXContainerItemProxy',
    containerPortal: project.hash.project.rootObject,
    containerPortal_comment: 'Project object',
    proxyType: 1,
    remoteGlobalIDString: watchUuid,
    remoteInfo: watch.name,
  };
  objects.PBXContainerItemProxy[`${proxyId}_comment`] = 'PBXContainerItemProxy';
  objects.PBXTargetDependency[depId] = {
    isa: 'PBXTargetDependency',
    target: watchUuid,
    target_comment: watch.name,
    targetProxy: proxyId,
    targetProxy_comment: 'PBXContainerItemProxy',
  };
  objects.PBXTargetDependency[`${depId}_comment`] = 'PBXTargetDependency';
  host.dependencies.push({ value: depId, comment: 'PBXTargetDependency' });
}

function ensureEmbed(project, productName) {
  const host = project.getFirstTarget().uuid;
  const phases = project.hash.project.objects.PBXCopyFilesBuildPhase || {};
  for (const key of Object.keys(phases)) {
    if (key.endsWith('_comment')) continue;
    if (unquote(phases[key].name) === 'Embed Watch Content') return;
  }
  project.addBuildPhase(
    [],
    'PBXCopyFilesBuildPhase',
    'Embed Watch Content',
    host,
    'watch2_app',
    '"$(CONTENTS_FOLDER_PATH)/Watch"',
  );
  const created = project.hash.project.objects.PBXCopyFilesBuildPhase;
  let phase = null;
  for (const key of Object.keys(created)) {
    if (key.endsWith('_comment')) continue;
    if (unquote(created[key].name) === 'Embed Watch Content') phase = created[key];
  }
  if (!phase) return;
  const files = project.pbxFileReferenceSection();
  const builds = project.pbxBuildFileSection();
  let fileRef = null;
  for (const key of Object.keys(files)) {
    if (key.endsWith('_comment')) continue;
    const path = unquote(files[key].path || files[key].name);
    if (path === productName) fileRef = key;
  }
  if (!fileRef) return;
  let buildFile = null;
  for (const key of Object.keys(builds)) {
    if (key.endsWith('_comment')) continue;
    if (builds[key].fileRef === fileRef) buildFile = key;
  }
  if (!buildFile) return;
  builds[buildFile].settings = { ATTRIBUTES: ['RemoveHeadersOnCopy', 'CodeSignOnCopy'] };
  phase.files.push({ value: buildFile, comment: `${productName} in Embed Watch Content` });
}

/**
 * Add the watch app to an iPhone Xcode project. No-op when the target exists.
 * Returns the project so tests can inspect it.
 */
function linkWatchTarget(project, versions) {
  if (targetNamed(project, WATCH_TARGET)) return project;
  const target = project.addTarget(WATCH_TARGET, 'application', WATCH_TARGET, WATCH_BUNDLE_ID);
  project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
  project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
  project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);

  const group = project.addPbxGroup([], WATCH_TARGET, '../targets/watch');
  const main = project.getFirstProject().firstProject.mainGroup;
  project.getPBXGroupByKey(main).children.push({ value: group.uuid, comment: WATCH_TARGET });

  for (const file of WATCH_SOURCES) {
    project.addSourceFile(file, { target: target.uuid }, group.uuid);
  }
  project.addSourceFile(
    '../modules/americana-watch-link/ios/WatchWire.swift',
    { target: target.uuid, sourceTree: 'SOURCE_ROOT' },
    group.uuid,
  );
  project.addResourceFile('Assets.xcassets', { target: target.uuid }, group.uuid);
  applyWatchSettings(project, versions.marketingVersion, versions.buildNumber);
  ensureEmbed(project, `${WATCH_TARGET}.app`);
  addWatchDependency(project, project.getFirstTarget().uuid, target.uuid);
  dropUndefined(project);
  return project;
}

function withAppleWatch(config) {
  const marketingVersion = config.version || '1.0.0';
  const archiveBuild = resolveIosArchiveBuild();
  const buildNumber = archiveBuild || config.ios?.buildNumber || '1';
  config = withInfoPlist(config, (mod) => {
    if (isTvBuild()) {
      mod.modResults.NSApplicationServices = tvApplicationServices();
      return mod;
    }
    if (archiveBuild) {
      mod.modResults.CFBundleVersion = archiveBuild;
    }
    return mod;
  });
  return withXcodeProject(config, (mod) => {
    if (isTvBuild()) return mod;
    linkWatchTarget(mod.modResults, { marketingVersion, buildNumber });
    return mod;
  });
}

module.exports = withAppleWatch;
module.exports.isTvBuild = isTvBuild;
module.exports.tvApplicationServices = tvApplicationServices;
module.exports.linkWatchTarget = linkWatchTarget;
module.exports.WATCH_BUNDLE_ID = WATCH_BUNDLE_ID;
module.exports.WATCH_SERVICE = WATCH_SERVICE;
module.exports.resolveIosArchiveBuild = resolveIosArchiveBuild;
