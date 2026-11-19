const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

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

function withTvMenuKey(config) {
  return withDangerousMod(config, [
    'ios',
    (mod) => {
      const ios = mod.modRequest.platformProjectRoot;
      const appDir = fs
        .readdirSync(ios, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(ios, entry.name))
        .find((dir) => fs.existsSync(path.join(dir, 'AppDelegate.swift')));
      if (!appDir) {
        throw new Error('Could not find the iOS app directory for the Menu press swizzle.');
      }
      fs.writeFileSync(path.join(appDir, 'AmericanaMenuCancel.m'), SOURCE);
      return mod;
    },
  ]);
}

module.exports = withTvMenuKey;
