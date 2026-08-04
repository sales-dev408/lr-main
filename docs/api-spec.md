# API Specification

Base URL: `/api`. JSON request/response. Auth via `Authorization: Bearer <JWT>`.
JWT carries `sub` (subject id), `role` (`admin` | `vendor` | `customer`), and optionally `email`.
Errors: `{ "error": { "code": string, "message": string } }` with appropriate
HTTP status. CAPTCHA tokens are accepted when a CAPTCHA provider is configured.
**No MFA** by design.

Customer sign-in is **passwordless**: users register with first/last name + email/phone
and sign in with first/last name. Customer tokens expire after 365 days; admin/vendor
tokens expire after 7 days.

## Auth

| Method | Path | Role | Body → Response |
|---|---|---|---|
| POST | `/auth/register` | public | `{firstName, lastName, email?, phone?, city?, captchaToken?}` → `{token, expiresIn, profile}` |
| POST | `/auth/login` | public | `{firstName, lastName, captchaToken?}` → `{token, expiresIn, profile}` |
| POST | `/auth/social` | public | `{provider, token? idToken?, email?, fullName?}` → `{token, expiresIn, profile}` |
| POST | `/auth/vendor/login` | public | `{email, password, captchaToken?}` → `{token, profile}` |
| POST | `/auth/admin/login` | public | `{email, password, captchaToken?}` → `{token, profile}` |

## Customer profile

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/me` | customer | Current profile (`firstName`, `lastName`, `email`, `phone`, `city`, `status`). |
| PATCH | `/me` | customer | Update profile fields, e.g. `{city}` for local event/deal targeting. |
| GET | `/me/analytics` | customer | Redemption history and usage counts. |
| POST | `/me/push-token` | customer | Register an Expo push token and optional city for targeted pushes. |
| GET | `/me/pass` | customer | Fetch (or create on first call) the single membership pass. |
| POST | `/me/pass` | customer | Ensure the membership pass exists; `{platform?}` accepted for compatibility. |

## Cards & discounts

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/cards?theme=&city=` | public | Active cards + participating businesses + resolved discounts. `city` applies `city_overrides` and local flash-deal windows. |
| GET | `/cards/:id?city=` | public | Single card detail. |
| GET | `/vendors?category=` | public | Public vendor list with category filter. |
| GET | `/discounts/by-code/:code` | public | Resolve a vendor discount by its short public code. |
| GET | `/lookup/:lookupToken?city=&vendorId=` | public | Resolve a membership pass to customer + eligible discount. |
| GET | `/lookup/card/:cardId?city=&vendorId=` | public | Manual lookup by card and optional vendor. |
| POST | `/redeem` | public | Core redemption — see below. |

**`POST /redeem`**
```jsonc
// request
{ "lookupToken": "…",         // OR "cardId" + "userId"
  "vendorId": "…",
  "discountId": "…",           // optional; defaults to vendor's discount for the card
  "city": "Phoenix",           // optional; applies city_overrides
  "purchaseAmount": 42.00 }    // required for percent discounts
// response (valid)
{ "valid": true,
  "discount": { "type": "percent", "value": 15, "description": "15% off" },
  "amountApplied": 6.30,
  "instruction": "Apply 15% ($6.30) off manually at the register.",
  "redemptionId": "…" }
// response (invalid)
{ "valid": false, "reason": "max_uses_exceeded" }
```

## Wallet passes

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/passes/:serial` | PassKit auth | Latest pass for device (PassKit web service). |
| POST | `/passes/:serial/registrations/:deviceLibraryId` | PassKit auth | Register device. |
| DELETE | `/passes/:serial/registrations/:deviceLibraryId` | PassKit auth | Unregister. |

The membership pass and event tickets display **Code128 barcodes** generated with
the `lookup_token` (or ticket barcode). See `nfc-qr-flows.md`.

## Event tickets

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/tickets` | public or customer | List the customer's tickets. |
| GET | `/tickets/:id` | public or customer | Single ticket. |
| POST | `/tickets/:id/use` | public or customer | Decrement remaining uses and record usage. |
| GET | `/admin/tickets` | admin | List all tickets. |
| POST | `/admin/tickets` | admin | Create a ticket from a scanned barcode. `{barcode, name?, allowedUses?}` |
| PATCH | `/admin/tickets/:id` | admin | Update ticket. |
| DELETE | `/admin/tickets/:id` | admin | Delete ticket. |

## Events (RSS)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/events` | public | Return local events parsed from the configured RSS feed URLs. |
| GET | `/admin/events` | admin | Current RSS feed configuration. |
| PATCH/POST | `/admin/events` | admin | Update RSS feed URLs (implementation in admin console / Supabase Edge Function). |

## CMS content & theme

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/settings/theme` | public | Current mobile app theme colors, logo, layout. |
| GET | `/content` | public | Published Discover feed content. |
| GET | `/admin/content` | admin | All content including drafts. |
| POST | `/admin/content` | admin | Create content block. |
| PATCH | `/admin/content/:id` | admin | Update content. |
| DELETE | `/admin/content/:id` | admin | Delete content. |
| PATCH | `/admin/settings/theme` | admin | Update app theme. |

## Admin vendor management

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/admin/vendors?status=&city=&category=` | admin | List/filter; supports CSV export (`?format=csv`). |
| POST | `/admin/vendors` | admin | Create. Body: `{name, email?, phone?, address?, city?, category?, lat?, lng?, discountCode?}`. `pos_type` removed. |
| PATCH | `/admin/vendors/:id` | admin | Edit + status. |
| POST | `/admin/vendors/:id/approve` | admin | Approve pending vendor. |
| POST | `/admin/vendors/:id/reject` | admin | Reject pending vendor. |
| POST | `/admin/vendors/:id/reset-password` | admin | Returns temp password. |
| POST | `/admin/vendors/:id/qr` | admin | Regenerate discount Code128/barcode. |
| GET | `/admin/vendors/:id/pass` | admin | View vendor discount pass/barcode. |
| GET | `/admin/vendors/:id/activity` | admin | Activity log. |

## Admin cards & discounts

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/admin/cards` | admin | List cards. |
| GET | `/admin/cards/:id` | admin | Single card. |
| POST | `/admin/cards` | admin | Create master card. |
| PATCH | `/admin/cards/:id` | admin | Update (themes, global rules, expiration, max_uses, status). |
| DELETE | `/admin/cards/:id` | admin | Archive/delete. |
| POST | `/admin/cards/:id/vendors` | admin | `{vendorId}` add participating business. |
| DELETE | `/admin/cards/:id/vendors/:vendorId` | admin | Remove business. |
| POST | `/admin/discounts` | admin | `{cardId, vendorId, type, value, ...}` create per-business discount. |
| PATCH | `/admin/discounts/:id` | admin | Full edit. |
| DELETE | `/admin/discounts/:id` | admin | |

## Vendor portal

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/vendor/cards` | vendor | Cards this vendor participates in + their discount. |
| PATCH | `/vendor/discounts/:id` | vendor | Allowed fields: `value, min_purchase, max_uses_per_customer, active, city_overrides, starts_at, ends_at` (flash-deal window). Ownership enforced. |
| GET | `/vendor/analytics` | vendor | Vendor-scoped counts, by card. |
| POST | `/vendor/register` | public | Self-signup → `pending`. |

## QR onboarding

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/onboarding/:code` | public | Decode poster code → `{theme, card, vendor, appStoreUrl, playStoreUrl}` for auto-select. |
| GET | `/qr/onboarding.png?vendorId=&cardId=` | public | PNG QR encoding `lrcard://onboard?code=…` + https fallback. |
| GET | `/qr/lookup/:lookupToken.png` | public | PNG Code128/barcode image of the pass barcode. |

## Analytics

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/admin/analytics?from=&to=&city=` | admin | Totals (redemptions, unique customers), per-business usage, per-card, 30-day time series, top performers. |
| GET | `/vendor/analytics?period=daily\|weekly\|monthly` | vendor | Vendor-scoped counts and unique-customer insights. |

## Health
`GET /api/health` → `{status:"ok", db:true|false}`. `GET /` → `{name, version}`.
