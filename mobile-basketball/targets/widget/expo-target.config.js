/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'LightRailWidget',
  displayName: 'Light Rail Deals',
  // iOS 18+ for accented rendering mode and latest WidgetKit APIs.
  deploymentTarget: '18.0',
  // Share data between the widget and the main app via App Groups.
  entitlements: {
    'com.apple.security.application-groups': ['group.com.lightraildeals.app'],
  },
};
