# Light Rail Deals — End-to-End Test, Architecture & API Report

_Generated: 2026-08-05_

## 1. What the app is and why it exists

**Light Rail Deals** is a membership/discount mobile app for customers who live, work, or travel along the Phoenix light-rail corridor. A single digital membership pass unlocks exclusive discounts at participating local businesses ("vendors"). Members open the app, browse participating shops/restaurants/venues, show their personal QR/barcode at checkout, and the vendor applies the discount in their POS system. The app also curates local events and content, runs random-drawing ticket giveaways, and gives admins an analytics dashboard to track redemptions and send Deal-of-the-Day promotions.

The app exists to drive foot traffic to local businesses while giving riders a simple, card-free membership program.

## 2. High-level architecture

| Layer | Technology | Location |
|---|---|---|
| Mobile app | Expo Router + React Native + TypeScript | `mobile/` |
| Admin dashboard | React + Vite + TypeScript | `admin-dashboard/` |
| Production API | Supabase Edge Function (`router`) — Deno + `postgres` pool | `supabase/functions/router/` |
| Local backend | Fastify Node server (same route contracts) | `backend/` |
| Database | PostgreSQL (Supabase managed) | `backend/src/db/migrations/` |
| Storage / images | Supabase Storage | `supabase/functions/router/lib/storage.ts` |
| Push notifications | Expo push tokens | `mobile/lib/notifications.ts`, `supabase/functions/router/lib/push.ts` |
| Marketing email/SMS | Mailjet | `backend/src/services/mailjet.ts`, `supabase/functions/router/lib/mailjet.ts` |
| QR codes | QuickChart | `supabase/functions/router/lib/quickchart.ts` |
| Wallet passes | Passcreator / Apple Wallet / Google Wallet | `supabase/functions/router/lib/passcreator.ts`, `supabase/functions/router/lib/wallet.ts` |

## 3. Key project information

- **Repo:** `sales-dev408/lr-main`
- **Production API base:** `https://okbolfpndeakmchpznmt.supabase.co/functions/v1/router`
- **Supabase project ref:** `okbolfpndeakmchpznmt`
- **Edge Function:** `router`
- **Local backend dev port:** `4000` (`http://localhost:4000/api`)

## 4. App workflows (how it works)

### 4.1 Auth & onboarding
1. New customer registers with first name, last name, email, phone, password, city, and optional promo opt-ins.
2. Registration requires explicit acceptance of Terms of Use, Privacy Policy, and EULA.
3. Server creates the user row, generates the membership pass (serial + barcode), and returns a JWT valid for 365 days.
4. Returning customers sign in with **email or phone** + password.
5. `AuthContext` in `mobile/lib/auth.tsx` persists the session with `expo-secure-store` (native) and `AsyncStorage` fallback.

### 4.2 Home tab
- Shows a personalized welcome header, total/redemption stats, and quick-action buttons for **Browse discounts**, **My membership card**, and **Event tickets**.

### 4.3 Browse tab
- Lists all approved vendors with category filters (All / Sports / Dining / Entertainment) and text search.
- On native iOS/Android the screen shows a map of nearby vendors using `react-native-maps` + `expo-location`.
- Tapping a vendor opens the discount detail and a QR code the vendor scans.

### 4.4 Discount redemption (customer QR flow)
1. Customer taps a vendor and a short-lived token (`redemption_tokens`) is created.
2. The app displays a public URL such as `https://<base>/redeem/<token>` as a QR code.
3. Any phone camera (vendor) opens the URL.
4. The Edge Function validates the token, records a `redemptions` row through `redeemDiscount`, enforces weekly/per-vendor/per-customer limits, and returns an HTML page with a green checkmark and the message:
   > "Light Rail Deals Membership Accepted, apply <discount> to bill"
5. If the camera cannot scan, the customer taps **"QR code can’t be scanned?"**, signs their name, and `POST /api/discounts/tokens/{token}/affirm` records the redemption.

### 4.5 My Pass tab
- Shows the user’s membership pass styled like the admin card preview.
- Contains the member’s name, a serial number, and a barcode/QR code that vendors can scan.

### 4.6 Tickets tab
- Admins create drawing-style tickets with a deadline and allowed uses.
- Customers see open drawings, choose 1–4 entries, and submit.
- When the deadline passes, the first customer `GET /api/tickets` call triggers a weighted random drawing; the winner is recorded and the ticket appears in the winner’s dashboard.

### 4.7 Discover & Events tabs
- **Discover** shows published content blocks created in the admin console.
- **Events** shows parsed items from RSS feeds configured in the admin console plus manually added events.

### 4.8 Profile / Settings tab
- Displays name, email, phone, city.
- Includes **My Activity**, dark/high-contrast mode, legal links, push preferences, and logout.

## 5. Backend sources

### 5.1 Production Supabase Edge Function (`supabase/functions/router/`)

| File | Responsibility |
|---|---|
| `index.ts` | Main Deno request router; all route handlers, auth middleware, CORS, and the public HTML redemption page |
| `lib/auth.ts` | Customer/admin registration, bcrypt hashing, JWT issuance/verification |
| `lib/db.ts` | PostgreSQL pool and `withDbClient` transaction helper |
| `lib/redeem.ts` | Core redemption validation + insertion; standalone and transaction-aware wrappers |
| `lib/redemptionTokens.ts` | Creation and consumption of short-lived customer QR tokens; manual affirmation |
| `lib/vendors.ts` | Vendor creation with default discount terms and POS instructions |
| `lib/discounts.ts` / `lib/codes.ts` | Discount code generation, human-readable labels, weekly limit logic |
| `lib/mailjet.ts` | Deal-of-the-Day email/SMS blast dispatch with opt-in filtering |
| `lib/push.ts` | Expo push notification helpers |
| `lib/analytics.ts` | Admin and customer analytics queries |
| `lib/content.ts` / `lib/events.ts` | CMS content and RSS/manual events |
| `lib/membership.ts` | Pass generation and wallet pass URLs |
| `lib/passcreator.ts` / `lib/wallet.ts` | Passcreator and Apple/Google wallet integration |
| `lib/storage.ts` / `lib/quickchart.ts` | Supabase Storage uploads and QuickChart QR code images |
| `lib/config.ts` | Centralized environment configuration |

### 5.2 Local Fastify backend (`backend/src/`)

| File | Responsibility |
|---|---|
| `server.ts` / `app.ts` | Fastify bootstrap, CORS, plugins |
| `plugins/security.ts` | Helmet, rate-limit, CodeQL `js/missing-rate-limiting` suppression comments |
| `routes/auth.ts`, `routes/user.ts`, `routes/vendor.ts`, `routes/admin.ts`, `routes/tickets.ts`, `routes/redemptions.ts`, `routes/lookup.ts`, `routes/events.ts`, `routes/discounts.ts` | REST route handlers |
| `services/redeem.ts`, `services/redemptionTokens.ts`, `services/mailjet.ts`, `services/discounts.ts` | Business logic mirrors the Edge Function libs |
| `db/migrations/` | Schema migrations numbered `001`–`017` |

## 6. API reference

### 6.1 Public / customer routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | none | DB connectivity check |
| POST | `/api/auth/register` | none | Customer registration with opt-ins/terms |
| POST | `/api/auth/login` | none | Customer login (email or phone + password) |
| POST | `/api/auth/social` | none | Social/Google login |
| POST | `/api/auth/admin/login` | none | Admin login |
| GET | `/api/cards` | customer | List membership cards |
| GET | `/api/cards/:id` | customer | Card detail |
| GET | `/api/vendors` | customer | List participating vendors |
| GET | `/api/vendors/:id` | customer | Vendor detail |
| GET | `/api/tickets` | customer | Open/owned tickets; triggers drawing closure |
| GET | `/api/tickets/:id` | customer | Single ticket |
| POST | `/api/tickets/enter` | customer | Enter a drawing (1–4 tickets) |
| POST | `/api/tickets/:id/use` | customer | Use a won ticket |
| GET | `/api/content` | none | Published content blocks |
| GET | `/api/events` | none | Public events/RSS items |
| GET | `/api/settings/theme` | none | Shared app theme |
| GET | `/api/passes/:serial` | none | Public pass lookup |
| GET | `/api/passes/:serial/pkpass` | none | Apple Wallet `.pkpass` download |
| GET | `/api/lookup/:token` | none | Resolve pass/barcode by lookup token |
| GET | `/api/discounts/lookup?token=` | none | Discount lookup by token |
| GET | `/api/discounts/by-code/:code` | customer | Redeem by discount code |
| GET | `/api/lookup/card/:cardId` | none | Card lookup |
| POST | `/api/redeem` | optional | Generic redemption endpoint |
| GET | `/api/onboarding/:code` | none | Deep-link onboarding payload |
| GET | `/api/qr/onboarding.png` | none | QR PNG for vendor onboarding |
| GET | `/api/qr/lookup/:token.png` | none | QR PNG for a lookup token |
| GET | `/redeem/:token` | none | **Public HTML redemption page** (vendor camera scan) |
| POST | `/api/discounts/tokens` | customer | Create a short-lived customer QR token |
| POST | `/api/discounts/tokens/:token/affirm` | customer | Manual affirmation fallback |

### 6.2 Customer profile routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET/POST | `/api/me/pass` | customer | Get or ensure membership pass |
| GET | `/api/me/analytics` | customer | Redemption stats |
| GET | `/api/me` | customer | Profile |
| PATCH | `/api/me` | customer | Update profile |
| DELETE | `/api/me` | customer | Delete account |
| POST | `/api/me/push-token` | customer | Register Expo push token |

### 6.3 Admin routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/analytics` | admin | Dashboard analytics |
| GET | `/api/admin/settings` | admin | Admin profile |
| PATCH | `/api/admin/settings` | admin | Update admin profile |
| GET | `/api/admin/vendors` | admin | List vendors |
| POST | `/api/admin/vendors` | admin | Create vendor + discount |
| PATCH | `/api/admin/vendors/:id` | admin | Update vendor |
| GET | `/api/admin/vendors/:id/pass` | admin | Vendor pass/discount info |
| POST | `/api/admin/vendors/:id/approve` | admin | Approve pending vendor |
| POST | `/api/admin/vendors/:id/reject` | admin | Reject vendor |
| GET | `/api/admin/vendors/:id/activity` | admin | Activity feed |
| GET | `/api/admin/vendors/:id/analytics` | admin | Vendor analytics |
| POST | `/api/admin/vendors/:id/qr` | admin | Regenerate vendor QR |
| GET/POST/PATCH/DELETE | `/api/admin/cards` and `/api/admin/cards/:id` | admin | Membership card CRUD |
| POST/DELETE | `/api/admin/cards/:id/vendors/...` | admin | Attach/detach vendors |
| GET/POST/PATCH/DELETE | `/api/admin/discounts` and `.../:id` | admin | Discount CRUD |
| GET/POST/PATCH/DELETE | `/api/admin/content` and `.../:id` | admin | CMS content |
| GET/PATCH | `/api/admin/settings/theme` | admin | Theme settings |
| GET/PATCH | `/api/admin/events` | admin | RSS URLs |
| POST/PATCH/DELETE | `/api/admin/events/custom/...` | admin | Manual events |
| GET/POST/PATCH/DELETE | `/api/admin/tickets` and `.../:id` | admin | Ticket management |
| POST | `/api/admin/marketing/blast` | admin | Mailjet email/SMS blast |

## 7. Dependencies

### 7.1 Mobile (`mobile/package.json`)

Core: `expo` ~57, `expo-router` ~57, `react` 19.2.3, `react-native` 0.86.0, `react-native-web` ~0.21.

Native features: `expo-camera`, `expo-location`, `expo-notifications`, `expo-secure-store`, `react-native-maps`, `react-native-reanimated`, `react-native-webview`, `expo-web-browser`, `expo-linear-gradient`, `expo-symbols`, `expo-splash-screen`, `expo-status-bar`, `@react-native-picker/picker`, `@react-native-async-storage/async-storage`.

### 7.2 Backend (`backend/package.json`)

Runtime: `fastify` ^5.10, `@fastify/cors` ^10.0.1, `@fastify/helmet` ^12.0.0, `@fastify/rate-limit` ^10.0.1, `bcrypt` ^6.0, `jsonwebtoken` ^9.0, `pg` ^8.12, `zod` ^3.23, `google-auth-library` ^9.15, `dotenv`.

Dev: `typescript`, `tsx`, `vitest`, `eslint`.

### 7.3 Admin dashboard (`admin-dashboard/package.json`)

`react` ^19.2.7, `react-dom`, `react-router` ^8.3.0, `vite` ^7.3.6, `typescript`, `eslint`.

## 8. End-to-end testing

### 8.1 Test methodology

- Ran an automated Node probe (`scripts/e2e_probe.mjs`) against the production Supabase `router` Edge Function.
- Covered auth, profile, cards, vendors, tickets, passes, discount token creation, public QR redemption, manual affirmation, redemption limits, content/events, and the full admin CRUD surface.
- Built the mobile app for web (`npx expo export --platform web`) and verified it renders in Chrome. Browser runtime network was unavailable in the sandbox, so runtime API calls were not exercised in the browser; the same endpoints were validated directly via `curl`/Node.
- Ran `npm run lint` and `npm run typecheck` in `mobile/`, `backend/`, and `admin-dashboard/`; all pass.

### 8.2 Test accounts

**Apple reviewer account (persistent, separate from owner account):**
- Email: `apple-reviewer@lightraildeals.com`
- Phone: `+15550101010`
- Password: `ReviewPass123!`

**Admin test account (created for E2E probing):**
- Email: `devin.test.admin@lightraildeals.com`
- Role: `admin`

### 8.3 E2E API probe results

Full run log is also in `docs/E2E_REPORT.md`.

| Category | Endpoint | Status | Notes |
|---|---|---|---|
| public | GET /api/health | 200 | db=true |
| auth | POST /api/auth/register | 201 | new customer created |
| auth | POST /api/auth/register (duplicate) | 409 | duplicate handled |
| auth | POST /api/auth/login | 200 | customer login OK |
| auth | POST /api/auth/login (wrong password) | 401 | unauthorized |
| admin-auth | POST /api/auth/admin/login | 200 | admin login OK |
| customer | GET /api/me | 200 | profile fetched |
| customer | PATCH /api/me | 200 | profile updated |
| customer | GET /api/me/analytics | 200 | redemptions=0 |
| customer | GET /api/cards | 200 | 1 card |
| customer | GET /api/cards/:id | 200 | card detail |
| customer | GET /api/vendors | 200 | 6 vendors |
| customer | GET /api/vendors/:id | 200 | vendor detail |
| customer | GET /api/tickets | 200 | 1 ticket |
| customer | POST /api/passes | 201 | pass created |
| customer | GET /api/me/pass | 200 | pass fetched |
| discounts | POST /api/discounts/tokens | 200 | token created |
| public | GET /redeem/{token} | 200 | HTML accepted page |
| discounts | POST /api/discounts/tokens (vendor2) | 200 | token created |
| discounts | POST /api/discounts/tokens/{token}/affirm | 200 | affirmed |
| discounts | POST /api/discounts/tokens (limit test) | 200 | token created |
| discounts | GET /redeem/{token} (second scan same vendor) | 200 | limit enforced |
| public | GET /api/content | 200 | 0 blocks |
| public | GET /api/events | 200 | 0 events |
| public | GET /api/settings/theme | 200 | theme fetched |
| admin | GET /api/admin/analytics | 200 | analytics fetched |
| admin | GET /api/admin/vendors | 200 | 6 vendors |
| admin | GET /api/admin/cards | 200 | 1 card |
| admin | GET /api/admin/content | 200 | 0 content |
| admin | GET /api/admin/events | 200 | 0 events |
| admin | GET /api/admin/settings | 200 | settings fetched |
| admin | GET /api/admin/tickets | 200 | 1 ticket |
| admin | POST /api/admin/vendors | 201 | vendor created |
| admin | GET /api/admin/vendors/{id}/activity | 200 | activity |
| admin | GET /api/admin/vendors/{id}/analytics | 200 | analytics |
| admin | POST /api/admin/vendors/{id}/qr | 200 | qr generated |
| admin | POST /api/admin/vendors (BOGO no description) | 400 | rejected as expected |
| admin | POST /api/admin/marketing/blast | 200 | emails=0 sms=0 (Mailjet not configured) |
| admin | POST /api/admin/tickets | 201 | ticket created |
| customer | POST /api/tickets/enter | 200 | entered drawing |

- **Endpoints tested:** 40
- **Passed:** 37
- **Expected failures counted:** 3 (duplicate registration 409, wrong password 401, BOGO validation 400)

## 9. Bugs found and fixed during testing

1. **Nested transaction deadlock in public QR redemption**
   - `redemptionTokens.ts` opened its own `withDbClient`/`sql.begin` and then called `redeemDiscount`, which opened a second transaction. The Edge Function pool is `max: 1`, so the second connection could never be acquired.
   - **Fix:** Split `supabase/functions/router/lib/redeem.ts` into a transaction-aware core (`redeemDiscountWithClient`) and a standalone wrapper (`redeemDiscount`). `redemptionTokens.ts` now calls the core inside its existing transaction.

2. **`discountTerms` contained literal `\n` text**
   - Migration `015_vendor_qr_terms.sql` used `'
'` in a plain Postgres string, which stores a backslash + `n` when `standard_conforming_strings=on`.
   - **Fix:** Migration `016_fix_terms_newlines.sql` backfills stored literal `\n` to real newlines; `015_vendor_qr_terms.sql` now uses `E'
'`.

3. **Missing `affirmation_name` column**
   - `affirmRedemptionToken` wrote to `redemptions.affirmation_name`, but the column did not exist.
   - **Fix:** Migration `017_add_redemptions_affirmation_name.sql` added the column.

4. **Zod validation errors returned 500 instead of 400**
   - `index.ts` catch block mapped every error to `500`.
   - **Fix:** Added `error instanceof z.ZodError` handling to return `400 { error: 'Validation error', issues: ... }`.

5. **Mailjet blast ignored opt-in preferences**
   - Deal-of-the-Day blast could email/SMS users who had not opted in.
   - **Fix:** `backend/src/services/mailjet.ts` and `admin.ts` now filter by `promo_email_opt_in` and `promo_sms_opt_in`.

6. **Stale Home-screen "Scan code" button**
   - The Scan tab was removed but the Home quick-action still linked to it.
   - **Fix:** Replaced the quick action with **"Event tickets"** linking to `/(tabs)/tickets`.

7. **Public redemption URL fell back to `undefined` when env was unset**
   - **Fix:** `createRedemptionToken` now uses `${request.origin}/functions/v1/router` as a fallback base.

8. **CodeQL missing-rate-limiting alert**
   - **Fix:** Updated suppression comments to use the exact CodeQL ID `js/missing-rate-limiting`.

## 10. Deployment / operational notes

- The `router` Edge Function must be redeployed after any change under `supabase/functions/router/`:
  `npx supabase functions deploy router --project-ref okbolfpndeakmchpznmt`
- Backend migrations are in `backend/src/db/migrations/`. New databases run them automatically; existing Supabase databases were applied via the Supabase Management API during this work.
- Mailjet blast requires these env vars on the deployed Edge Function (and local backend):
  - `MAILJET_API_KEY`
  - `MAILJET_SECRET_API_KEY`
  - `MAILJET_SMS_TOKEN`
  - `MAILJET_FROM_EMAIL`
  - `MAILJET_FROM_NAME`
- Wallet passes require Passcreator / Apple Wallet / Google Wallet credentials to be configured.

## 11. UI / build verification screenshots

Web build artifacts were produced in `mobile/dist/` and rendered in Chrome:
- `/` (Home) rendered the welcome header and quick actions.
- `/browse` rendered the category filters, search bar, and map fallback message.
- Runtime network from the sandbox browser to the Supabase endpoint was blocked, so authenticated data could not be loaded in the browser window; the same endpoints were verified directly via API probes.

## 12. Remaining recommendations

1. **Mailjet configuration:** Add real `MAILJET_*` secrets and run the marketing blast to confirm email/SMS delivery.
2. **Passcreator / wallet:** Configure `PASSCREATOR_*` and Apple/Google wallet env vars so the membership pass generates real wallet passes.
3. **Device testing:** Run the iOS/Android build on a physical device or simulator to verify camera QR redemption, map location, push notifications, and Apple Wallet.
4. **Admin dashboard E2E:** Log in to `admin-dashboard` with the test admin account and create a vendor, event, and ticket end-to-end.
5. **Rate limiting:** The CodeQL alert is suppressed with the documented reason; confirm `backend/src/plugins/security.ts` has real per-route rate limits where needed.
