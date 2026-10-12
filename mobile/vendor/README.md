# Vendored security patches

`package.json` pins these two transitive dependencies to locally patched
tarballs (via direct `file:` dependencies plus `"$name"` overrides) because
npm has no released fix for either advisory.

## `braces-3.0.4.tgz` (upstream 3.0.3 + patch)

- Advisory: GHSA-vfj7-8cjw-p6xm / CVE-2026-93687 — stack exhaustion via
  deeply nested brace patterns in the recursive AST walkers.
- Fix: `maxDepth` option (default 250, `false` disables) added to the
  `walk`/`stringify` recursions in `lib/compile.js`, `lib/expand.js`, and
  `lib/stringify.js`. Exceeding it throws a catchable `RangeError`, same
  style as the existing `rangeLimit` guard.
- Remove when upstream ships a release containing a depth guard.

## `node-forge-1.4.1.tgz` (upstream 1.4.0 + patch)

- Advisory: GHSA-86w9-cpqp-85rv / CVE-2026-85393 — RSA PKCS#1 v1.5
  signature verification accepts extra nested `DigestAlgorithm` elements,
  allowing signature forgery with low-exponent keys.
- Fix: in `lib/rsa.js` `RSASSA-PKCS1-V1_5.verify`, require the nested
  `DigestAlgorithm` SEQUENCE to contain at most 2 elements (OID + optional
  NULL), matching upstream PR digitalbazaar/forge#1152.
- Remove when upstream ships a release with this check (expected as 1.4.1).

## Rebuilding

```sh
npm pack <extracted patched source dir> --pack-destination vendor/
```

Keep `vendor/` committed so `npm install` works offline and on EAS.
