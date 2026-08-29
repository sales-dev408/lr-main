const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Resolve the @/ alias from tsconfig.json so require('@/assets/images/...') works.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@/')) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(__dirname, 'package.json') },
      './' + moduleName.replace('@/', ''),
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
