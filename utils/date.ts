/**
 * Timezone-safe date utilities.
 *
 * The bug they solve: `new Date("2026-05-23")` is parsed as UTC midnight by JS.
 * In any negative-UTC timezone (e.g. Bolivia UTC-4), that becomes
 * "May 22 8 PM local" → `getDate()` returns 22 instead of 23.
 *
 * Use these helpers anywhere a date is parsed FROM the backend or sent TO it.
 */

/**
 * Parse a date value from the backend safely.
 * - Date-only strings ("YYYY-MM-DD") → interpreted as LOCAL midnight (not UTC)
 * - UTC-midnight ISO strings ("YYYY-MM-DDT00:00:00.000Z") → also interpreted as LOCAL
 *   midnight (these are usually date-only fields padded by the backend)
 * - Full ISO timestamps with non-zero time → parsed normally (real timestamps)
 * - Anything else → null on failure, Date as-is if already a Date.
 */
export function parseBackendDate(
  input: string | Date | null | undefined,
): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input !== 'string') return null;

  // Pure date-only: "YYYY-MM-DD"
  const dateOnly = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  // UTC-midnight ISO: "YYYY-MM-DDT00:00:00(.000)?Z"
  // The backend serialized a date-only field — treat as local date.
  const utcMidnight = input.match(/^(\d{4})-(\d{2})-(\d{2})T00:00:00(\.\d+)?Z$/);
  if (utcMidnight) {
    const [, y, m, d] = utcMidnight;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  // Real timestamp — standard parse
  const parsed = new Date(input);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format a Date as "YYYY-MM-DD" using LOCAL calendar values.
 * Use this when sending a date-only field to the backend (avoids timezone shifts).
 */
export function toLocalDateString(d: Date): string {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/**
 * Convert a Date to an ISO string anchored at NOON LOCAL time on the same calendar day.
 * Use this for date+time fields where the calendar day matters more than the exact moment
 * (e.g. matchday deadlines stored as full timestamps). Noon ensures any ±11h timezone
 * shift on either client or server keeps the date the same.
 */
export function toNoonISOString(d: Date): string {
  const safe = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
  return safe.toISOString();
}

/**
 * Format a Date as "dd/MM/yyyy" for display. Uses LOCAL date.
 */
export function toDDMMYYYY(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const mo  = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${mo}/${d.getFullYear()}`;
}

// ─── Hora de Bolivia (UTC-4 FIJO, sin horario de verano) ────────────────────
// Blindaje: las horas de los PARTIDOS se interpretan al guardar y se muestran
// SIEMPRE como hora de Bolivia, sin importar el timezone del dispositivo (del
// admin que carga ni del usuario que mira). Así las notificaciones automáticas
// —que disparan X min antes del instante guardado— son precisas pase lo que pase.
export const BOLIVIA_UTC_OFFSET_HOURS = 4;

/**
 * Toma una fecha cuyos componentes de PARED (año/mes/día/hora/min — lo que el
 * admin eligió en el picker) representan hora de Bolivia, y devuelve el instante
 * UTC correcto. Ej: "16:00" → "...T20:00:00.000Z". Da igual el TZ del device.
 */
export function boliviaWallToISO(d: Date): string {
  return new Date(Date.UTC(
    d.getFullYear(), d.getMonth(), d.getDate(),
    d.getHours() + BOLIVIA_UTC_OFFSET_HOURS, d.getMinutes(), 0, 0,
  )).toISOString();
}

/**
 * Componentes de PARED en hora de Bolivia de un instante (ISO/Date), sin
 * importar el TZ de quien mira. Para formatear displays de forma consistente.
 */
export function boliviaParts(input: string | Date | null | undefined): {
  hh: string; mm: string; day: string; mo: string; year: number;
} | null {
  if (!input) return null;
  const t = input instanceof Date ? input : new Date(input);
  if (isNaN(t.getTime())) return null;
  // Restar el offset y leer en UTC = hora de pared de Bolivia.
  const bo = new Date(t.getTime() - BOLIVIA_UTC_OFFSET_HOURS * 3_600_000);
  return {
    hh:   String(bo.getUTCHours()).padStart(2, '0'),
    mm:   String(bo.getUTCMinutes()).padStart(2, '0'),
    day:  String(bo.getUTCDate()).padStart(2, '0'),
    mo:   String(bo.getUTCMonth() + 1).padStart(2, '0'),
    year: bo.getUTCFullYear(),
  };
}
