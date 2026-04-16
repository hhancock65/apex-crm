// api/_middleware.js
// Shared security middleware for all API routes

const rateLimitMap = new Map();

// Simple in-memory rate limiter
export function rateLimit(req, res, { maxRequests = 20, windowMs = 60000 } = {}) {
  const ip  = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
  const key = `${ip}:${req.url}`;
  const now = Date.now();

  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
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

// CSRF protection — only block requests with a mismatched origin
// Same-site requests and server-to-server calls have no origin header — allow those
export function checkOrigin(req, res) {
  const origin  = req.headers["origin"] || "";
  const allowed = process.env.NEXT_PUBLIC_APP_URL || "https://apex-crm-jhdm.vercel.app";

  // No origin header = server-to-server or same-site request = allow
  if (!origin) return true;

  // Origin present but doesn't match = block (cross-site request)
  if (origin && !origin.startsWith(allowed) && !origin.startsWith("http://localhost")) {
    console.warn(`Blocked request from origin: ${origin}`);
    res.status(403).json({ error: "Forbidden — invalid request origin" });
    return false;
  }

  return true;
}

// Standard CORS headers — allows your app domain only
export function setCORSHeaders(req, res) {
  const allowed = process.env.NEXT_PUBLIC_APP_URL || "https://apex-crm-jhdm.vercel.app";
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");
}

// Cleanup old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);
