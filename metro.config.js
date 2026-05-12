const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Force tslib to the root version to avoid pdf-lib's nested v1.x tslib 
// which has interop issues on web.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  tslib: path.resolve(__dirname, 'node_modules/tslib'),
};

// Ensure Metro doesn't even look at nested tslib folders which cause interop issues
config.resolver.blockList = [
  /.*[/\\]node_modules[/\\]+.*[/\\]node_modules[/\\]tslib[/\\]/,
];

module.exports = config;
