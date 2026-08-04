# Deploying the mobile app with EAS

The app is Expo-managed, so builds are produced in the cloud by EAS (Expo
Application Services) — no Xcode or Android Studio needed on your machine.
Config lives in `mobile/eas.json` and `mobile/app.json`.

## 0. One-time setup

```bash
npm install -g eas-cli
cd mobile
eas login                 # Expo account (free tier is enough to start)
eas init                  # links this folder to an EAS project, writes extra.eas.projectId
```

Identifiers already set in `app.json`:

| Field | Value |
| --- | --- |
| iOS `bundleIdentifier` | `com.lightraildeals.app` |
| Android `package` | `com.lightraildeals.app` |

These are permanent once an app is published to either store — change them
before your first submission if you want something different.

## 1. Point the build at the live API

Each build profile in `eas.json` sets:

```
EXPO_PUBLIC_API_BASE_URL=https://okbolfpndeakmchpznmt.supabase.co/functions/v1/router
```

Anything prefixed `EXPO_PUBLIC_` is inlined into the JS bundle at build time, so
it must be non-secret. Never put the Passcreator key or JWT secret here — those
stay as Supabase Edge Function secrets on the server.

## 2. Build

```bash
cd mobile

# Internal test builds: installable APK / TestFlight-style iOS build
eas build --profile preview --platform android
eas build --profile preview --platform ios

# Store builds (AAB for Play, IPA for App Store)
eas build --profile production --platform all
```

The `production` profile uses `autoIncrement: true` with
`appVersionSource: "remote"`, so EAS bumps `versionCode` / `buildNumber` for
you. Bump the user-facing `version` in `app.json` yourself for each release.

Credentials: on the first iOS build EAS offers to generate and store the
distribution certificate and provisioning profile — say yes and let EAS manage
them. Android signing keystores are generated and stored the same way. You need
a paid Apple Developer account ($99/yr) for iOS and a Google Play developer
account ($25 once).

## 3. Submit to the stores

```bash
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

For Android, the first upload has to be done manually in the Play Console
(Google requires it); afterwards `eas submit` works. For iOS, submissions go to
App Store Connect and then to TestFlight / review.

## 4. Over-the-air updates

JS-only changes (screens, theme, copy, CMS rendering) don't need a new store
build:

```bash
npx expo install expo-updates      # once
eas update --branch production --message "Theme + CMS tweaks"
```

Native changes — new native modules, permissions, icons, `app.json` plugin
changes — still require a fresh `eas build`.

## 5. Store review checklist for this app

- Privacy Policy and Terms links are in `mobile/lib/theme.ts` (`PRIVACY_URL`,
  `TERMS_URL`, `EULA_URL`) and surfaced in the Profile screen; both stores also
  require publicly reachable URLs, so host the same text on the marketing site
  and paste the links into App Store Connect / Play Console.
- Account deletion: Apple requires an in-app path to delete an account for apps
  with sign-up. Add a delete-account flow in the Profile screen before store
  submission.
- Location: the app requests location permission to show nearby participating
  stores on the map (`expo-location` plugin). Declare the `NSLocationWhenInUseUsageDescription`
  purpose string in `app.json`.
- Push notifications: the app registers for Expo push tokens and uses local
  notifications for expiring deals and city-matched events (`expo-notifications`).
  Configure the Apple Push Key / FCM credentials in EAS for remote pushes.
- Camera: the scan screen uses `expo-camera` to read vendor onboarding QR codes.
- Data safety / privacy nutrition labels: declare name, email, phone number, and
  identifiers (the membership pass token), all tied to the user's identity.
- Wallet passes are generated server-side by Passcreator, so no Apple Wallet
  entitlement is required for the app itself.

## 6. Web build

The Expo web export is configured for Metro static rendering:

```bash
cd mobile
npx expo export -p web    # writes mobile/dist
```

The map screen uses `react-native-maps`; the web build renders a placeholder.
Native map views are used on iOS and Android.
