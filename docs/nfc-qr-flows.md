# NFC + Barcode Flows

Two barcode purposes and one NFC purpose:

1. **Onboarding QR** (on business posters) → drives app install + auto-select.
2. **Redemption barcode** (in the wallet pass and event tickets) → carries the `lookup_token` as a Code128 barcode.
3. **NFC tap** (Apple VAS) → transmits the same `lookup_token` contactlessly.

## 1. Onboarding QR (poster → app → auto-select)

```
Business poster QR
   encodes:  https://app.example.com/onboard?code=<CODE>
             (with lrcard://onboard?code=<CODE> deep link + store fallback)
        │
        ▼
Phone camera opens link ──▶ not installed? ──▶ App Store / Play Store
        │                                            │
        └──────────────── app installed ─────────────┘
        ▼
First launch reads code ──▶ GET /api/onboarding/:code
        ▼
Response { theme, card, vendor, appStoreUrl, playStoreUrl }
        ▼
App pre-selects the theme + business, then prompts sign-up.
```

`CODE` is an opaque short encoding of `(vendorId, cardId)`. Generate the PNG via
`GET /api/qr/onboarding.png?vendorId=&cardId=`.

## 2. Redemption barcode (wallet pass / event tickets)

The wallet pass and event tickets embed a **Code128 barcode** whose message is the
`lookup_token` (opaque; not the customer's identity). Apple `pass.json`:

```jsonc
"barcodes": [
  { "format": "PKBarcodeFormatCode128",
    "message": "<lookup_token>",
    "messageEncoding": "iso-8859-1",
    "altText": "<short human code>" }
]
```

At the register the vendor scans the Code128 barcode → `GET /api/lookup/:lookupToken` → `POST
/api/redeem`. The token is opaque, single-purpose, and every use is audited, so
a leaked screenshot only risks a bounded, rule-limited discount — not account
access.

## 3. NFC tap (Apple VAS)

Apple **Value Added Service (VAS)** lets an iPhone transmit a pass to a
compatible NFC reader with a tap. The `pass.json` includes an `nfc` block:

```jsonc
"nfc": {
  "message": "<lookup_token>",
  "encryptionPublicKey": "<base64 P-256 public key>",
  "requiresAuthentication": false
}
```

- `message` is the same `lookup_token` used by the QR path, so NFC and QR feed
  the identical `/redeem` flow.
- `encryptionPublicKey` is the merchant/reader public key (P-256) used by VAS to
  encrypt the transmitted payload. It is configured per deployment.
- Google Wallet uses **Smart Tap** analogously; the generic pass is configured
  with the redemption value on the issuer object.

```
Customer taps phone on NFC reader
        │  (Apple VAS / Google Smart Tap)
        ▼
Reader/vendor tablet receives lookup_token
        ▼
GET /api/lookup/:lookupToken  ──▶  POST /api/redeem  ──▶  cashier applies discount
```

## Fallback: manual code

If NFC/QR are unavailable, the customer reads a short `altText` code; the vendor
enters it via `GET /api/lookup/card/:cardId` (or a code→token resolver) and
proceeds to `/redeem`. Same validation, same audit trail.

## Discount math at tap/scan

Resolved server-side in `/redeem` (after city overrides):

| type | amount applied | cashier action |
|---|---|---|
| `percent` | `purchaseAmount × value / 100` | apply that % (needs purchase amount) |
| `fixed` | `value` | subtract fixed $ amount |
| `bogo` | 0 (instructional) | comp the lower-priced qualifying item |

The response always includes a plain-English `instruction` string for the cashier.
