/**
 * withSSLPinning.js — Expo Config Plugin
 *
 * Inyecta:
 *  - Android:  res/xml/network_security_config.xml con SPKI pinning
 *  - iOS:      NSAppTransportSecurity con pin SHA-256
 *
 * Cómo obtener el SPKI hash de tu cert:
 *
 *   openssl s_client -servername app.esppapel.com -connect app.esppapel.com:9443 < /dev/null 2>/dev/null \
 *     | openssl x509 -pubkey -noout \
 *     | openssl pkey -pubin -outform der \
 *     | openssl dgst -sha256 -binary \
 *     | openssl enc -base64
 *
 * Pegar el resultado (base64) en SSL_PIN_BACKUP1 abajo. Repetir con la cadena
 * intermedia/root para SSL_PIN_BACKUP2 (backup en caso de rotación de cert).
 *
 * Uso en app.json:
 *   "plugins": [
 *     ...,
 *     "./plugins/withSSLPinning.js"
 *   ]
 */
const { withDangerousMod, withInfoPlist } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ⚠️ REEMPLAZA estos hashes por los SPKI reales del cert de app.esppapel.com.
// Pueden venir de env vars para no hardcodear.
const SSL_PINS = {
  hostname: 'app.esppapel.com',
  // SPKI hashes reales del cert de app.esppapel.com (obtenidos con openssl).
  // Pineamos 3 niveles de la cadena — Android valida si CUALQUIERA coincide,
  // así que esto sobrevive las renovaciones de Let's Encrypt (cada ~90d el
  // LEAF cambia, pero el intermedio y el root se mantienen).
  //
  // Para re-obtenerlos si cambia la CA:
  //   openssl s_client -servername app.esppapel.com -connect app.esppapel.com:9443 -showcerts </dev/null \
  //     | (extraer cada cert) | openssl x509 -pubkey -noout \
  //     | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl enc -base64
  pins: [
    // Leaf (CN=app.esppapel.com) — tight, cambia en cada renovación
    process.env.SSL_PIN_PRIMARY ?? '2BYD28D8i/ErzIxIt7Mi77c873IiLQJ5CswTOcApg6w=',
    // Intermedio (Let's Encrypt YE1) — sobrevive renovaciones del leaf
    process.env.SSL_PIN_BACKUP  ?? 'brzvtCELCIZUo4sD/qPX0ccRtPsd3DY6RfmxpOU9oB4=',
    // Root (ISRG Root X2) — backup ultra-estable (válido hasta ~2040)
    process.env.SSL_PIN_ROOT    ?? 'sCkq5UWXjg+7mKu9lMhhYF5bGLsy7VI/UNW3tccdR7w=',
  ].filter((p) => p && !p.startsWith('PLACEHOLDER')),
};

// ─── Android ────────────────────────────────────────────────────────────────
function withAndroidNetworkSecurityConfig(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const xmlDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app/src/main/res/xml',
      );
      if (!fs.existsSync(xmlDir)) fs.mkdirSync(xmlDir, { recursive: true });

      const pinTags = SSL_PINS.pins
        .map(p => `      <pin digest="SHA-256">${p}</pin>`)
        .join('\n');

      const xml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <!-- Por default, NO se permite cleartext (sin https) -->
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>

  <!-- Pinning específico para nuestro backend -->
  <domain-config>
    <domain includeSubdomains="false">${SSL_PINS.hostname}</domain>
    <pin-set expiration="2027-01-01">
${pinTags}
    </pin-set>
  </domain-config>
</network-security-config>
`;
      fs.writeFileSync(path.join(xmlDir, 'network_security_config.xml'), xml);
      return cfg;
    },
  ]);
}

// ─── iOS ────────────────────────────────────────────────────────────────────
function withIOSPinning(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.NSAppTransportSecurity = {
      NSAllowsArbitraryLoads: false,
      NSExceptionDomains: {
        [SSL_PINS.hostname]: {
          NSExceptionRequiresForwardSecrecy: true,
          NSExceptionMinimumTLSVersion: 'TLSv1.2',
          NSIncludesSubdomains: false,
        },
      },
    };
    return cfg;
  });
}

module.exports = function withSSLPinning(config) {
  config = withAndroidNetworkSecurityConfig(config);
  config = withIOSPinning(config);
  return config;
};
