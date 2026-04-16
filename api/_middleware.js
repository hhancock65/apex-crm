// api/_middleware.js
// Shared security middleware for all API routes
// Provides: rate limiting, CSRF origin check, request validation

const rateLimitMap = new Map();

// Simple in-memory rate limiter
// Limits: maxRequests per windowMs per IP
export function rateLimit(req, res, { maxRequests = 10, windowMs = 60000 } = {}) {
  const ip  = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "unknown";
  const key = `${ip}:${req.url}`;
  const now = Date.now();

  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  const entry = rateLimitMap.get(key);
  if (now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    res.status(429).json({
      error: "Too many requests. Please wait a moment and try again.",
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
    return false;
  }
  return true;
}

// CSRF protection — verify request comes from your app
export function checkOrigin(req, res) {
  const origin  = req.headers["origin"] || "";
  const referer = req.headers["referer"] || "";
  const allowed = process.env.NEXT_PUBLIC_APP_URL || "https://apex-crm-jhdm.vercel.app";

  // Allow requests with no origin (server-to-server, Postman in dev)
  if (!origin && !referer) return true;

  // In production, verify origin matches app URL
  if (process.env.NODE_ENV === "production") {
    if (!origin.startsWith(allowed) && !referer.startsWith(allowed)) {
      res.status(403).json({ error: "Forbidden — invalid request origin" });
      return false;
    }
  }
  return true;
}

// Apply standard CORS headers
export function setCORSHeaders(req, res) {
  const allowed = process.env.NEXT_PUBLIC_APP_URL || "https://apex-crm-jhdm.vercel.app";
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);
