const { withInfoPlist } = require('@expo/config-plugins');

/**
 * TV builds (EXPO_TV=1) declare why Anthem Gym Timer listens on the LAN.
 * tvOS has no local-network permission prompt; the key is the purpose string in the TV plist.
 * Phone builds leave EXPO_TV unset and do not add it.
 *
 * Android cleartext stays at the platform default (off in release). The TV is the HTTP server.
 * The phone's browser is the client, so the TV app does not need to open cleartext URLs.
 */
function withTvLogoLan(config) {
const tv = process.env.EXPO_TV;
  if (tv !== '1' && tv !== 'true') return config;
  return withInfoPlist(config, (mod) => {
    mod.modResults.NSLocalNetworkUsageDescription =
      'Anthem Gym Timer listens on your Wi-Fi so a phone on the same network can send a gym logo to this TV. The logo is saved on this TV and is not sent to a server.';
    return mod;
  });
}

module.exports = withTvLogoLan;
