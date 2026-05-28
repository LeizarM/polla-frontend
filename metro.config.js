const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: './global.css',   // apunta al CSS que creamos
  // inlineRem: 16 → equivale a rem base 16px
});
