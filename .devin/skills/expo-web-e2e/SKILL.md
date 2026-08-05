---
name: Expo web app end-to-end testing for lr-main
description: How to run and test the React Native / Expo mobile app in web mode in the lr-main repo, including the temporary auth bypass required to reach the tabs.
---

## When to use this skill

Use this when you need to do end-to-end or smoke testing of the `mobile/` app on the lr-main checkout, especially after changes to tab screens, navigation, or responsive layout.

## Pre-requisites

- Node `v20.x` (the repo currently uses `v20.19.0` and React Native/Metro packages may warn about engine mismatch, but the app still runs).
- Dependencies installed: `npm install` in repo root and `cd mobile && npm install`.

## Start the Expo web dev server

```powershell
cd mobile
npx expo start --web --port 8081
```

- Metro will bundle for web. The local URL is `http://localhost:8081`.
- A backend API server is not required to test the `Live Train Times` tab, but Home/Browse will show inline `Failed to fetch` errors if it is not running.

## Browser

The recommended browser in this environment is the provided Chrome for Testing binary:

```text
C:\devin\chrome\chrome-win64\chrome.exe
```

Open a narrow window for responsive testing:

```powershell
Start-Process 'C:\devin\chrome\chrome-win64\chrome.exe' '--new-window','--window-size=400,800','http://localhost:8081/live'
```

## Authentication bypass for tab UI testing

The root `mobile/app/index.tsx` redirects unauthenticated users to `/onboard`. To reach the `(tabs)` layout for UI tests, temporarily change the file to:

```tsx
import { Redirect } from 'expo-router';

export default function IndexScreen() {
  return <Redirect href="/(tabs)" />;
}
```

**Revert this change before running `npm run lint` or `npm run typecheck`** (and never commit it). The real sign-in/register flow is not exercised with this bypass.

## Responsive breakpoint notes

- `mobile/app/(tabs)/_layout.tsx` uses `width < 600` for the `CollapsibleSidebar` and hides the bottom `GradientTabBar` on narrow screens (sidebar only on small screens, bottom tab bar on wide). Verify this matches the current requirement.
- `mobile/app/(tabs)/live.tsx` uses `width < 600` for `compact` mode, which centers cards and stacks them vertically.
- The tab title in `_layout.tsx` is now `Live Train Times`, which the bottom tab bar (`GradientTabBar`) will display. The sidebar (`CollapsibleSidebar`) uses the theme fallback label; confirm it also reads `Live Train Times` if expanded.

## Live Train Times data notes

- A Line and B Line use real schedule data from `mobile/lib/liveSchedules.ts` (auto-generated from the provided xlsx). After the last scheduled trip of the day the status rolls forward to the next day's first departure.
- Streetcar is a simulated loop using `segmentMinutes` and `loop: true` in `mobile/app/(tabs)/live.tsx`.
- The maps are `.jpeg` files in `mobile/assets/images/` (`aline_map.jpeg`, `bline_map.jpeg`, `streetcar_map.jpeg`).

## Lint/typecheck and backend API tests

```powershell
cd mobile
npm run lint
npm run typecheck

cd ../backend
npm run test
```

## Troubleshooting

- If `npm install` warns about Node engine, the app may still work; only block if bundling fails.
- If the browser opens a sign-in prompt for Chrome for Testing, click "Don't sign in" or launch with a fresh `--user-data-dir`.
- If the tab bar/sidebar does not switch at the breakpoint, refresh after resizing; `useWindowDimensions` updates on resize.

## Devin secrets needed

None for local Expo web testing; backend API tests do not need live DB credentials because the unit tests are self-contained.
