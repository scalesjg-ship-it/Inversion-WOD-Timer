const fs = require('fs');
const path = require('path');
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const MENU_SOURCE_FILE = 'AmericanaMenuCancel.m';
const repoRoot = path.resolve(__dirname, '..');

const SOURCE = `#import <UIKit/UIKit.h>
#import <objc/runtime.h>

// Compiled into the app. React ships as a prebuilt framework, so a patch of
// RCTTVRemoteHandler.m never reaches the tvOS binary. This swizzle does.
static BOOL americanaConsumeMenuPress = NO;
static void (*americanaOrigPressesBegan)(id, SEL, NSSet<UIPress *> *, UIPressesEvent *);
static void (*americanaOrigPressesEnded)(id, SEL, NSSet<UIPress *> *, UIPressesEvent *);
static UIViewController *(*americanaOrigPop)(id, SEL, BOOL);

static BOOL AmericanaPressesIncludeMenu(NSSet<UIPress *> *presses)
{
  if (!americanaConsumeMenuPress) {
    return NO;
  }
  for (UIPress *press in presses) {
    if (press.type == UIPressTypeMenu) {
      return YES;
    }
  }
  return NO;
}

static void AmericanaPostMenu(void)
{
  [[NSNotificationCenter defaultCenter] postNotificationName:@"RCTTVNavigationEventNotification"
                                                      object:@{@"eventType": @"menu"}];
}

static void AmericanaPressesBegan(id self, SEL cmd, NSSet<UIPress *> *presses, UIPressesEvent *event)
{
  if (AmericanaPressesIncludeMenu(presses)) {
    AmericanaPostMenu();
    return;
  }
  americanaOrigPressesBegan(self, cmd, presses, event);
}

static void AmericanaPressesEnded(id self, SEL cmd, NSSet<UIPress *> *presses, UIPressesEvent *event)
{
  if (AmericanaPressesIncludeMenu(presses)) {
    return;
  }
  americanaOrigPressesEnded(self, cmd, presses, event);
}

static UIViewController *AmericanaPop(id self, SEL cmd, BOOL animated)
{
  if (americanaConsumeMenuPress) {
    AmericanaPostMenu();
    return nil;
  }
  return americanaOrigPop(self, cmd, animated);
}

static void AmericanaInstallPressSwizzle(Class cls, SEL sel, IMP replacement, void (**original)(id, SEL, NSSet<UIPress *> *, UIPressesEvent *))
{
  Method existing = class_getInstanceMethod(cls, sel);
  Method inherited = class_getInstanceMethod(class_getSuperclass(cls), sel);
  if (existing == inherited) {
    class_addMethod(cls, sel, replacement, method_getTypeEncoding(existing));
    *original = (void *)method_getImplementation(inherited);
    return;
  }
  *original = (void *)method_setImplementation(existing, replacement);
}

@interface AmericanaMenuCancel : NSObject
@end

@implementation AmericanaMenuCancel

+ (void)load
{
  [[NSNotificationCenter defaultCenter] addObserverForName:@"RCTTVEnableMenuKeyNotification"
                                                    object:nil
                                                     queue:nil
                                                usingBlock:^(__unused NSNotification *note) {
                                                  americanaConsumeMenuPress = YES;
                                                }];
  [[NSNotificationCenter defaultCenter] addObserverForName:@"RCTTVDisableMenuKeyNotification"
                                                    object:nil
                                                     queue:nil
                                                usingBlock:^(__unused NSNotification *note) {
                                                  americanaConsumeMenuPress = NO;
                                                }];
  Class nav = NSClassFromString(@"UINavigationController");
  if (nav == Nil) {
    return;
  }
  AmericanaInstallPressSwizzle(nav, @selector(pressesBegan:withEvent:), (IMP)AmericanaPressesBegan, &americanaOrigPressesBegan);
  AmericanaInstallPressSwizzle(nav, @selector(pressesEnded:withEvent:), (IMP)AmericanaPressesEnded, &americanaOrigPressesEnded);
  Method pop = class_getInstanceMethod(nav, @selector(popViewControllerAnimated:));
  americanaOrigPop = (UIViewController *(*)(id, SEL, BOOL))method_getImplementation(pop);
  method_setImplementation(pop, (IMP)AmericanaPop);
}

@end
`;

function isTvBuild(env = process.env) {
  return env.EXPO_TV === '1' || env.EXPO_TV === 'true';
}

function xcodeprojFolderNames(iosDirectory) {
  if (!fs.existsSync(iosDirectory)) return [];
  return fs
    .readdirSync(iosDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('.xcodeproj') && entry.name !== 'Pods.xcodeproj')
    .map((entry) => entry.name.slice(0, -'.xcodeproj'.length))
    .sort();
}

/**
 * Folder under ios/ that holds the app sources. Prefer the prebuilt
 * xcodeproj name. Fall back to the same sanitization Expo applies to expo.name.
 */
function iosProjectFolderName(iosDirectory, appJsonPath = path.join(repoRoot, 'app.json')) {
  const folders = xcodeprojFolderNames(iosDirectory);
  if (folders.length > 1) {
    throw new Error(`Expected one Xcode project under ${iosDirectory}, found ${folders.join(', ')}`);
  }
  if (folders.length === 1) return folders[0];
  const app = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const name = app?.expo?.name;
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error(`expo.name is missing in ${appJsonPath}`);
  }
  return IOSConfig.XcodeUtils.sanitizedName(name);
}

function menuCancelFilePath(folderName) {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(folderName)) {
    throw new Error(`Unexpected iOS project folder name ${JSON.stringify(folderName)}`);
  }
  return `${folderName}/${MENU_SOURCE_FILE}`;
}

function assertAppGroup(project, projectName) {
  const mainKey = project.getFirstProject().firstProject.mainGroup;
  const main = project.getPBXGroupByKey(mainKey);
  const child = (main?.children || []).find((entry) => entry.comment === projectName);
  if (!child || !project.getPBXGroupByKey(child.value)) {
    throw new Error(`Xcode project is missing the ${projectName} source group`);
  }
}

function stripUndefinedMenuFields(project) {
  const files = project.pbxFileReferenceSection();
  for (const key of Object.keys(files)) {
    if (key.endsWith('_comment')) continue;
    const entry = files[key];
    const filePath = String(entry.path || '').replace(/^"|"$/g, '');
    if (!filePath.endsWith(`/${MENU_SOURCE_FILE}`)) continue;
    for (const field of Object.keys(entry)) {
      if (entry[field] === undefined) delete entry[field];
    }
  }
}

/**
 * Compile the Menu swizzle into the application target. Writing the .m file
 * is not enough: the Apple TV TestFlight archive never runs the UI-test
 * script, so the plugin has to add the source itself.
 */
function addMenuCancelSource(project, projectName) {
  assertAppGroup(project, projectName);
  const target = IOSConfig.XcodeUtils.getApplicationNativeTarget({ project, projectName });
  IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
    filepath: menuCancelFilePath(projectName),
    groupName: projectName,
    project,
    targetUuid: target.uuid,
  });
  stripUndefinedMenuFields(project);
  return project;
}

function linkMenuCancel(project, projectName, env = process.env) {
  if (!isTvBuild(env)) return project;
  return addMenuCancelSource(project, projectName);
}

function appDirectory(ios) {
  return fs
    .readdirSync(ios, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(ios, entry.name))
    .find((dir) => fs.existsSync(path.join(dir, 'AppDelegate.swift')));
}

function withTvMenuKey(config) {
  config = withXcodeProject(config, (mod) => {
    if (!isTvBuild()) return mod;
    const projectName = mod.modRequest.projectName || IOSConfig.XcodeUtils.sanitizedName(mod.name || '');
    if (!projectName) {
      throw new Error('Could not resolve the iOS project name for the Menu press swizzle.');
    }
    linkMenuCancel(mod.modResults, projectName);
    return mod;
  });
  return withDangerousMod(config, [
    'ios',
    (mod) => {
      const ios = mod.modRequest.platformProjectRoot;
      const appDir = appDirectory(ios);
      if (!appDir) {
        throw new Error('Could not find the iOS app directory for the Menu press swizzle.');
      }
      const projectName = mod.modRequest.projectName;
      if (projectName && path.basename(appDir) !== projectName) {
        throw new Error(`Menu swizzle directory ${path.basename(appDir)} does not match the iOS project ${projectName}.`);
      }
      fs.writeFileSync(path.join(appDir, MENU_SOURCE_FILE), SOURCE);
      return mod;
    },
  ]);
}

module.exports = withTvMenuKey;
module.exports.addMenuCancelSource = addMenuCancelSource;
module.exports.iosProjectFolderName = iosProjectFolderName;
module.exports.isTvBuild = isTvBuild;
module.exports.linkMenuCancel = linkMenuCancel;
module.exports.MENU_SOURCE_FILE = MENU_SOURCE_FILE;
module.exports.menuCancelFilePath = menuCancelFilePath;
