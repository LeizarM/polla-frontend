/**
 * Formateo de moneda del app.
 *
 * Convención de separadores: **coma para miles, punto para decimales**
 * (estilo en-US) → 11220 → "11,220" ; 1234.5 → "1,234.50".
 *
 * La agrupación se hace MANUALMENTE (regex) en vez de `toLocaleString('en-US')`
 * porque el soporte de Intl/locale en Hermes (React Native) es inconsistente
 * entre web y móvil; así el resultado es idéntico en todas las plataformas.
 */

// Agrupa la parte entera con comas y arma el string final con punto decimal.
function groupAmount(num: number, decimals: number): string {
  const safe  = Number.isFinite(num) ? num : 0;
  const fixed = Math.abs(safe).toFixed(decimals);          // "11220" | "1234.50"
  const [intPart, decPart] = fixed.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ','); // "11,220"
  const sign = safe < 0 ? '-' : '';
  return decPart ? `${sign}${grouped}.${decPart}` : `${sign}${grouped}`;
}

/**
 * Format currency amount with the tournament's currency symbol.
 * @param amount - The numeric amount
 * @param currency - Currency symbol (defaults to 'Bs')
 * @returns Formatted string like "Bs 1,234.00"
 */
export function formatCurrency(amount: number | string | null | undefined, currency = 'Bs'): string {
  return `${currency} ${groupAmount(Number(amount ?? 0), 2)}`;
}

/**
 * Format currency without decimals → "Bs 1,234"
 */
export function formatCurrencyShort(amount: number | string | null | undefined, currency = 'Bs'): string {
  return `${currency} ${groupAmount(Math.round(Number(amount ?? 0)), 0)}`;
}

/**
 * Format currency SMARTLY — no decimals if integer, two decimals otherwise.
 * Use this for prizes/pools where the amount can be fractional (e.g. tied
 * winners split a pool: Bs 10 / 2 → Bs 5, but 4 winners → Bs 2.50).
 *
 *   formatMoney(11220)  → "Bs 11,220"
 *   formatMoney(7.50)   → "Bs 7.50"
 *   formatMoney(2.5)    → "Bs 2.50"
 *   formatMoney(0)      → "Bs 0"
 */
export function formatMoney(amount: number | string | null | undefined, currency = 'Bs'): string {
  const num = Number(amount ?? 0);
  // Treat very small fractions (rounding artifacts) as integers
  const rounded = Math.round(num * 100) / 100;
  return rounded === Math.trunc(rounded)
    ? `${currency} ${groupAmount(rounded, 0)}`
    : `${currency} ${groupAmount(rounded, 2)}`;
}
