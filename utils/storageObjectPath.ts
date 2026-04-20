const DEFAULT_SUPABASE_URL = 'https://pkvtwuwicjqodkyraune.supabase.co';

function getPublicSupabaseBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  return raw.replace(/\/$/, '');
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function getStorageObjectPath(
  value: string | null | undefined,
  bucket: string,
): string | null {
  if (!value || typeof value !== 'string') return null;

  const raw = stripWrappingQuotes(value);
  if (!raw) return null;

  const normalizedBucket = bucket.replace(/^\/+|\/+$/g, '');
  const publicPrefix = `/storage/v1/object/public/${normalizedBucket}/`;
  const objectPrefix = `/storage/v1/object/${normalizedBucket}/`;
  const bareObjectPrefix = `/object/public/${normalizedBucket}/`;
  const baseUrl = getPublicSupabaseBaseUrl();

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const candidate = url.pathname;
      if (candidate.startsWith(publicPrefix)) {
        return decodeURIComponent(candidate.slice(publicPrefix.length));
      }
      if (candidate.startsWith(objectPrefix)) {
        return decodeURIComponent(candidate.slice(objectPrefix.length));
      }
      if (candidate.startsWith(bareObjectPrefix)) {
        return decodeURIComponent(candidate.slice(bareObjectPrefix.length));
      }
      const basePathPrefix = `${new URL(baseUrl).pathname.replace(/\/$/, '')}${publicPrefix}`;
      if (candidate.startsWith(basePathPrefix)) {
        return decodeURIComponent(candidate.slice(basePathPrefix.length));
      }
      return null;
    } catch {
      return null;
    }
  }

  const withoutBase = raw.startsWith(baseUrl) ? raw.slice(baseUrl.length) : raw;
  if (withoutBase.startsWith(publicPrefix)) {
    return decodeURIComponent(withoutBase.slice(publicPrefix.length));
  }
  if (withoutBase.startsWith(objectPrefix)) {
    return decodeURIComponent(withoutBase.slice(objectPrefix.length));
  }
  if (withoutBase.startsWith(bareObjectPrefix)) {
    return decodeURIComponent(withoutBase.slice(bareObjectPrefix.length));
  }
  if (withoutBase.startsWith(`${normalizedBucket}/`)) {
    return decodeURIComponent(withoutBase.slice(normalizedBucket.length + 1));
  }
  if (/^(data:|blob:)/i.test(withoutBase)) {
    return null;
  }

  return decodeURIComponent(withoutBase.replace(/^\/+/, ''));
}

export function getStorageObjectPaths(
  values: Array<string | null | undefined>,
  bucket: string,
): string[] {
  const seen = new Set<string>();
  const paths: string[] = [];

  for (const value of values) {
    const path = getStorageObjectPath(value, bucket);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    paths.push(path);
  }

  return paths;
}