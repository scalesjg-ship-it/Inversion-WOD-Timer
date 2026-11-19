const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const MARKER = 'AMERICANA_TV_MENU_CANCEL';

const BEFORE = `- (void)enableTVMenuKey
{
    dispatch_async(dispatch_get_main_queue(), ^{
        if (![[self.view gestureRecognizers] containsObject:self.tvMenuKeyRecognizer]) {
            [self.view addGestureRecognizer:self.tvMenuKeyRecognizer];
        }
    });
}`;

const AFTER = `- (void)enableTVMenuKey
{
    dispatch_async(dispatch_get_main_queue(), ^{
        // ${MARKER}: swallow Menu while the timer is open so UIKit does not pop the stack.
        self.tvMenuKeyRecognizer.cancelsTouchesInView = YES;
        if (![[self.view gestureRecognizers] containsObject:self.tvMenuKeyRecognizer]) {
            [self.view addGestureRecognizer:self.tvMenuKeyRecognizer];
        }
    });
}`;

function patchMenuKey(source) {
  if (source.includes(MARKER)) return source;
  if (!source.includes(BEFORE)) {
    throw new Error('RCTTVRemoteHandler enableTVMenuKey changed. Update plugins/withTvMenuKey.js.');
  }
  return source.replace(BEFORE, AFTER);
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
