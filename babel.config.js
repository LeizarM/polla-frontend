module.exports = function(api) {
  api.cache(true);
  return {
    presets: [
      // jsxImportSource: 'nativewind' es todo lo que NativeWind v4 necesita de Babel.
      // La transformación real la hace el Metro transformer (withNativeWind en metro.config.js).
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
    ],
    plugins: [
      // ⚠️ Reanimated v4: el plugin de worklets se movió a react-native-worklets.
      // Usar 'react-native-reanimated/plugin' (el de v3) deja los worklets SIN
      // transformar → crashean NATIVAMENTE en release APK (aunque a veces
      // funcionan en dev). Debe ser el ÚLTIMO plugin de la lista.
      'react-native-worklets/plugin',
    ],
  };
};
