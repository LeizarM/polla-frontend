/**
 * build-icons.js
 *
 * Converts assets/images/icon-source.svg + favicon-source.svg into all the
 * PNG variants Expo needs (app icon, adaptive icon foreground, splash, favicon).
 *
 * Run: npm run build-icons
 *
 * Requires `sharp` — install with: npm i -D sharp
 */
const fs = require('fs');
const path = require('path');

(async () => {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('\n❌ Falta `sharp`. Instala con:\n   npm i -D sharp\n');
    process.exit(1);
  }

  const root = path.resolve(__dirname, '..');
  const imgDir = path.join(root, 'assets', 'images');
  const iconSvg    = fs.readFileSync(path.join(imgDir, 'icon-source.svg'));
  const faviconSvg = fs.readFileSync(path.join(imgDir, 'favicon-source.svg'));

  // The foreground for Android adaptive icons must have ~25% safe padding
  // — Android will mask it inside a circle/square. We render the same SVG
  // smaller and centered on a transparent canvas.
  async function adaptiveForeground(svgBuf, size, scale = 0.7) {
    const inner = Math.round(size * scale);
    const buf = await sharp(svgBuf, { density: 600 })
      .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: buf, gravity: 'center' }])
      .png()
      .toBuffer();
  }

  async function renderSvg(svgBuf, size, opts = {}) {
    return sharp(svgBuf, { density: 600 })
      .resize(size, size, { fit: 'contain', background: opts.bg ?? { r: 10, g: 14, b: 26, alpha: 1 } })
      .png()
      .toBuffer();
  }

  const targets = [
    // ── Main app icon (used for iOS + fallback Android) ───────────
    { name: 'icon.png',                       size: 1024, source: iconSvg, bg: { r: 10, g: 14, b: 26, alpha: 1 } },
    // ── Android adaptive ─────────────────────────────────────────
    { name: 'android-icon-foreground.png',    size: 1024, source: iconSvg, foreground: true },
    { name: 'android-icon-monochrome.png',    size: 1024, source: iconSvg, foreground: true },
    // (background is configured by hex in app.json — no PNG needed)
    // ── Splash screen ────────────────────────────────────────────
    { name: 'splash-icon.png',                size: 1024, source: iconSvg, bg: { r: 0, g: 0, b: 0, alpha: 0 }, splash: true },
    // ── Web favicon ─────────────────────────────────────────────
    { name: 'favicon.png',                    size: 64,   source: faviconSvg, bg: { r: 0, g: 0, b: 0, alpha: 0 } },
    // ── PWA icons (manifest.json) ─────────────────────────────────
    { name: 'icon-192.png',                   size: 192,  source: iconSvg, bg: { r: 10, g: 14, b: 26, alpha: 1 } },
    { name: 'icon-512.png',                   size: 512,  source: iconSvg, bg: { r: 10, g: 14, b: 26, alpha: 1 } },
  ];

  // Also keep a copy as android-icon-background.png — flat color matching
  // app.json's adaptiveIcon.backgroundColor (#0A0E1A).
  for (const t of targets) {
    let buf;
    if (t.foreground) {
      buf = await adaptiveForeground(t.source, t.size);
    } else if (t.splash) {
      // Splash — keep transparent, just the logo. Expo composes the bg.
      buf = await sharp(t.source, { density: 600 })
        .resize(t.size, t.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
    } else {
      buf = await renderSvg(t.source, t.size, { bg: t.bg });
    }
    const outPath = path.join(imgDir, t.name);
    fs.writeFileSync(outPath, buf);
    console.log(`✅ ${t.name}  (${t.size}×${t.size})`);
  }

  // Flat color background tile for Android adaptive icons
  const bgBuf = await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 10, g: 14, b: 26, alpha: 1 } },
  }).png().toBuffer();
  fs.writeFileSync(path.join(imgDir, 'android-icon-background.png'), bgBuf);
  console.log(`✅ android-icon-background.png  (1024×1024)`);

  console.log('\n🎉 Iconos generados. Ejecuta `npx expo prebuild --clean` y reconstruye el APK.');
})();
