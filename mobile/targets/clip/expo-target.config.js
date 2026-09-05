/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'clip',
  // Enable React Native bundling for production builds.
  exportJs: true,
  entitlements: {
    // Associated domains for App Clip invocation via URL/QR/NFC.
    'com.apple.developer.associated-domains': ['appclips:lightraildeals.com'],
  },
};
