const DEFAULT_SITE_URL = "https://www.jutpai.com";

function normalizeSiteUrl(url: string): string {
  return url.replace(/\/$/, "");
}

export const SITE_URL = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL
);
