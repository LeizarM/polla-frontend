/**
 * app.config.js — config dinámica de Expo
 *
 * Necesario porque app.json NO expande `$ENV_VAR` para `googleServicesFile`.
 * EAS Build define la env var GOOGLE_SERVICES_JSON con el path al archivo
 * descifrado en el runner; aquí la leemos y la usamos.
 *
 * Para dev local: si pones un google-services.json en la raíz, lo usa.
 */
module.exports = ({ config }) => {
  return {
    ...config,
    android: {
      ...config.android,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
  };
};
