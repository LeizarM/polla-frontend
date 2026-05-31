/**
 * route-access — fuente única de verdad para qué rutas son admin-only.
 *
 * Los "segmentos" son el primer tramo del path en Expo Router:
 *   /admin/usuarios       → segment[0] = 'admin'
 *   /admin-usuario/<id>   → segment[0] = 'admin-usuario'
 *   /tournament/<id>      → segment[0] = 'tournament'
 *
 * Un usuario NORMAL que intente entrar a cualquiera de estos segmentos será
 * redirigido a /user (tanto por el guard global en app/_layout.tsx como por
 * el guard de render en cada _layout admin).
 *
 * IMPORTANTE: la protección REAL está en el backend (AdminGuard en cada
 * endpoint). Esto es defensa en profundidad + UX (no mostrar pantallas que
 * el usuario no puede usar).
 */

/** Segmentos de primer nivel reservados SOLO para administradores. */
export const ADMIN_ONLY_SEGMENTS: readonly string[] = [
  'admin',          // dashboard, torneos, partidos, polla, usuarios, avisos, auditoría, perfil admin
  'admin-usuario',  // detalle/gestión de un usuario (cambiar rol, status, password)
  'tournament',     // gestión de torneos: editar, equipos, jornadas, reportes PDF
];

/** Segmentos públicos (no requieren estar logueado). */
export const PUBLIC_SEGMENTS: readonly string[] = ['auth'];

/**
 * ¿Este segmento es admin-only?
 * @param segment El primer tramo del path (segments[0] de Expo Router).
 */
export function isAdminOnlySegment(segment: string | undefined): boolean {
  if (!segment) return false;
  return ADMIN_ONLY_SEGMENTS.includes(segment);
}

/**
 * ¿Este segmento es público (sin auth)?
 */
export function isPublicSegment(segment: string | undefined): boolean {
  if (!segment) return false;
  return PUBLIC_SEGMENTS.includes(segment);
}
