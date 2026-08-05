# Light Rail Deals E2E API Probe Report
Generated: 2026-08-05T01:02:50.940Z

## Summary
- Base URL: https://okbolfpndeakmchpznmt.supabase.co/functions/v1/router
- Endpoints tested: 40
- Passed: 37
- Failed/Unexpected: 3

## Test Accounts
- Apple Reviewer account: `apple.reviewer.07b7368e996e@lightraildeals.com` / `+15554542283` / `ReviewPass123!`
- Admin test account: `devin.test.admin@lightraildeals.com` / `AdminTest123!`

## Results
| Category | Endpoint | Status | Notes |
|---|---|---|---|
| public | GET /api/health | 200 | db=true |
| auth | POST /api/auth/register | 201 | id=3dea9044-a3c9-447f-bc4a-e77d9da54452 |
| auth | POST /api/auth/register (duplicate) | 409 | duplicate |
| auth | POST /api/auth/login | 200 | customer login OK |
| auth | POST /api/auth/login (wrong password) | 401 | unauthorized |
| admin-auth | POST /api/auth/admin/login | 200 | admin login OK |
| customer | GET /api/me | 200 | profile fetched |
| customer | PATCH /api/me | 200 | profile updated |
| customer | GET /api/me/analytics | 200 | redemptions=0 |
| customer | GET /api/cards | 200 | 1 cards |
| customer | GET /api/cards/e872ede3-78a3-42fa-a473-67831e7e8b1a | 200 | card detail |
| customer | GET /api/vendors | 200 | 6 vendors |
| customer | GET /api/vendors/131e0210-aa7a-49f8-8cc0-567c48c0b673 | 200 | vendor detail |
| customer | GET /api/tickets | 200 | 1 tickets |
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
| admin | GET /api/admin/cards | 200 | 1 cards |
| admin | GET /api/admin/content | 200 | 0 content |
| admin | GET /api/admin/events | 200 | 0 events |
| admin | GET /api/admin/settings | 200 | settings fetched |
| admin | GET /api/admin/tickets | 200 | 1 tickets |
| admin | POST /api/admin/vendors | 201 | created 627d0ff0-bfd4-4938-927a-f73ace6c957d |
| admin | GET /api/admin/vendors/{id}/activity | 200 | activity |
| admin | GET /api/admin/vendors/{id}/analytics | 200 | analytics |
| admin | POST /api/admin/vendors/{id}/qr | 200 | qr |
| admin | POST /api/admin/vendors (BOGO no description) | 400 | rejected |
| admin | POST /api/admin/marketing/blast | 200 | emails=0 sms=0 |
| admin | POST /api/admin/tickets | 201 | created 060ab52e-90a2-40e7-aa1c-92f3016def4f |
| customer | POST /api/tickets/enter | 200 | entered drawing |

## Notes
- Marketing blast requires Mailjet credentials; expected 400/500 if not configured.
- Pass wallet URLs depend on Passcreator configuration.
