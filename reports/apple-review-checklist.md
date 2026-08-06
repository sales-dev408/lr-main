# Apple Developer App Review Checklist (Comprehensive)

Status legend: [ ] Untested / Pending | [x] Tested / Pass | [!] Issue found | [N/A] Not applicable

## 1. App Store Metadata & Submission
- [N/A] App Name
  - Marketing metadata; not verified in this technical test.
- [N/A] Subtitle & Description
  - Marketing metadata; not verified.
- [N/A] Keywords
  - Marketing metadata; not verified.
- [N/A] Promotional Text
  - Marketing metadata; not verified.
- [N/A] Screenshots
  - Not produced in this test.
- [N/A] App Preview Video
  - Not produced in this test.
- [N/A] Age Rating Questionnaire
  - Not completed in this test.
- [N/A] Category Selection
  - Not verified.
- [N/A] Privacy Policy URL
  - A privacy policy is referenced in-app but the live public URL was not verified.

## 2. Privacy, Data Handling & Permissions
- [N/A] App Tracking Transparency (ATT)
  - No advertising/tracking SDK observed in the current build; not tested on a native device.
- [N/A] Privacy Nutrition Labels (App Store Privacy)
  - Not configured in this test.
- [x] User Data Collection
  - Registration collects first name, last name, email, and optional phone only; `legal.ts` discloses data use.
- [x] Account Deletion
  - `DELETE /api/me` returns 204 and the mobile Profile screen has a visible **Delete account** button in the Session section.
- [x] Permissions (Camera, Location, Photos, etc.)
  - `app.json` contains specific purpose strings for camera (scanning discount codes) and location (nearby stores); permission usage is gated in `browse.tsx`.
- [x] Sensitive Data
  - Backend stores password hashes; no plaintext credentials observed in transit or storage.

## 3. Functionality & User Experience
- [x] App Stability
  - No crashes or freezes during backend/admin/mobile web tests.
- [x] Onboarding
  - Mobile registration flow succeeded and redirected to the tabbed home screen.
- [!] Login/Signup
  - Email/password auth works. Backend supports `/api/auth/social` (Google), but no Sign in with Apple option is present. **If third-party social login is surfaced in the iOS app, App Store guidelines require Sign in with Apple.**
- [x] UI/UX Compliance
  - Web layouts render correctly; tab bar labels verified; native iOS Dynamic Type not exercised.
- [N/A] Offline Behavior
  - Not tested in this run.
- [x] Web Views
  - Sponsor ads open external links via `Linking.openURL`; no unrestricted in-app browser.

## 4. Technical Requirements
- [N/A] Build & Binary
  - Admin dashboard builds (`vite build`) and mobile typecheck/lint pass; native Xcode build not executed in this test.
- [N/A] Architecture Support
  - Not verified on native hardware.
- [N/A] iOS Version Compatibility
  - Not verified on native hardware.
- [N/A] Performance
  - No formal performance profiling performed.
- [!] Push Notifications
  - `POST /api/me/push-token` succeeds and the client registers a token; actual iOS APNs permission prompt/delivery not tested.
- [N/A] In-App Purchases (IAP)
  - No purchase/IAP flow exists in the current build; `legal.ts` mentions future paid subscriptions.
- [N/A] Background Modes
  - Not enabled/used.

## 5. Content & Legal Compliance
- [N/A] Copyright & Intellectual Property
  - Asset licensing not audited.
- [N/A] User-Generated Content (UGC)
  - No UGC features.
- [N/A] Health & Medical Claims
  - Not applicable.
- [N/A] Financial Apps
  - Not applicable.
- [N/A] Kids Category Apps
  - Not applicable.

## 6. App Review Information
- [x] Demo Account
  - Admin: `owner@example.com` / `ChangeMe123!`. A test customer was also created and exercised.
- [x] Notes for Reviewer
  - The onboarding `414` issue was caused by Fastify `maxParamLength` and has been fixed by raising it to `256`.
  - Missing backend routes (`GET /api/admin/vendors/:id`, `/api/admin/settings`, `/api/admin/profile`) have been added and verified in the E2E test.
  - Ticket functionality was removed from both admin dashboard and mobile app; no ticket references remain in the build.
  - Ad placeholders are limited to 3 slots and managed via new `/api/admin/ads` routes.
  - The `Live Trains` tab is now labeled `Train Schedule` and includes a disclaimer about schedule accuracy.
  - Admin vendors list now supports CSV export.
- [N/A] Contact Information
  - Not verified.
