# End-to-End UI Test Plan — `main` follow-up features

## Environment

- Repo root: `C:/Users/Administrator/repos/lr-main` (branch `main`, PR #70 merged).
- Backend API: `http://localhost:4000/api` (`npm run dev --workspace=@lr/backend`).
- Admin dashboard: `http://localhost:5173` (`npm run dev --workspace=@lr/admin-dashboard`).
- Mobile web (Expo): `http://<host-ip>:8081`, started with `EXPO_PUBLIC_API_BASE_URL=http://<host-ip>:4000/api` to avoid Chrome Private Network Access preflight issues. The current host IP is `172.16.0.2`; if it changes, replace with the current IPv4 address shown by `Get-NetIPAddress`.
- Admin credentials: `owner@example.com` / `ChangeMe123!`.
- Postgres container `lr-postgres` already running on `localhost:5432`.

## Code traces

- `mobile/lib/cache.ts` — `fetchCached` and `getSecureCache` are cache-first with TTL; if the network fetch fails, stale (any age) cache is returned.
- `mobile/lib/api.ts` — `getMyAnalytics`, `listVendors`, `listCards`, `getCard`, `listAds`, `getAppTheme`, `listPublishedContent`, `getEvents`, `getMe`, `getMyPass` all use the cache helpers.
- `mobile/lib/auth.tsx` — `persist()`, `logout()`, and `deleteAccount()` call `clearApiCache()` and `clearSecureCache('my-pass')`.
- `mobile/components/AdBanner.tsx` — fetches `/api/ads`, filters by `slot`, shows the first matching ad in a horizontally scrollable `ScrollView`; returns `null` when no ad matches.
- Tab ad slot usage:
  - `mobile/app/(tabs)/index.tsx:117` → `<AdBanner slot={1} />`
  - `mobile/app/(tabs)/browse.tsx:174` → `<AdBanner slot={2} />`
  - `mobile/app/(tabs)/discover.tsx:90` → `<AdBanner slot={3} />`
  - `mobile/app/(tabs)/mypass.tsx:84` → `<AdBanner slot={4} />`
  - `mobile/app/(tabs)/profile.tsx:63` → `<AdBanner slot={5} />`
- `admin-dashboard/src/pages/AdsPage.tsx` — `SLOT_OPTIONS = [1, 2, 3, 4, 5]`; create/update/delete via `/api/admin/ads` (upsert on `slot`).
- `backend/src/routes/auth.ts` — `POST /api/auth/forgot-password` returns `verificationCode` in dev; `POST /api/auth/reset-password` validates the 6-digit code and updates the password.

## Test fixtures

Pre-copied ad images to `C:\tmp\test-ads`:

| Slot | Image file | Assigned link URL |
|---|---|---|
| 1 | `slot1.png` | `https://slot1.example.com` |
| 2 | `slot2.jpeg` | `https://slot2.example.com` |
| 3 | `slot3.jpeg` | `https://slot3.example.com` |
| 4 | `slot4.jpeg` | `https://slot4.example.com` |
| 5 | `slot5.png` | `https://slot5.example.com` |

These are distinct images so each slot is visually distinguishable in screenshots.

## 1. Mobile local cache / offline resilience

### Preconditions
1. Backend and Expo are running; mobile is reachable at `http://<host-ip>:8081`.
2. Open Chrome at `http://<host-ip>:8081` in a window at least 1000×800 so the bottom tab bar with labels is visible.
3. If a previous session is still signed in, log out from Profile → **Log out**.

### Steps
1. **Register a test account.** From the onboarding screen choose **Register**, fill a unique email and phone, a password, confirm password, check the legal opt-in, and click **Create account**. Pass: redirect to `(tabs)` Home and greeting includes the first name.
2. **Populate the cache.** Visit Home, Browse, Discover, My Pass, and Profile. Wait for each screen to finish loading (no spinner, content visible). Pass: each tab renders data.
3. **Cache key inspection (optional but recommended).** Open DevTools → Console and run:
   ```js
   Object.keys(localStorage).filter(k => k.startsWith('lr.mobile.cache.') || k.startsWith('lr.mobile.scache.'));
   ```
   Pass: at least `lr.mobile.cache.*` entries exist for `vendors:all`, `me`, `my-analytics`, `events`, `content`, `ads`, `theme`, plus `lr.mobile.scache.my-pass`.
4. **Simulate offline.** Open DevTools → Network, change throttling to **Offline**, and switch back to the mobile tab. Do not reload the page.
5. **Offline tab walkthrough.** Click Home, Browse, Discover, My Pass, and Profile again. Pass: each screen still renders previously loaded content (greeting/stats, vendor list, published content, membership pass, profile details) without infinite spinners and without a full-screen error banner. `AdBanner` should still show the cached sponsors from the previous state.
6. **Restore network.** Set DevTools throttling back to **No throttling**. Click a tab and/or pull-to-refresh. Pass: content stays visible; fresh requests resume (no persistent error).
7. **Cache clear on logout.** Go to Profile → **Log out**. Pass: app redirects to onboarding/auth. After logout, run in console:
   ```js
   Object.keys(localStorage).filter(k => k.startsWith('lr.mobile.cache.') || k.startsWith('lr.mobile.scache.'));
   ```
   Pass: all `lr.mobile.cache.*` and `lr.mobile.scache.my-pass` keys are removed.
8. **Cache clear on login.** Sign in again with the same account. Pass: data reloads fresh from the network (initial spinner appears briefly and content updates). No stale `lr.mobile.cache.*` keys remain from the previous session.

### Failure criteria
- Any tab shows an infinite spinner or a red error banner when network is offline after it was previously loaded.
- `localStorage` still contains `lr.mobile.cache.*` or `lr.mobile.scache.my-pass` after logout.
- Home/Browse/Discover/My Pass/Profile are blank or error out on a fresh login.

## 2. Five ad slots (admin dashboard + mobile tabs)

### Steps
1. **Admin login.** Open `http://localhost:5173/login`, sign in as `owner@example.com` / `ChangeMe123!`. Pass: dashboard overview loads, top bar shows the email and `owner`.
2. **Ads page.** Click the **Ads** tab. Pass: page loads `Ad placements` form and `Current ads` list. Note the empty-state copy says "up to 3 ads" — this should now say "up to 5 ads".
3. **Delete any existing ads.** For each existing ad, click **Delete** and confirm, until the list is empty.
4. **Create slot 1.** Set slot to `1`, upload `C:\tmp\test-ads\slot1.png`, link URL `https://slot1.example.com`, active checked, click **Save ad**. Pass: list shows `Slot 1`.
5. **Create slot 2.** Use `slot2.jpeg` and `https://slot2.example.com`. Pass: list shows slots 1 and 2.
6. **Create slots 3–5.** Use the remaining fixture files and matching link URLs. Pass: admin list shows all five slots.
7. **Mobile verification.** Open/refresh the mobile app at `http://<host-ip>:8081`, log in if needed, then visit each tab:
   - **Home** (slot 1) — Sponsors card shows the logo image.
   - **Browse** (slot 2) — Sponsors card shows the A Line map.
   - **Discover** (slot 3) — Sponsors card shows the B Line map.
   - **My Pass** (slot 4) — Sponsors card shows the streetcar map.
   - **Profile** (slot 5) — Sponsors card shows the icon.
   Pass for each: a `Sponsors` / `Featured partners` card is visible with the expected image. Click the ad image and verify a new tab opens to the matching `https://slotN.example.com` URL.
8. **Delete all ads.** Return to admin Ads, delete each ad. Pass: list is empty.
9. **Verify disappearance in mobile.** Switch to each mobile tab. Pass: the Sponsors card no longer appears on any tab (AdBanner returns `null` when `ads.length === 0`).

### Failure criteria
- A tab shows an ad for the wrong slot or no ad after creation.
- A tab still shows an ad after the corresponding slot was deleted.
- Creating slot 5 fails or the admin UI copy incorrectly says the limit is 3.

## 3. Forgot password via phone

### Steps
1. **Register a test account with a phone number** (use a unique 10-digit number, e.g. `602555XXXX`). This may be the same account created in the cache test if it was not deleted; if it was, register a new one.
2. From the onboarding/auth screen, choose **Sign In**.
3. Click the **Forgot password?** ghost button. Pass: form switches to "Reset password" with a phone number field and subtitle "Enter the phone number for your account."
4. Enter the same phone number used at registration. Click **Send code**. Pass: a green success banner appears containing the 6-digit verification code (dev-only response from `POST /api/auth/forgot-password`).
5. Enter the 6-digit code, a new 8+ character password, and confirm the password. Click **Update password**. Pass: form switches back to **Sign In**, identifier is pre-filled with the phone number, and success reads "Password updated. Sign in with your new password."
6. Enter the new password and click **Sign In**. Pass: app redirects to `(tabs)` Home and greeting shows the user's first name.

### Failure criteria
- The verification code is not displayed in the UI in dev (blocking the test).
- Reset fails with a valid 6-digit code and matching 8+ character passwords.
- Sign-in with the new password fails.

## 4. Build / lint / typecheck (regression)

- `npm run typecheck --workspace=@lr/backend` → exit 0.
- `npm run typecheck --workspace=@lr/admin-dashboard` → exit 0.
- `cd mobile && npm run typecheck` → exit 0.
- `npm run lint --workspace=@lr/backend` → exit 0.
- `npm run lint --workspace=@lr/admin-dashboard` → exit 0.
- `cd mobile && npm run lint` → exit 0.
- `npm run build --workspace=@lr/admin-dashboard` → exit 0 and `dist/` created.

## Recording / annotations

- Start recording before the first UI interaction (admin login).
- Annotate `setup` for: opening admin dashboard, opening mobile, registering test account, creating ad fixtures.
- Annotate `test_start` for each major scenario:
  - `It should show cached data when network is offline`
  - `It should show 5 distinct ad slots across Home, Browse, Discover, My Pass, and Profile`
  - `It should remove ads from all tabs after deletion`
  - `It should reset password via phone and sign in with the new password`
- Annotate `assertion` after each pass/fail state change.

## Reporting

After execution, update `reports/e2e-test-report.md` and `reports/apple-review-checklist.md` only if UI issues or checklist changes are found. Include embedded screenshots of key states and any suggested code changes.
