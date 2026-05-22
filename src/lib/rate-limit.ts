import { env } from "@/lib/env";
import { IntegrationError } from "@/lib/errors";

export type RateLimitBackend = "memory" | "upstash";

export type RateLimitOptions = Readonly<{
  limit: number;
  windowMs: number;
}>;

export type RateLimitResult = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
}>;

export interface RateLimiter {
  check(key: string, options: RateLimitOptions): Promise<RateLimitResult>;
}

type MemoryBucket = {
  count: number;
  resetAt: number;
};

/**
 * Development-only, single-process rate limiter. Buckets live in memory and
 * reset on process restart; use Upstash in production.
 */
export class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, MemoryBucket>();

  async check(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
    validateRateLimitOptions(options);
    this.evictExpiredBuckets();

    const now = Date.now();
    const existing = this.buckets.get(key);
    const bucket =
      existing && existing.resetAt > now
        ? existing
        : {
            count: 0,
            resetAt: now + options.windowMs,
          };

    bucket.count += 1;
    this.buckets.set(key, bucket);

    return {
      allowed: bucket.count <= options.limit,
      limit: options.limit,
      remaining: Math.max(options.limit - bucket.count, 0),
      resetAt: new Date(bucket.resetAt),
    };
  }

  private evictExpiredBuckets(): void {
    const now = Date.now();

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}

export class UpstashRateLimiter implements RateLimiter {
  constructor(
    private readonly config: Readonly<{
      redisRestUrl?: string;
      redisRestToken?: string;
    }> = {},
  ) {}

  async check(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
    void key;
    void options;
    throw new IntegrationError({
      code: "rate_limiter_not_configured",
      message:
        this.config.redisRestUrl && this.config.redisRestToken
          ? "Upstash rate limiter is reserved for Step 7 wiring."
          : "Upstash rate limiter requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    });
  }
}

export function createRateLimiter(backend: RateLimitBackend = env.RATE_LIMIT_BACKEND): RateLimiter {
  if (backend === "upstash") {
    return new UpstashRateLimiter({
      redisRestUrl: env.UPSTASH_REDIS_REST_URL,
      redisRestToken: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  return new MemoryRateLimiter();
}

export const rateLimiter = createRateLimiter();

function validateRateLimitOptions(options: RateLimitOptions): void {
  if (!Number.isSafeInteger(options.limit) || options.limit <= 0) {
    throw new IntegrationError({
      code: "rate_limit_invalid_limit",
      message: "Rate limit must be a positive safe integer.",
    });
  }

  if (!Number.isSafeInteger(options.windowMs) || options.windowMs <= 0) {
    throw new IntegrationError({
      code: "rate_limit_invalid_window",
      message: "Rate limit window must be a positive safe integer.",
    });
  }
}
