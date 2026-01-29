/**
 * Currency Formatting Utility
 * Provides currency formatting functions for the application
 */

/**
 * Format number as currency (Lao Kip)
 * @param amount - Amount to format
 * @param currency - Currency symbol (default: 'ກີບ')
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string = 'ກີບ'): string {
  return amount.toLocaleString('de-DE') + ' ' + currency;
}

/**
 * Format number with thousand separators
 * @param num - Number to format
 * @returns Formatted number string
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('de-DE');
}

/**
 * Format number into compact form using k/m suffix.
 * Examples: 950 -> "950", 1200 -> "1.2k", 12000 -> "12k", 1500000 -> "1.5m"
 */
export function formatCompactNumber(num: number): string {
  const n = Number(num) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';

  if (abs >= 1_000_000) {
    const v = abs / 1_000_000;
    const rounded = v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
    return `${sign}${rounded}M`;
  }

  if (abs >= 1_000) {
    const v = abs / 1_000;
    const rounded = v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
    if (rounded === 1000) return `${sign}1M`;
    return `${sign}${rounded}K`;
  }

  return `${n}`;
}
