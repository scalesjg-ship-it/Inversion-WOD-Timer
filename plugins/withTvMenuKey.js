const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const MARKER = 'AMERICANA_TV_MENU_CANCEL';

const ENABLE_BEFORE = `- (void)enableTVMenuKey
{
    dispatch_async(dispatch_get_main_queue(), ^{
        if (![[self.view gestureRecognizers] containsObject:self.tvMenuKeyRecognizer]) {
            [self.view addGestureRecognizer:self.tvMenuKeyRecognizer];
        }
    });
}`;

const ENABLE_AFTER = `- (void)enableTVMenuKey
{
    // ${MARKER}: own Menu while the timer is open. UIKit pops on pressesEnded unless this runs first.
    americanaConsumeMenuPress = YES;
    AmericanaInstallMenuPressSwizzle();
    dispatch_async(dispatch_get_main_queue(), ^{
        self.tvMenuKeyRecognizer.cancelsTouchesInView = YES;
        if (![[self.view gestureRecognizers] containsObject:self.tvMenuKeyRecognizer]) {
            [self.view addGestureRecognizer:self.tvMenuKeyRecognizer];
        }
    });
}`;

const DISABLE_BEFORE = `- (void)disableTVMenuKey
{
    dispatch_async(dispatch_get_main_queue(), ^{
        if ([[self.view gestureRecognizers] containsObject:self.tvMenuKeyRecognizer]) {
            [self.view removeGestureRecognizer:self.tvMenuKeyRecognizer];
        }
    });
}`;

const DISABLE_AFTER = `- (void)disableTVMenuKey
{
    americanaConsumeMenuPress = NO;
    dispatch_async(dispatch_get_main_queue(), ^{
        if ([[self.view gestureRecognizers] containsObject:self.tvMenuKeyRecognizer]) {
            [self.view removeGestureRecognizer:self.tvMenuKeyRecognizer];
        }
    });
}`;

const IMPORT = '#import <objc/runtime.h>\n';

const CATEGORY = `
static BOOL americanaConsumeMenuPress = NO;

static void AmericanaInstallMenuPressSwizzle(void)
{
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    Class cls = UIViewController.class;
    SEL began = @selector(pressesBegan:withEvent:);
    SEL beganSwizzled = @selector(americana_tvPressesBegan:withEvent:);
    method_exchangeImplementations(class_getInstanceMethod(cls, began), class_getInstanceMethod(cls, beganSwizzled));
    SEL ended = @selector(pressesEnded:withEvent:);
    SEL endedSwizzled = @selector(americana_tvPressesEnded:withEvent:);
    method_exchangeImplementations(class_getInstanceMethod(cls, ended), class_getInstanceMethod(cls, endedSwizzled));
  });
}

@interface UIViewController (AmericanaMenuCancel)
- (void)americana_tvPressesBegan:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event;
- (void)americana_tvPressesEnded:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event;
@end

@implementation UIViewController (AmericanaMenuCancel)

- (BOOL)americana_pressesIncludeMenu:(NSSet<UIPress *> *)presses
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

- (void)americana_tvPressesBegan:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
  if ([self americana_pressesIncludeMenu:presses]) {
    [[NSNotificationCenter defaultCenter] postNavigationPressEventWithType:RCTTVRemoteEventMenu
                                                                 keyAction:nil
                                                                       tag:nil
                                                                    target:nil];
    return;
  }
  [self americana_tvPressesBegan:presses withEvent:event];
}

- (void)americana_tvPressesEnded:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
  if ([self americana_pressesIncludeMenu:presses]) {
    return;
  }
  [self americana_tvPressesEnded:presses withEvent:event];
}

@end
`;

function patchMenuKey(source) {
  if (source.includes(MARKER)) return source;
  if (!source.includes(ENABLE_BEFORE) || !source.includes(DISABLE_BEFORE)) {
    throw new Error('RCTTVRemoteHandler menu methods changed. Update plugins/withTvMenuKey.js.');
  }
  let next = source.replace(ENABLE_BEFORE, ENABLE_AFTER).replace(DISABLE_BEFORE, DISABLE_AFTER);
  if (!next.includes('#import <objc/runtime.h>')) {
    next = next.replace('#import "RCTTVRemoteHandler.h"\n', `#import "RCTTVRemoteHandler.h"\n${IMPORT}`);
  }
  if (!next.includes('@implementation UIViewController (AmericanaMenuCancel)')) {
    next = next.replace('\n#endif\n', `\n${CATEGORY}\n#endif\n`);
  }
  return next;
}

function withTvMenuKey(config) {
  return withDangerousMod(config, [
    'ios',
    (mod) => {
      const file = path.join(
        mod.modRequest.projectRoot,
        'node_modules/react-native/React/Base/RCTTVRemoteHandler.m',
      );
      const source = fs.readFileSync(file, 'utf8');
      fs.writeFileSync(file, patchMenuKey(source));
      return mod;
    },
  ]);
}

module.exports = withTvMenuKey;
module.exports.patchMenuKey = patchMenuKey;
