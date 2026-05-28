module.exports = function(api) {
  api.cache(true);
  return {
    presets: [
      // jsxImportSource: 'nativewind' es todo lo que NativeWind v4 necesita de Babel.
      // La transformación real la hace el Metro transformer (withNativeWind en metro.config.js).
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
    ],
    plugins: [
      'react-native-reanimated/plugin',
    ],
  };
};
