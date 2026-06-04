export type CurrencySymbol = '₭' | '฿' | '$';

export interface ExchangeRates {
  lak_to_thb: number;
  lak_to_usd: number;
  thb_to_lak: number;
  thb_to_usd: number;
  usd_to_lak: number;
  usd_to_thb: number;
}

export const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  lak_to_thb: 1 / 850,
  lak_to_usd: 1 / 22000,
  thb_to_lak: 850,
  thb_to_usd: 850 / 22000,
  usd_to_lak: 22000,
  usd_to_thb: 22000 / 850,
};

export function normalizeCurrencySymbol(value: unknown): CurrencySymbol {
  if (value === '฿' || value === '$') return value;
  return '₭';
}

export function normalizeExchangeRates(input: unknown): ExchangeRates {
  const source = (input ?? {}) as Record<string, unknown>;

  const toPositive = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const thbToLak = toPositive(source.thb_to_lak) ?? DEFAULT_EXCHANGE_RATES.thb_to_lak;
  const usdToLak = toPositive(source.usd_to_lak) ?? DEFAULT_EXCHANGE_RATES.usd_to_lak;

  const lakToThb =
    toPositive(source.lak_to_thb) ??
    (thbToLak > 0 ? 1 / thbToLak : DEFAULT_EXCHANGE_RATES.lak_to_thb);

  const lakToUsd =
    toPositive(source.lak_to_usd) ??
    (usdToLak > 0 ? 1 / usdToLak : DEFAULT_EXCHANGE_RATES.lak_to_usd);

  const thbToUsd =
    toPositive(source.thb_to_usd) ??
    (usdToLak > 0 ? thbToLak / usdToLak : DEFAULT_EXCHANGE_RATES.thb_to_usd);

  const usdToThb =
    toPositive(source.usd_to_thb) ??
    (thbToLak > 0 ? usdToLak / thbToLak : DEFAULT_EXCHANGE_RATES.usd_to_thb);
  return {
    lak_to_thb: lakToThb,
    lak_to_usd: lakToUsd,
    thb_to_lak: thbToLak,
    thb_to_usd: thbToUsd,
    usd_to_lak: usdToLak,
    usd_to_thb: usdToThb,
  };
}

export function parsePriceBound(value: unknown): number | null {
  if (value == null) return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    return value;
  }

  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return parsed;
}

function normalizePriceInput(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;

  if (typeof value === 'string') {
    const digits = value.replace(/[^0-9.]/g, '');
    if (!digits) return null;
    const parsed = Number(digits);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
}

export function toLakPrice(
  price: unknown,
  currency: unknown,
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES,
): number | null {
  const amount = normalizePriceInput(price);
  if (amount == null) return null;

  const normalizedRates = normalizeExchangeRates(rates);
  const symbol = normalizeCurrencySymbol(currency);

  if (symbol === '฿') return amount * normalizedRates.thb_to_lak;
  if (symbol === '$') return amount * normalizedRates.usd_to_lak;
  return amount;
}

export type EstimatedPrices = {
  approx_price_lak: number | null;
  approx_price_thb: number | null;
  approx_price_usd: number | null;
};

export function toEstimatedPrices(
  price: unknown,
  currency: unknown,
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES,
): EstimatedPrices {
  const amount = normalizePriceInput(price);
  if (amount == null) {
    return {
      approx_price_lak: null,
      approx_price_thb: null,
      approx_price_usd: null,
    };
  }

  const normalizedRates = normalizeExchangeRates(rates);
  const symbol = normalizeCurrencySymbol(currency);

  if (symbol === '฿') {
    return {
      approx_price_lak: Number((amount * normalizedRates.thb_to_lak).toFixed(2)),
      approx_price_thb: Number(amount.toFixed(2)),
      approx_price_usd: Number((amount * normalizedRates.thb_to_usd).toFixed(2)),
    };
  }

  if (symbol === '$') {
    return {
      approx_price_lak: Number((amount * normalizedRates.usd_to_lak).toFixed(2)),
      approx_price_thb: Number((amount * normalizedRates.usd_to_thb).toFixed(2)),
      approx_price_usd: Number(amount.toFixed(2)),
    };
  }

  return {
    approx_price_lak: Number(amount.toFixed(2)),
    approx_price_thb: Number((amount * normalizedRates.lak_to_thb).toFixed(2)),
    approx_price_usd: Number((amount * normalizedRates.lak_to_usd).toFixed(2)),
  };
}

export function withLakDisplayPrice<T extends { price?: unknown; price_currency?: unknown }>(
  post: T,
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES,
): T & { display_price: number | null; display_price_currency: CurrencySymbol } {
  return {
    ...post,
    display_price: toLakPrice(post.price, post.price_currency, rates),
    display_price_currency: '₭',
  };
}

export function withEstimatedPrices<T extends {
  price?: unknown;
  price_currency?: unknown;
  approx_price_lak?: unknown;
  approx_price_thb?: unknown;
  approx_price_usd?: unknown;
}>(
  post: T,
  rates: ExchangeRates = DEFAULT_EXCHANGE_RATES,
): T & EstimatedPrices {
  const existingLak = Number(post.approx_price_lak);
  const existingThb = Number(post.approx_price_thb);
  const existingUsd = Number(post.approx_price_usd);

  const hasExisting = Number.isFinite(existingLak) || Number.isFinite(existingThb) || Number.isFinite(existingUsd);
  if (hasExisting) {
    return {
      ...post,
      approx_price_lak: Number.isFinite(existingLak) ? existingLak : null,
      approx_price_thb: Number.isFinite(existingThb) ? existingThb : null,
      approx_price_usd: Number.isFinite(existingUsd) ? existingUsd : null,
    };
  }

  return {
    ...post,
    ...toEstimatedPrices(post.price, post.price_currency, rates),
  };
}

export function formatEstimatedPrice(value: number | null, currency: CurrencySymbol): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return `- ${currency}`;
  }

  const fractionDigits = currency === '₭' ? 0 : 2;
  return `${value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  })}${currency}`;
}
