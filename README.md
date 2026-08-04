# Light Rail Deals — Membership Card & Vendor Discount Platform

Monorepo for the Light Rail Deals membership pass, vendor discount system, admin dashboard, and mobile app.

## Packages

- `admin-dashboard` — React/Vite SPA for managing vendors, cards, content, theme, tickets, events, and analytics.
- `backend` — Fastify dev server and the reference `/api/*` contract.
- `mobile` — Expo/React Native app for customers (membership pass, vendor discounts, event tickets, map, push notifications).
- `supabase/functions/router/` — Deno Edge Function that implements the same `/api/*` contract on Supabase.

## Local development

```bash
npm install

# Backend (Node)
npm run dev --workspace=@lr/backend

# Admin dashboard
npm run dev --workspace=@lr/admin-dashboard

# Mobile (Expo)
cd mobile
npx expo start
```

## Verification

```bash
npm run lint --workspace=@lr/backend
npm run typecheck --workspace=@lr/backend
npm run test --workspace=@lr/backend

npm run lint --workspace=@lr/admin-dashboard
npm run typecheck --workspace=@lr/admin-dashboard
npm run build --workspace=@lr/admin-dashboard

cd mobile
npm run lint
npm run typecheck
```

## Deployment

- Backend/DB: see `docs/deploy-supabase.md`
- Admin dashboard: build with `npm run build --workspace=@lr/admin-dashboard` and deploy the `admin-dashboard/dist` folder to your static host (Vercel, Cloudflare Pages, etc.).
- Mobile: see `docs/deploy-mobile-eas.md`

See `docs/` for API spec, data model, POS integration, and NFC/barcode flows.
