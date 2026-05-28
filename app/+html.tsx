/**
 * Wrapper HTML que Expo Web usa para envolver TODA la app.
 * Aquí inyectamos:
 *  - <link rel="manifest"> (PWA)
 *  - Iconos apple-touch (iOS necesita estos para el "Add to Home Screen")
 *  - Meta tags theme-color, viewport-fit (notch), apple-mobile-web-app-*
 *  - Auto-registro del Service Worker
 *
 * Docs: https://docs.expo.dev/router/reference/static-rendering/#root-html
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />

        {/* ── PWA manifest ─────────────────────────────────────── */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0F172A" />
        <meta name="application-name" content="Mundial 2026" />

        {/* ── iOS Safari (needed for Add to Home Screen) ───────── */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Mundial 2026" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        <link rel="icon" href="/favicon.png" />

        {/* ── Android ──────────────────────────────────────────── */}
        <meta name="mobile-web-app-capable" content="yes" />

        {/* ── SEO / Open Graph (mínimo) ────────────────────────── */}
        <meta name="description" content="Quinielas y apuestas del Mundial 2026" />
        <meta property="og:title" content="Mundial 2026" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/icon-512.png" />

        {/* RN-web friendly scroll reset */}
        <ScrollViewStyleReset />

        {/* ── Service Worker auto-registro ─────────────────────── */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch((e) => console.log('SW reg failed', e));
                });
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
