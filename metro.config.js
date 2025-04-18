const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname)

config.resolver.assetExts.push(
  'm4a',
  'mp3'
);

module.exports = withNativeWind(config, { input: './global.css' })