# End-to-End Test Plan — `devin/feature-updates`

## Environment

- Backend: `npm run dev --workspace=@lr/backend` on `http://localhost:4000`
  - env: `DATABASE_URL=postgres://postgres:postgres@localhost:5432/lrmain`, `PGSSLMODE=disable`, `JWT_SECRET=dev-secret-change-me`, `ADMIN_EMAIL=owner@example.com`, `ADMIN_PASSWORD=ChangeMe123!`, `PORT=4000`, `NODE_ENV=development`
- Admin dashboard: `npm run dev --workspace=@lr/admin-dashboard` on `http://localhost:5173` (Vite proxies `/api` to `http://localhost:4000` per `vite.config.ts:7-9`).
- Mobile web: `cd mobile; npm run web -- --port 8081` (Expo) on `http://localhost:8081`; `EXPO_PUBLIC_API_BASE_URL` falls back to `http://localhost:4000/api` (`mobile/lib/config.ts:2`).
- Postgres: `lr-postgres` on `localhost:5432` already migrated/seeded; admin exists at `owner@example.com / ChangeMe123!`.

## Code Traces (plan grounded in)

- Backend routes mounted in `backend/src/app.ts:20-43`.
- Admin routes in `backend/src/routes/admin.ts:68-583` (cards, vendors, analytics, marketing, discounts).
- Ads routes in `backend/src/routes/ads.ts:14-82` (`/api/ads`, `/api/admin/ads` POST/PATCH/DELETE, slot 1-3 via migration `016_ads.sql:3`).
- Auth in `backend/src/routes/auth.ts:130-332` (captcha bypass in dev per `backend/src/services/captcha.ts:4-5`; `User-Agent` required for auth paths per `backend/src/plugins/security.ts:45-76`).
- Customer routes in `backend/src/routes/user.ts:72-194`, passes in `backend/src/routes/passes.ts:13-93`, mePass in `backend/src/routes/mePass.ts:79-102`.
- Vendor routes in `backend/src/routes/vendor.ts:10-237`.
- Lookup/redeem in `backend/src/routes/lookup.ts:10-112`, redemptions in `backend/src/routes/redemptions.ts:8-45`, QR in `backend/src/routes/qr.ts:25-72`, POS in `backend/src/routes/pos.ts:25-148`, events in `backend/src/routes/events.ts:221-274`, settings/theme+content in `backend/src/routes/settings.ts:40-117`.
- Admin dashboard nav in `admin-dashboard/src/components/Layout.tsx:8-18` (no Tickets item; Ads present). Routes in `admin-dashboard/src/App.tsx:15-38`.
- Vendors CSV export is client-side `downloadCsv(sorted)` triggered by `<Button>Export to CSV</Button>` (`admin-dashboard/src/pages/VendorsPage.tsx:363`, `downloadCsv` at lines 102-121).
- Ads UI in `admin-dashboard/src/pages/AdsPage.tsx` (slots 1-3, file upload to data URL, create/update/delete via `lib/api.ts:447-460`).
- Mobile tabs in `mobile/app/(tabs)/_layout.tsx:23-30` (`live` title is "Train Schedule"; no `tickets` route).
- Train schedule disclaimer in `mobile/app/(tabs)/live.tsx:472-484`.
- AdBanner in `mobile/components/AdBanner.tsx` fetches `/api/ads`, maps to `ScrollView horizontal pagingEnabled` of `Pressable` images (lines 16-83).
- Mobile auth in `mobile/app/auth.tsx:53-156` stores token via `mobile/lib/auth.tsx` and redirects to `/(tabs)` on success.

## 1. Backend Endpoint Tests (scripted)

Run a Node script (`reports/test-endpoints.js`) that:

1. Authenticates admin: `POST /api/auth/admin/login` with `User-Agent: test-agent` and body `{ "email": "owner@example.com", "password": "ChangeMe123!" }`. Expect `200` and `token`.
2. Authenticates a test customer: `POST /api/auth/register` with `User-Agent`, body with first/last name, email, password, `termsAccepted`, `privacyAccepted`, `eulaAccepted: true`. Expect `201` and `token`.
3. Registers a test vendor: `POST /api/vendor/register` with body `{ name, location, city, category, posType, email, password }`. Expect `201`.
4. Logs the vendor in: `POST /api/auth/vendor/login` with `User-Agent`. Expect `200` and `token`.
5. Calls each endpoint in the table below, recording `method`, `status`, `expected`, and any failure message.

| # | Method | Path | Auth | Expected | Notes |
|---|--------|------|------|----------|-------|
| 1 | GET | `/api/health` | none | 200 | `{ status: 'ok', db: true }` |
| 2 | GET | `/` | none | 200 | `{ name, version }` |
| 3 | POST | `/api/auth/admin/login` | none | 200 | returns admin token |
| 4 | POST | `/api/auth/register` | none | 201 | creates test customer |
| 5 | POST | `/api/auth/login` | none | 200 | customer token |
| 6 | POST | `/api/auth/social` | none | 200 | dummy Google token/idToken |
| 7 | POST | `/api/auth/vendor/login` | none | 200 | vendor token |
| 8 | GET | `/api/admin/cards` | admin | 200 | array |
| 9 | GET | `/api/admin/cards/:id` | admin | 200 | membership card detail |
| 10 | GET | `/api/admin/analytics` | admin | 200 | analytics shape |
| 11 | GET | `/api/admin/vendors` | admin | 200 | array |
| 12 | POST | `/api/admin/vendors` | admin | 201 | create a test vendor |
| 13 | PATCH | `/api/admin/vendors/:id` | admin | 200 | update vendor |
| 14 | POST | `/api/admin/vendors/:id/approve` | admin | 200 | status approved |
| 15 | POST | `/api/admin/vendors/:id/reject` | admin | 200 | status rejected |
| 16 | GET | `/api/admin/vendors/:id/pass` | admin | 200 or 404 | discount exists? |
| 17 | POST | `/api/admin/vendors/:id/reset-password` | admin | 200 | returns temp password |
| 18 | POST | `/api/admin/vendors/:id/qr` | admin | 200 | discount code + qrUrl |
| 19 | GET | `/api/admin/vendors/:id/activity` | admin | 200 | array |
| 20 | GET | `/api/admin/vendors/:id/analytics` | admin | 200 or 404 | vendor exists |
| 21 | POST | `/api/admin/marketing/blast` | admin | 200 or 4xx | may error if no recipients |
| 22 | POST | `/api/admin/cards` | admin | 201 | create a card |
| 23 | PATCH | `/api/admin/cards/:id` | admin | 200 | update card |
| 24 | DELETE | `/api/admin/cards/:id` | admin | 200 | delete card |
| 25 | POST | `/api/admin/cards/:id/vendors` | admin | 200 or 409 | add vendor to card |
| 26 | DELETE | `/api/admin/cards/:id/vendors/:vendorId` | admin | 200 | remove vendor |
| 27 | POST | `/api/admin/discounts` | admin | 201 | create discount |
| 28 | PATCH | `/api/admin/discounts/:id` | admin | 200 | update discount |
| 29 | DELETE | `/api/admin/discounts/:id` | admin | 200 | delete discount |
| 30 | GET | `/api/admin/ads` | admin | 200 | array |
| 31 | POST | `/api/admin/ads` | admin | 201 | slot 1-3, image_url |
| 32 | PATCH | `/api/admin/ads/:id` | admin | 200 | update link_url/active |
| 33 | DELETE | `/api/admin/ads/:id` | admin | 200 | delete ad |
| 34 | GET | `/api/admin/events` | admin | 200 | `{ urls, events }` |
| 35 | PATCH | `/api/admin/events` | admin | 200 | save RSS URLs |
| 36 | POST | `/api/admin/events/custom` | admin | 201 | create event |
| 37 | PATCH | `/api/admin/events/custom/:id` | admin | 200 | update event |
| 38 | DELETE | `/api/admin/events/custom/:id` | admin | 204 or 404 | delete event |
| 39 | GET | `/api/admin/settings/theme` | admin | 200 | theme object |
| 40 | PATCH | `/api/admin/settings/theme` | admin | 200 | save theme |
| 41 | GET | `/api/admin/content` | admin | 200 | array |
| 42 | POST | `/api/admin/content` | admin | 201 | create content block |
| 43 | PATCH | `/api/admin/content/:id` | admin | 200 | update content |
| 44 | DELETE | `/api/admin/content/:id` | admin | 200 | delete content |
| 45 | GET | `/api/admin/settings` | admin | 200/404 | **Note:** no route found in `settings.ts`; likely bug. |
| 46 | PATCH | `/api/admin/settings` | admin | 200/404 | **Note:** `SettingsPage.tsx` calls this, but no route found. |
| 47 | GET | `/api/admin/profile` | admin | 200/404 | no route found. |
| 48 | GET | `/api/cards` | none | 200 | public cards |
| 49 | GET | `/api/cards/:id` | none | 200 | card detail |
| 50 | GET | `/api/vendors` | none | 200 | public vendor directory |
| 51 | GET | `/api/me` | customer | 200 | profile |
| 52 | PATCH | `/api/me` | customer | 200 | update city/preferences |
| 53 | GET | `/api/me/analytics` | customer | 200 | analytics |
| 54 | POST | `/api/me/push-token` | customer | 200 | `{ registered: true }` |
| 55 | DELETE | `/api/me` | customer | 204 | delete customer (run last for this customer) |
| 56 | GET | `/api/me/pass` | customer | 200 | membership pass |
| 57 | POST | `/api/me/pass` | customer | 200 | create/return pass |
| 58 | POST | `/api/passes` | customer | 201 | create pass for a card |
| 59 | GET | `/api/passes/:serial` | none | 200 | pass detail |
| 60 | POST | `/api/passes/:serial/registrations/:deviceLibraryId` | none | 200 | `{ registered: true }` |
| 61 | DELETE | `/api/passes/:serial/registrations/:deviceLibraryId` | none | 200 | `{ deleted: true }` |
| 62 | GET | `/api/lookup/:lookupToken` | none | 200 or 404 | pass lookup |
| 63 | GET | `/api/discounts/lookup` | none | 200/400/404 | `?token=` |
| 64 | GET | `/api/discounts/by-code/:code` | customer | 200 or 409 | redeem by discount code |
| 65 | GET | `/api/lookup/card/:cardId` | none | 200 or 404 | card lookup |
| 66 | POST | `/api/redeem` | none | 200 | body with `discountCode` or `lookupToken` |
| 67 | POST | `/api/discounts/tokens` | customer | 200 | redemption token |
| 68 | POST | `/api/discounts/tokens/:token/affirm` | customer | 200 | affirm token |
| 69 | GET | `/redeem/:token` | none | 200 HTML | redemption page |
| 70 | GET | `/api/events` | none | 200 | public events |
| 71 | GET | `/api/settings/theme` | none | 200 | public theme |
| 72 | GET | `/api/content` | none | 200 | public content |
| 73 | GET | `/api/ads` | none | 200 | active ads |
| 74 | GET | `/api/vendor/cards` | vendor | 200 | vendor's cards |
| 75 | PATCH | `/api/vendor/discounts/:id` | vendor | 200/403 | update vendor's discount |
| 76 | GET | `/api/vendor/analytics` | vendor | 200 | vendor analytics |
| 77 | POST | `/api/vendor/register` | none | 201 | register vendor |
| 78 | GET | `/api/vendor/pos/connections` | vendor | 200 | connections |
| 79 | POST | `/api/vendor/pos/connections/:provider/connect` | vendor | 200/4xx/5xx | provider: square, clover, toast, stripe |
| 80 | DELETE | `/api/vendor/pos/connections/:provider` | vendor | 404 | no connection yet |
| 81 | POST | `/api/vendor/pos/connections/:provider/sync` | vendor | 404 | no connection |
| 82 | GET | `/api/pos/oauth/callback` | none | 302/400 | POS OAuth callback |
| 83 | GET | `/api/onboarding/:code` | none | 200/404 | decode onboarding code |
| 84 | GET | `/api/qr/onboarding.png` | none | 302/400 | QR image redirect |
| 85 | GET | `/api/qr/lookup/:lookupToken.png` | none | 302 | QR image redirect |

Pass/fail criteria: For each call, the actual HTTP status must equal the expected status (or fall within the allowed alternatives). Any non-2xx outside the allowed alternatives or any thrown network/parse error is a failure. Record response body keys for 2xx when relevant.

## 2. Admin Dashboard UI Tests

Start `npm run dev --workspace=@lr/admin-dashboard`.

1. **Login**: Open `http://localhost:5173/login`. Type `owner@example.com` / `ChangeMe123!`, click **Sign in**. Pass: URL changes to `/`, top bar shows `owner@example.com · owner`.
2. **Sidebar has Ads and no Tickets**: After login, inspect the bottom tab nav (`Layout.tsx` NAV_ITEMS). Pass: visible tabs are Overview, Vendors, Marketing, Cards, Events, Ads, Content, Theme, Settings; no "Tickets".
3. **Vendors page loads & CSV export works**: Click **Vendors**. Pass: page heading "Vendors" and list appears; click **Export to CSV** and a file named `vendors-<date>.csv` is downloaded to the default downloads directory within 3 seconds, containing header `Biz Name,...` and at least one row if vendors exist.
4. **Ads CRUD with 3-slot limit**: Click **Ads**. Pass: page shows "Ad placements" and "Current ads".
   - Create ad slot 1: choose slot 1, upload a test image (use `mobile/assets/images/logo.png` or a generated PNG), set link URL `https://example.com`, leave Active checked, click **Save ad**. Pass: list shows "Slot 1" with image.
   - Create ad slot 2 with a different image. Pass: list shows two ads.
   - Create ad slot 3. Pass: list shows three ads.
   - Attempt to create slot 1 again (conflict). Pass: server returns a 409 or overwrites and list still has exactly 3 slots (database uses `UNIQUE(slot)` on conflict update in `ads.ts:33-36`).
   - Edit slot 2, change link URL to `https://example.org`, click **Update ad**. Pass: list reflects new URL.
   - Delete slot 3. Pass: list removes slot 3.

## 3. Mobile Web UI Tests

Start `cd mobile; npm run web -- --port 8081`.

1. **Register / login**: Open the Expo web URL. If redirected to onboarding, click **Register**, fill first/last name, email, password, check legal opt-in, click **Create account**. Pass: app redirects to `/(tabs)` home, greeting shows name.
2. **Tab bar "Train Schedule" and no "Tickets"**: Look at the bottom tab bar. Pass: one tab is labeled **Train Schedule** (not "Live" or "Tickets") and there is no **Tickets** tab. Also the left collapsible sidebar (if width < 600 logical px) shows the same labels.
3. **Train schedule disclaimer**: Tap **Train Schedule**. Pass: screen heading "Train Schedule" visible; below the train cards a disclaimer appears with text beginning "The information provided is merely a schedule..." and ending "...arrival of trains." (exact text in `live.tsx:483-484`).
4. **AdBanner on home when ads configured**: From admin dashboard, ensure at least one active ad exists (slot 1). Return to mobile home. Pass: a "Sponsors" card appears with at least one ad image. If no ads are active, the card is absent. Verify via the network request to `/api/ads` returning active ads.
5. **Ads are horizontally scrollable and clickable**: With 2+ active ads, on home grab the Sponsors card and drag/swipe horizontally. Pass: images slide left/right. Tap an ad with `link_url`. Pass: the browser attempts to open the link (new tab/popup, or URL bar changes). If link is `https://example.com`, a new tab to `https://example.com` opens.

## 4. Build / Lint / Typecheck

Run in order:

- `cd C:/Users/Administrator/repos/lr-main; npm run typecheck --workspace=@lr/backend` → expect exit 0.
- `npm run typecheck --workspace=@lr/admin-dashboard` → expect exit 0.
- `cd mobile; npm run typecheck` → expect exit 0.
- `npm run lint --workspace=@lr/backend` → expect exit 0.
- `npm run lint --workspace=@lr/admin-dashboard` → expect exit 0.
- `cd mobile; npm run lint` → expect exit 0.
- `npm run build --workspace=@lr/admin-dashboard` → expect `dist/` created and exit 0.

Any non-zero exit or unhandled error is a failure. Capture full command output.

## 5. Checklist & Report

- Edit `C:/Users/Administrator/repos/lr-main/reports/apple-review-checklist.md`, replacing `[ ]` with `[x]` for verified items, `[!]` for issues, and `[N/A]` with notes for out-of-scope items.
- Produce `C:/Users/Administrator/repos/lr-main/reports/e2e-test-report.md` containing:
  - Summary of test approach.
  - Endpoint results table from the script.
  - UI checks results with before/after screenshots.
  - Build/lint/typecheck results.
  - Bugs found and the files/lines changed (if any temporary fixes were applied).
  - Paths to artifacts (report, recording, screenshots, endpoint log).

## Recording

- Start recording after all servers are up and before UI tests begin.
- Annotate with `setup`, `test_start`, and `assertion` events for: admin login, sidebar Ads check, Vendors CSV, Ads CRUD, mobile tab label check, train schedule disclaimer, AdBanner rendering/click.
