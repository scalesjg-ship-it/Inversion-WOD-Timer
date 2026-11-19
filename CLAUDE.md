# Americana (Inversion-WOD-Timer)

Gym timer. Default brand is CrossFit Inversion (`src/branding/types.ts`); a gym re-skins name, colors, and logo on the device. Presets and branding stay on the device. Package name is `americana`. Expo SDK 58 (`expo` ~58.0.23). `react-native` is `npm:react-native-tvos@0.88-stable`.

`AGENTS.md` covers versioned Expo docs, `expo install`, and generated `ios/` / `android/`. This file is the repo map and the TV/EAS traps.

## Commands

```bash
npm install        # repo .npmrc sets legacy-peer-deps=true
npm test           # vitest run — src/**/*.test.ts and *.test.mjs
npm run typecheck  # tsc --noEmit
npm run lint       # expo lint
npx expo start     # Expo Go runs the phone clock
```

TV builds and lock-screen bells need an EAS build (dev, preview, or production).

## EAS profiles (`eas.json`)

`EXPO_TV` is a build-time prebuild flag (`@react-native-tvos/config-tv`). Runtime TV is `Platform.isTV`.

| Profile | Build |
| --- | --- |
| `development` | Dev client. iOS simulator, Android APK. `EXPO_TV` unset |
| `preview` | Internal phone install. `EXPO_TV` unset |
| `production-ios` | App Store iPhone. `EXPO_TV` unset |
| `production-tvos` | Apple TV. `EXPO_TV=1` |
| `production-android-apk` | Sideload APK. `EXPO_TV` unset |
| `production-google-play` | Play app bundle, phones and Android TV. `EXPO_TV=1`, `EXPO_KEEP_ADAPTIVE_ICON=1` |
| `production-firetv` | Fire TV APK. `EXPO_TV=1` |

Submit profiles: `production-ios` and `production-tvos`. Play and Fire TV are uploaded outside `eas submit`.

## Layout

- `app/` — `(tabs)/index.tsx` (WOD), `rounds.tsx`, `brand.tsx`; `setup.tsx`, `timer.tsx`, `countdown.tsx`, `_layout.tsx`
- `src/timer/engine.ts` — clock. `presetStore.ts` is preset logic; `presetStorage.ts` persists it on device
- `src/branding/` — theme and logo. `src/branding/lan/` is the TV receiver (local HTTP + QR on the same Wi-Fi)
- `src/tv/layout.ts` — 10-foot layout. Also `src/audio/`, `src/components/`
- `plugins/` — `withTvTcpSocket`, `withTvForegroundAudio`, `withTvLogoLan`, `withTvBuildNumber`, `withPlayAdaptiveIcon`, `withCenteredSplash`, `withAndroidSystemBars`, `withAndroidResourceKeeps` (`app.config.js` appends `android-r8-rules.pro` to `expo-build-properties`)
- `site/` — static privacy and support pages (Vercel, root directory `site`)
- Leave unread: `store/screenshots/`, `assets/sounds/`, `assets/images/`, `assets/tv/`, lockfiles

## Gotchas

- `react-native-tvos@0.88-stable` is the prerelease `0.88.1-0`. `npm ci` fails peer resolution without this `.npmrc`. EAS Build reads the same file.
- The iOS binary is iPhone-only (`supportsTablet: false` in `app.json`). `isTenFootLayout` in `src/tv/layout.ts` keeps iPad-sized windows on the phone layout.
- TV logo transfer is the TV listening on the LAN. The image stays on that TV.
