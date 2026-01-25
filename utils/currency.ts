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
