const crypto = require("crypto");

const buckets = new Map();
let lastCleanupAt = 0;

function cleanupExpiredBuckets(now) {
  if (now - lastCleanupAt < 60_000) return;
  lastCleanupAt = now;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function fingerprint(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex")
    .slice(0, 24);
}

function ipKey(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function createRateLimiter({
  name,
  windowMs,
  limit,
  keyGenerator = ipKey,
  skipSuccessfulRequests = false,
}) {
  return (req, res, next) => {
    const now = Date.now();
    cleanupExpiredBuckets(now);
    const key = `${name}:${keyGenerator(req)}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.resetAt - now) / 1000),
    );
    res.setHeader("RateLimit-Limit", String(limit));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
    res.setHeader("RateLimit-Reset", String(retryAfterSeconds));

    if (bucket.count >= limit) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        code: "RATE_LIMITED",
        message: "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
      });
    }

    if (skipSuccessfulRequests) {
      res.once("finish", () => {
        if (res.statusCode >= 400) bucket.count += 1;
      });
    } else {
      bucket.count += 1;
      res.setHeader(
        "RateLimit-Remaining",
        String(Math.max(0, limit - bucket.count)),
      );
    }
    return next();
  };
}

const loginRateLimit = createRateLimiter({
  name: "login",
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) =>
    `${ipKey(req)}:${String(req.body?.email || "").trim().toLowerCase()}`,
});

const refreshRateLimit = createRateLimiter({
  name: "refresh",
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => {
    const refreshToken = String(req.body?.refreshToken || "");
    return refreshToken ? `session:${fingerprint(refreshToken)}` : `ip:${ipKey(req)}`;
  },
});

const uploadRateLimit = createRateLimiter({
  name: "upload",
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.user?.uid || req.user?.localId || ipKey(req),
});

const aiFilterRateLimit = createRateLimiter({
  name: "ai-filter",
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.user?.uid || req.user?.localId || ipKey(req),
});

module.exports = {
  createRateLimiter,
  loginRateLimit,
  refreshRateLimit,
  uploadRateLimit,
  aiFilterRateLimit,
  _private: { buckets, fingerprint, cleanupExpiredBuckets },
};
