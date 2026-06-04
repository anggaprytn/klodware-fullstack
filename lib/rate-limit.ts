type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

// In-memory MVP limiter. It resets on process restart and is intended only to
// slow repeated credential attacks before a durable store is introduced.
export function checkLoginRateLimit(request: Request, username: string) {
  const windowMs = numberFromEnv("LOGIN_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000);
  const maxAttempts = numberFromEnv("LOGIN_RATE_LIMIT_MAX_ATTEMPTS", 10);
  const key = `${getClientIp(request)}:${username.trim().toLowerCase()}`;
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, retryAfterSeconds: 0 };
  }

  current.count += 1;

  if (current.count > maxAttempts) {
    return {
      limited: true,
      retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  return { limited: false, retryAfterSeconds: 0 };
}

export function clearLoginRateLimit(request: Request, username: string) {
  const key = `${getClientIp(request)}:${username.trim().toLowerCase()}`;
  buckets.delete(key);
}
