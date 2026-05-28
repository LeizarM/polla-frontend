/**
 * Format currency amount with the tournament's currency symbol.
 * @param amount - The numeric amount
 * @param currency - Currency symbol (defaults to 'Bs')
 * @returns Formatted string like "Bs 50.00"
 */
export function formatCurrency(amount: number | string | null | undefined, currency = 'Bs'): string {
  const num = Number(amount ?? 0);
  return `${currency} ${num.toFixed(2)}`;
}

/**
 * Format currency without decimals
 */
export function formatCurrencyShort(amount: number | string | null | undefined, currency = 'Bs'): string {
  const num = Number(amount ?? 0);
  return `${currency} ${Math.round(num)}`;
}

/**
 * Format currency SMARTLY — no decimals if integer, two decimals otherwise.
 * Use this for prizes/pools where the amount can be fractional (e.g. tied
 * winners split a pool: Bs 10 / 2 → Bs 5, but 4 winners → Bs 2.50).
 *
 *   formatMoney(10)     → "Bs 10"
 *   formatMoney(7.50)   → "Bs 7.50"
 *   formatMoney(2.5)    → "Bs 2.50"
 *   formatMoney(0)      → "Bs 0"
 */
export function formatMoney(amount: number | string | null | undefined, currency = 'Bs'): string {
  const num = Number(amount ?? 0);
  // Treat very small fractions (rounding artifacts) as integers
  const rounded = Math.round(num * 100) / 100;
  return rounded === Math.trunc(rounded)
    ? `${currency} ${rounded.toFixed(0)}`
    : `${currency} ${rounded.toFixed(2)}`;
}
