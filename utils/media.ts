import { Platform } from 'react-native';

/**
 * Rewrites media URLs that point to localhost / 127.0.0.1 so they resolve
 * correctly when accessed from other devices on the LAN.
 *
 * On web:  replaces the hostname with `window.location.hostname` so that
 *          http://localhost:3000/uploads/... becomes
 *          http://192.168.x.y:3000/uploads/... automatically.
 * On native: returns the URL unchanged — Expo Go / dev builds already
 *            connect through the LAN IP at the network layer.
 */
export function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        parsed.hostname = window.location.hostname;
        return parsed.toString();
      }
    } catch {
      // Not a parseable URL — return as-is
    }
  }

  return url;
}
