---
name: Expo web app end-to-end testing for lr-main
description: How to run and test the React Native / Expo mobile app in web mode in the lr-main repo, including backend connectivity, auth, and common browser workarounds.
---

## When to use this skill

Use this when you need to do end-to-end or smoke testing of the `mobile/` app on the lr-main checkout, especially after changes to tab screens, navigation, ads, or responsive layout.

## Pre-requisites

- Node `v20.x` (the repo currently uses `v20.19.0`; Metro may warn about engine mismatch but the app still runs).
- Dependencies installed: `npm install` in repo root and `cd mobile && npm install`.
- Backend running on `http://localhost:4000` if you want Home/Browse/Profile data to load.

## Start the Expo web dev server

```powershell
cd mobile
npx expo start --web --port 8081
```

- The `--no-open` flag is not supported by this Expo CLI; omit it.
- The local URL is `http://localhost:8081`.
- A backend API server is not required to test the `Train Schedule` tab, but Home/Browse/Profile will show inline `Failed to fetch` errors if it is not running or is unreachable from the browser.

## Browser and network connectivity

The recommended browser is the provided Chrome for Testing binary:

```text
C:\devin\chrome\chrome-win64\chrome.exe
```

Open a narrow window for responsive testing:

```powershell
Start-Process 'C:\devin\chrome\chrome-win64\chrome.exe' '--new-window','--window-size=400,800','http://localhost:8081'
```

### Private Network Access (PNA) / CORS workaround

When the Expo web bundle is served from `http://172.16.16.2:8081` (or any non-`localhost` origin), requests to `http://localhost:4000/api` may be blocked by Chrome's Private Network Access checks, producing `TypeError: Failed to fetch` in the console.

Two workarounds have been used successfully:

1. **Preferred for e2e:** Set `EXPO_PUBLIC_API_BASE_URL` to the host's LAN/WSL IP before starting Expo:
   ```powershell
   $env:EXPO_PUBLIC_API_BASE_URL='http://172.16.16.2:4000/api'
   cd mobile
   npx expo start --web --port 8081
   ```
   Then open `http://172.16.16.2:8081` in Chrome.

2. **Alternative:** Launch Chrome with the Private Network Access preflight feature disabled. The exact flag name may change with Chrome versions; if the first approach is not enough, try `--disable-features=PrivateNetworkAccess,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessSendPreflightsCORS` or test directly from `localhost` origin (`http://localhost:8081`) with the backend reachable on `http://localhost:4000`.

## Authentication for tab UI testing

You can test the real registration/login flow via the mobile web UI:

1. Open the app and choose **Register** on the onboarding screen.
2. Fill first name, last name, email, password, confirm password, and check the legal opt-in.
3. Click **Create account**; the app redirects to `/(tabs)`.

If you only need to verify tab/navigation UI and do not want to create accounts, you can temporarily replace `mobile/app/index.tsx` with:

```tsx
import { Redirect } from 'expo-router';

export default function IndexScreen() {
  return <Redirect href="/(tabs)" />;
}
```

**Revert this change before running `npm run lint` or `npm run typecheck` and never commit it.**

## Responsive breakpoint notes

- `mobile/app/(tabs)/_layout.tsx` uses `width < 600` for the `CollapsibleSidebar` and hides the bottom `GradientTabBar` on narrow screens (sidebar only on small screens, bottom tab bar on wide).
- `mobile/app/(tabs)/live.tsx` uses `width < 600` for `compact` mode, which centers cards and stacks them vertically.
- The tab title in `_layout.tsx` is now `Train Schedule`. The bottom tab bar (`GradientTabBar`) will display that label; the sidebar (`CollapsibleSidebar`) uses the theme fallback label, so confirm it also reads `Train Schedule` when expanded.

## Live Train Schedule data notes

- A Line and B Line use real schedule data from `mobile/lib/liveSchedules.ts`.
- Streetcar is a simulated loop using `segmentMinutes` and `loop: true` in `mobile/app/(tabs)/live.tsx`.
- After the last scheduled trip of the day, the status rolls forward to the next day's first departure.
- The maps are `.jpeg` files in `mobile/assets/images/` (`aline_map.jpeg`, `bline_map.jpeg`, `streetcar_map.jpeg`).
- The disclaimer text is near the bottom of `live.tsx`; verify it renders below the train cards.

## Admin dashboard UI testing tips

- Use the seeded admin `owner@example.com` / `ChangeMe123!`.
- Chrome for Testing may show password-save bubbles; close them with `Esc` or `Tab` then `Return`, or launch with `--disable-features=PasswordManager` (this may not fully suppress the bubble).
- Controlled React inputs do not update from `browser_console` DOM manipulation; type credentials through the UI or paste from the clipboard (`Set-Clipboard` + `ctrl+v`).
- Special characters (`!`, `@`, `:`) may not be typed by `computer` `type`; use clipboard paste instead.
- The Vendors **Export to CSV** button is a client-side download; check the browser's default Downloads folder for `vendors-<date>.csv`.

## Lint/typecheck and backend API tests

```powershell
npm run typecheck --workspace=@lr/backend
npm run typecheck --workspace=@lr/admin-dashboard
cd mobile; npm run typecheck

npm run lint --workspace=@lr/backend
npm run lint --workspace=@lr/admin-dashboard
cd mobile; npm run lint

npm run build --workspace=@lr/admin-dashboard
```

## Troubleshooting

- If `npm install` warns about Node engine, the app may still work; only block if bundling fails.
- If the browser opens a sign-in prompt for Chrome for Testing, click "Don't sign in" or launch with a fresh `--user-data-dir`.
- If the tab bar/sidebar does not switch at the breakpoint, refresh after resizing; `useWindowDimensions` updates on resize.
- If the address bar interprets a typed URL as a Google search, copy the URL to the Windows clipboard (`Set-Clipboard`) and paste with `ctrl+v` instead of `computer type`.

## Devin secrets needed

None for local Expo web testing; backend API tests use the seeded admin account and auto-generated test users.
