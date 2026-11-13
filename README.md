# Americana

Americana is a gym timer for CrossFit Inversion and any gym that wants the same clock with its own name, colors, and logo. One Expo codebase ships to iPhone, iPad, Apple TV, Google Play (phones and Android TV from one app bundle), a sideloadable Android APK, and Amazon Fire TV.

The default brand is CrossFit Inversion. A gym can replace the name, work/rest colors, and logo on the device. Nothing is uploaded.

Store-name availability for “Americana” was not checked. This repository does not make a trademark claim. Search App Store Connect and the Amazon Appstore before you lock the display name.

The older timer at `https://github.com/scalesjg-ship-it/wod-chrono-beast` was not readable from this environment (GitHub returned 404). The clock in this repo is new.

## Modes

Conditioning (WOD tab):

- **For Time** counts up, with an optional cap, after a lead-in (default 10 seconds).
- **AMRAP** counts down for the chosen length.
- **EMOM** repeats an interval (every X minutes, or any other length) for a number of rounds. There is no extra rest segment; the next interval starts when the previous one ends.
- **Tabata** defaults to 20 seconds on, 10 seconds off, 8 rounds.
- **Intervals** is custom work, rest, and rounds.
- **Countdown** is any length, with hours, minutes, and seconds, quick adds (+30s, +1m, +5m), a lead-in that can be zero, and warning beeps at 1:00, 0:30, 0:10, and the last 3 seconds.

The last round never adds a trailing rest.

Rounds tab, for jiu-jitsu and striking:

- Round length, rest length, round count, lead-in, and a warning before the round ends (off, 10 seconds, 30 seconds, or any other value shorter than the round).
- Built-in presets: **BJJ roll** 5:00 / 1:00, **Boxing** 3:00 / 1:00, **MMA** 5:00 / 1:00, **Muay Thai** 3:00 / 1:00 × 5 rounds. Muay Thai round length is the common gym class, not a stadium contract.
- Custom round presets are saved on the device, along with named presets for every other mode.

Every conditioning mode, the countdown, and the rounds screen can save as many named presets as you want. They stay in local storage on that phone or TV (`americana.presets.v1`). Nothing is uploaded. A preset can be loaded back into the setup, started directly, renamed, updated, or deleted. The WOD tab lists them under My presets when any are saved. Countdown and round presets saved by earlier versions are migrated into that same list.

The running clock is sized for the room, in portrait and landscape. Work and rest use different colors. Tap the clock to pause or resume. Reset is a separate control. For Time also has Stop, which freezes the elapsed time. The screen stays awake while the timer is running.

## Audio, haptics, and the lock screen

While Americana is on screen it plays a tick for the lead-in, a horn for the start and for the end of rest, a warning, and a bell at the end of a round. Those cues also trigger haptic feedback on a phone. Playback is configured to play in silent mode and to duck other audio.

When a timer starts, upcoming cues are scheduled as local notifications (up to 60, the practical iOS pending-notification cap). The app is in the foreground, those notifications stay quiet and the in-app horn plays. When the phone is locked or the app is backgrounded, the notification sound is what rings. On Android the trigger uses alarm-clock delivery so the bell is less likely to be deferred. That needs the exact-alarm permission and a Play Console declaration (see below).

The on-screen digits are computed from a start timestamp, so leaving the app does not drift the clock. Coming back shows the right phase.

Custom notification sounds and background audio are not fully available in Expo Go. Use an EAS development, preview, or production build to hear locked-screen bells. iOS and Android can still delay or silence notifications under Focus, battery savers, or a denied permission.

## Branding

The Brand tab stores, on this device only:

- Gym name
- Colors for work, rest, lead-in, warning, the clock digits, the background, and the accent. Each one has swatches, a hue strip, and a hex field, and the open color row shows a ring and a dot on the swatch that is in use. Preset templates are Inversion, Dark, High-contrast, Neon, and Fight (red/blue), plus a few more one-tap looks. If a digit color cannot be read on the background, Americana swaps in black or white.
- A logo from the photo library or from Files on a phone. Any image is accepted. It is resized and kept locally. The default placement is a large faded watermark, about 88% of the shorter screen edge, centered. Full bleed (optional blur) and a corner mark are the other placements.
- On Apple TV and Fire TV, the Logo section of Brand shows a QR code. Scan it with a phone on the same Wi-Fi, pick a logo, and optionally set the gym name, colors, and placement. The TV saves that logo with the same resize step as a photo picked on the device. The page is served by the TV. The image is not sent to a server on the internet. The listener stops when you leave Brand, or after 10 minutes. If the TV cannot open that link, paste an https image address in the same Logo section.
- Reset to Inversion, which restores the CrossFit Inversion name and colors and clears the logo.

Every mode has a lead-in length, including zero.

## Develop

Requirements: Node 20 or newer, npm. The repo `.npmrc` sets `legacy-peer-deps=true`. `react-native-tvos` is published as a prerelease (`0.88.1-0`), so a plain `npm ci` fails peer resolution without that file. EAS Build reads the same `.npmrc`.

```bash
npm install
npm test
npm run typecheck
npm run lint
npx expo start
```

`npm test` runs the timer unit tests (lead-in boundaries, work/rest transitions, warnings, pause accuracy, caps, cue sounds).

In the Expo CLI, press `w` for the web preview, or run `npx expo start --web`. A phone can use Expo Go for the clock UI. Background bells need a build:

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform android
eas build --profile development --platform ios
```

The iOS development profile builds a simulator binary. A physical iPhone needs a preview or production build, or a development profile edited to `"simulator": false`.

## Television

Apple TV, Fire TV, and the Google Play app bundle set `EXPO_TV=1`, which `@react-native-tvos/config-tv` reads during EAS prebuild. Phone sideload, development, and preview builds leave it unset. On Android, `EXPO_TV=1` adds `LEANBACK_LAUNCHER` and sets `android.hardware.touchscreen` and `android.software.leanback` to `required="false"`. It keeps `LAUNCHER`, so the same binary still installs on phones. `Platform.isTV` is read from the device at runtime (`uiMode === 'tv'`), not from `EXPO_TV`. The Play profile also sets `EXPO_KEEP_ADAPTIVE_ICON=1` so the Fire TV launcher drawable is not used as the phone icon. The TV home row still uses `android:banner`. The app uses `react-native-tvos@0.88-stable`, the TV fork that matches Expo SDK 58 (React Native 0.88).

On the running timer:

| Remote | Action |
| --- | --- |
| Select, or Play/Pause | Start or pause |
| Long-press select | Reset, after a confirm |
| Left, Rewind, or swipe left | Back 10 seconds, or the previous round for Rounds, Intervals, and Tabata |
| Right, Fast Forward, or swipe right | Forward 10 seconds, or the next round for those modes |
| Up or swipe up | Show Back and Reset |
| Down or swipe down | Hide those controls |
| Back or Menu | Leave the timer for the mode list |

D-pad and select cover every action. Home and the microphone button stay with the TV. On Brand, scan the QR code with a phone on the same Wi-Fi to send a logo. Remove logo stays on the remote. A guest network that isolates devices will not connect.

### Local logo transfer

The TV listens with [`react-native-tcp-socket`](https://github.com/Rapsssito/react-native-tcp-socket). Its podspec includes tvOS (`:tvos => "10.0"`) and the iOS implementation is CocoaAsyncSocket, which also ships a tvOS target. Android uses `java.net.ServerSocket`, which Fire TV can run. `expo-network` `getIpAddressAsync` is supported on tvOS and supplies the address in the QR code. The code itself is drawn from the pure JavaScript `uqr` matrix with views, so the screen does not add another native graphics library.

The phone may send one JPEG, PNG, or HEIC up to 10 MB. The bytes are written to a temp file and passed through `prepareLogo`, the same resizer a local pick uses. If that TV cannot decode HEIC, the page asks for a JPEG or PNG. The QR contains a one-time token. A second send needs the new code shown after a successful save.

`NSLocalNetworkUsageDescription` is set for the local listener. tvOS does not show a local-network permission prompt. Android release builds do not turn on cleartext traffic for the public internet: the TV is the server, and the phone browser is the client. `INTERNET` is declared so the TV can accept the connection. `CHANGE_NETWORK_STATE`, which the socket library's manifest requests, is blocked. It is not needed to listen.

## What you need before the stores

Bundle id, set in `app.json` for iOS, tvOS, Google Play, the sideload APK, and Fire TV: `com.garrettscales.americana`. Register that id before the first upload. It cannot be changed after that upload.

- Apple Developer Program, individual account, already Garrett's.
- An Amazon Appstore developer account.
- A Google Play Console app for `com.garrettscales.americana`, with phones and Android TV on the same release artifact. There is no Play `eas submit` profile. Upload the `.aab` in the console.
- Display name **Americana**. Whether it is free on App Store Connect, Google Play, or Amazon was not checked.
- Privacy and support pages live in `site/`. Deploy that folder to Vercel as a static site (root directory `site`, no build command). Use the deployed `/privacy` and `/support` URLs in App Store Connect, Google Play, and Amazon.
- Listing copy is in `store/listing.md`. Store screenshots are in `store/screenshots/`.
- The Expo project is `scalesgym/americana` (`extra.eas.projectId` in `app.json`). Do not run `eas init` again unless that project is gone.

Store art is generated from `assets/brand/americana-mark.svg` by `python3 scripts/render-brand.py`. Review the mark before you upload it. The files are:

- `assets/images/icon.png` — 1024×1024 iOS icon
- `assets/images/android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png`
- `assets/images/splash-icon.png`, `favicon.png`, `notification-icon.png`
- `assets/tv/tvos-icon-front-1280x768.png` and `tvos-icon-back-1280x768.png`, plus 800×480 and 400×240 layers
- `assets/tv/topshelf-1920x720.png`, `topshelf-3840x1440.png`, `topshelf-wide-2320x720.png`, `topshelf-wide-4640x1440.png`
- `assets/tv/android-tv-banner.png` (320×180) — Android TV home-row banner (`android:banner`)
- `assets/tv/android-tv-icon.png` (512×512, square) — drawable config-tv assigns to `android:icon` on Fire TV. A wide bitmap is cropped out of the hero circle. The Play profile restores the adaptive phone icon instead
- `assets/store/amazon-icon-512.png`, `amazon-icon-114.png` — square store icons. Upload these in the Amazon console
- `assets/store/firetv-background-1280x720.png` — 1280×720 Fire TV app icon, opaque, mark centered so a circular crop still shows it
- `assets/store/firetv-background-1920x1080.png` — opaque background for the Apps-row mini detail. The mark sits in the right-hand safe zone, which is the circle at the top right. A left-aligned banner leaves that circle blank. Re-upload this file in the Amazon console after a new APK; the console image is what Fire TV draws there

## Build with EAS

| Profile | Use |
| --- | --- |
| `development` | Phone dev client. iOS simulator. Android APK. `EXPO_TV` unset. |
| `preview` | Phone internal install. `EXPO_TV` unset. |
| `production-ios` | iOS App Store binary. `EXPO_TV` unset. |
| `production-tvos` | Apple TV binary. `EXPO_TV=1`. |
| `production-android-apk` | Sideloadable phone APK. Not for Google Play. `EXPO_TV` unset. |
| `production-google-play` | Google Play app bundle for phones and Android TV. `EXPO_TV=1` and `EXPO_KEEP_ADAPTIVE_ICON=1`. |
| `production-firetv` | Fire TV APK for the Amazon Appstore. `EXPO_TV=1`. |

```bash
eas login
eas build --profile production-ios --platform ios
eas build --profile production-tvos --platform ios
eas build --profile production-android-apk --platform android
eas build --profile production-google-play --platform android
eas build --profile production-firetv --platform android
```

`eas.json` submit profiles `production-ios` and `production-tvos` set the App Store Connect app id and Apple team id. The App Store Connect API key is not in the repo. `eas submit` prompts for it, or you can set `EXPO_ASC_API_KEY_PATH`, `EXPO_ASC_KEY_ID`, and `EXPO_ASC_ISSUER_ID` in the environment. There is no Google Play submit profile. Upload the `production-google-play` `.aab` in Play Console.

tvOS uses the same distribution certificate as iOS and a separate tvOS provisioning profile. EAS creates iOS profiles. For `production-tvos`, create the tvOS profile in the Apple developer site, download it, and supply it as a local credential. See the Expo TV guide.

## App Store (iPhone and Apple TV)

1. Register the App ID `com.garrettscales.americana` on the existing individual Apple Developer account.
2. Create the iOS app in App Store Connect. Name Americana if it is available. SKU `americana`.
3. Add the tvOS version to that app (same bundle id) or create a separate tvOS app if you want a different listing. Same id is the proposal.
4. Build with `production-ios` and `production-tvos`. Submit with `eas submit --profile production-ios --platform ios` and `eas submit --profile production-tvos --platform ios`. Both profiles target App Store Connect app `6833266123` on team `BNP9QFC679`. Supply the API key in the environment. Transporter still works if you download the `.ipa`. The tvOS upload needs the tvOS provisioning profile in place first.
5. Ready in the repo, still yours to upload:
   - iPhone screenshots: `store/screenshots/iphone-6.9/` (1320×2868) and `store/screenshots/iphone-6.5/` (1284×2778)
   - Apple TV screenshots: `store/screenshots/apple-tv/` (1920×1080)
   - The 1024 icon, tvOS layers, and Top Shelf images listed above
   - Description, keywords, and age-rating answers in `store/listing.md`
   - Support and privacy URLs after you deploy `site/`
6. Still required in App Store Connect:
   - Age rating and App Privacy (photos stay on device, notifications are local, no tracking)
   - Export compliance: `ITSAppUsesNonExemptEncryption` is already false
   - Reviewer note: on-device timer, no account. On Apple TV, use the remote: select starts and pauses, menu leaves the timer.

## Google Play (phones and Android TV)

Play Console is set to use the same release track and artifacts as the mobile app. One bundle is the right upload.

1. Build with `eas build --profile production-google-play --platform android`.
2. Upload that `.aab` to the Play track. Package name: `com.garrettscales.americana`. Display name stays Americana.
3. The manifest from this profile is the phone-and-TV manifest described in `store/listing.md`. A phone-only bundle (`EXPO_TV` unset) has no `LEANBACK_LAUNCHER` and Play will not offer it on Android TV. A TV-only bundle (`androidTVRequired: true`) would drop phones.
4. Listing copy is in `store/listing.md`. Phone and Android TV screenshots are already saved in Play Console.

## Amazon Appstore (Fire TV) and sideload

1. Open an Amazon developer account and create the app in the Appstore console.
2. Upload the APK from `eas build --profile production-firetv --platform android`.
3. Package name: `com.garrettscales.americana`.
4. Ready in the repo, still yours to upload:
   - `assets/store/amazon-icon-512.png`, `amazon-icon-114.png`, and the Fire TV backgrounds
   - Fire TV screenshots in `store/screenshots/fire-tv/` (1920×1080)
   - Short and long description in `store/listing.md`
   - Privacy policy URL after you deploy `site/`
5. Target the Fire TV device family in the console.
6. The phone sideload file is the `production-android-apk` build. Install it with `adb install`. It is not a store upload.

## Not in this version

- No accounts, cloud sync, or shared gym profiles. Branding is per device, including each TV. A phone can hand a logo to a TV on the same Wi-Fi. That transfer stays on the local network.
- No store submission is performed from this repo.
- On a phone, the logo comes from the photo library or Files. On a TV, it comes from the QR page.
- Locked-screen sound on phones depends on notification permission. TVs keep the screen on.
- Expo Go can try the phone clock. It cannot run the TV build.
- Store art is generated. Look at the mark before you upload it.
