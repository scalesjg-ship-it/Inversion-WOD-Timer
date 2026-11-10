# Americana

Americana is a gym timer for CrossFit Inversion and any gym that wants the same clock with its own name, colors, and logo. One Expo codebase ships to the Apple App Store and Google Play.

The default brand is CrossFit Inversion. A gym can replace the name, work/rest colors, and logo on the device. Nothing is uploaded.

Store-name availability for “Americana” was not checked. This repository does not make a trademark claim. Search App Store Connect and Google Play before you lock the display name.

The older timer at `https://github.com/scalesjg-ship-it/wod-chrono-beast` was not readable from this environment (GitHub returned 404). The clock in this repo is new.

## Modes

Conditioning (WOD tab):

- **For Time** counts up, with an optional cap, after a lead-in (default 10 seconds).
- **AMRAP** counts down for the chosen length.
- **EMOM** repeats an interval (every X minutes, or any other length) for a number of rounds. There is no extra rest segment; the next interval starts when the previous one ends.
- **Tabata** defaults to 20 seconds on, 10 seconds off, 8 rounds.
- **Intervals** is custom work, rest, and rounds.

The last round never adds a trailing rest.

Rounds tab, for jiu-jitsu and striking:

- Round length, rest length, round count, lead-in, and a warning before the round ends (off, 10 seconds, 30 seconds, or any other value shorter than the round).
- Built-in presets: **BJJ roll** 5:00 / 1:00, **Boxing** 3:00 / 1:00, **MMA** 5:00 / 1:00, **Muay Thai** 3:00 / 1:00 × 5 rounds. Muay Thai round length is the common gym class, not a stadium contract.
- Custom presets are saved on the device.

The running clock is sized for the room, in portrait and landscape. Work and rest use different colors. Tap the clock to pause or resume. Reset is a separate control. For Time also has Stop, which freezes the elapsed time. The screen stays awake while the timer is running.

## Audio, haptics, and the lock screen

While Americana is on screen it plays a tick for the lead-in, a horn for the start and for the end of rest, a warning, and a bell at the end of a round. Those cues also trigger haptic feedback on a phone. Playback is configured to play in silent mode and to duck other audio.

When a timer starts, upcoming cues are scheduled as local notifications (up to 60, the practical iOS pending-notification cap). The app is in the foreground, those notifications stay quiet and the in-app horn plays. When the phone is locked or the app is backgrounded, the notification sound is what rings. On Android the trigger uses alarm-clock delivery so the bell is less likely to be deferred. That needs the exact-alarm permission and a Play Console declaration (see below).

The on-screen digits are computed from a start timestamp, so leaving the app does not drift the clock. Coming back shows the right phase.

Custom notification sounds and background audio are not fully available in Expo Go. Use an EAS development, preview, or production build to hear locked-screen bells. iOS and Android can still delay or silence notifications under Focus, battery savers, or a denied permission.

## Branding

The Brand tab stores, on this device only:

- Gym name
- Work color and rest color (used for the clock and controls). A very dark color is lightened on the digits so they stay readable on the black clock.
- A logo from the photo library or from Files. It is resized and kept locally.
- Placement: faded watermark behind the digits, darkened full-bleed (optional blur), or a corner mark.
- Reset to Inversion, which restores the CrossFit Inversion name and colors and clears the logo.

## Develop

Requirements: Node 20 or newer, npm.

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

## What you need before the stores

- An [Apple Developer Program](https://developer.apple.com/programs/) membership for the account that will own the app (Garrett Scales / CrossFit Inversion).
- A [Google Play Console](https://play.google.com/console) account (one-time registration fee).
- A final bundle id. The placeholder is `com.scales.americana` for both `ios.bundleIdentifier` and `android.package` in `app.json`. Change it before the first store build if you want a different id. It cannot be changed after the first upload for that platform.
- A decision on the public name. Display name is **Americana** (`expo.name`). Whether that name is free on either store is unknown.
- Final art. Replace the generated placeholders:
  - `assets/images/icon.png` — 1024×1024, no transparency, for the store icon
  - `assets/images/android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png`
  - `assets/images/splash-icon.png` — the splash mark; the splash background is `#07080A` and the word on the image is AMERICANA
  - `assets/images/favicon.png`
  - `assets/images/notification-icon.png` — white glyph on transparency, about 96×96
- A privacy policy URL and a support URL. The app has no account and does not upload logos, but both stores ask for a privacy policy.
- Store screenshots at the sizes App Store Connect and Play Console currently require. Capture them from a preview build.

`extra.eas.projectId` in `app.json` is a placeholder. `eas init` replaces it. Do not ship with the placeholder.

## Build with EAS

Profiles in `eas.json`:

| Profile | Use |
| --- | --- |
| `development` | Dev client. iOS simulator build. Android APK. |
| `preview` | Internal install. Android APK. iOS device build (ad hoc / internal). |
| `production` | Store binaries. Android App Bundle (`.aab`). iOS archive. Version auto-increment is remote. |

```bash
eas login
eas init
eas build --profile production --platform ios
eas build --profile production --platform android
```

`eas init` creates the Expo project and writes the real project id. Production iOS credentials (distribution certificate and provisioning profile) can be created by EAS when it asks. Android uses an upload keystore that EAS can create and store.

This repo does not submit to either store. No store credentials are included.

## App Store Connect

1. Enroll in the Apple Developer Program and accept the latest license.
2. In [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources), register an explicit App ID with bundle id `com.scales.americana` (or whatever you put in `app.json`). Enable Push Notifications only if you later turn remote notifications back on. This app ships with `enableRemoteNotifications: false` and uses local notifications only.
3. In App Store Connect, choose **My Apps → + → New App**.
   - Platform: iOS
   - Name: Americana, if the name is available. If it is taken, pick another display name and set `expo.name` to match before you submit.
   - Primary language
   - Bundle ID: the identifier from step 2
   - SKU: `americana` (any unique string; it is not shown on the store)
   - User access: full
4. Wait until `eas build --profile production --platform ios` finishes. Download the `.ipa` from the Expo build page if you want a local copy.
5. Submit the binary:

   ```bash
   eas submit --profile production --platform ios
   ```

   The first run asks for an Apple ID and can create an App Store Connect API key. You can also pass `--asc-app-id` once the numeric Apple ID of the app exists (App Store Connect → App Information → Apple ID). To upload without EAS, download the `.ipa` and use Apple’s Transporter app.
6. On the App Store version page, fill in:
   - Screenshots for the required device sizes
   - Promotional text, description, keywords, support URL, marketing URL if you have one
   - Copyright: Garrett Scales
   - Age rating questionnaire
   - App Privacy: photos are selected by the user and stored only on device (not collected). Notifications are local. No account, no tracking, no third-party analytics.
7. Export compliance: `ITSAppUsesNonExemptEncryption` is already `false` (standard HTTPS only). Answer the compliance prompt to match that.
8. Reviewer notes: “Americana is an on-device interval timer. No account. Open the WOD tab or the Rounds tab and press Start. The Brand tab changes the local gym logo.”
9. Add the build to the version, then **Submit for Review**.

## Google Play

1. Create the Play Console account and pay the registration fee. Complete identity verification if Google asks.
2. **Create app**. App name Americana if it is available. Default language. App or Game: App. Free.
3. The package name must be `com.scales.americana` and must match `android.package`. Play will not let you change it later.
4. Finish the dashboard tasks before production:
   - Store listing: short description, full description, 512×512 icon, 1024×500 feature graphic, phone screenshots
   - Content rating questionnaire
   - Target audience. This is a fitness timer, not a children’s app.
   - News apps / ads declarations: no ads, no news
   - Data safety: data is not collected or shared. If you declare photos, say they are processed on device only and are not transmitted.
   - App access: no login
5. **Policy → App content → Exact alarms** (wording may be under “Alarms & reminders”): declare that Americana is a timer and schedules exact alarms so round bells fire while the screen is locked. The manifest requests `SCHEDULE_EXACT_ALARM`. Do not request `USE_EXACT_ALARM`.
6. Build and submit the Android App Bundle:

   ```bash
   eas build --profile production --platform android
   eas submit --profile production --platform android
   ```

   `eas submit` asks for a Google service account JSON linked to Play Console (Setup → API access, grant the service account release permissions). Alternatively, download the `.aab` from the Expo build page and upload it in Play Console under **Test and release → Internal testing**. Promote internal → closed → production when you are ready.
7. Roll out the release. The first production release can take longer while Play reviews the new account.

## Not in this version

- No accounts, cloud sync, or shared gym profiles. Branding is per device.
- No Apple or Google submission is performed from this repo.
- Locked-screen sound depends on notification permission and the OS. The in-app horn is the cue while the app is open.
- Expo Go is enough to try the clock. It is not enough to prove background audio.
- Placeholder icon and splash art are in the repo so the project builds. Replace them before review.
