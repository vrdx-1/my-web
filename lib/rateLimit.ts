import { Ratelimit } from '@upstash/ratelimit';
import { getRedis } from '@/lib/redis';

type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

const inMemoryWindows = new Map<string, { count: number; resetAtMs: number }>();
const ratelimitCache = new Map<string, Ratelimit>();

function getRatelimit(limit: number, windowSeconds: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  const cacheKey = `${limit}:${windowSeconds}`;
  const cached = ratelimitCache.get(cacheKey);
  if (cached) return cached;

  const created = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    analytics: false,
    prefix: 'rl',
  });
  ratelimitCache.set(cacheKey, created);
  return created;
}

function fallbackInMemoryLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const existing = inMemoryWindows.get(key);

  if (!existing || now >= existing.resetAtMs) {
    const resetAtMs = now + windowMs;
    inMemoryWindows.set(key, { count: 1, resetAtMs });
    return {
      success: true,
      limit,
      remaining: Math.max(0, limit - 1),
      reset: Math.floor(resetAtMs / 1000),
    };
  }

  existing.count += 1;
  const success = existing.count <= limit;
  return {
    success,
    limit,
    remaining: Math.max(0, limit - existing.count),
    reset: Math.floor(existing.resetAtMs / 1000),
  };
}

export async function checkRateLimit(params: {
  namespace: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const { namespace, identifier, limit, windowSeconds } = params;
  const scopedKey = `${namespace}:${identifier}`;
  const ratelimit = getRatelimit(limit, windowSeconds);

  if (!ratelimit) {
    return fallbackInMemoryLimit(scopedKey, limit, windowSeconds);
  }

  try {
    const result = await ratelimit.limit(scopedKey);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch {
    return fallbackInMemoryLimit(scopedKey, limit, windowSeconds);
  }
}

export function getRequestIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown';
}
