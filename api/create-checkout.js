// api/create-checkout.js
// SECURITY FIXES:
// 1. Rate limited to 10 requests per minute per IP
// 2. Origin validated — only callable from your app
// 3. Input sanitized and validated server-side

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { rateLimit, checkOrigin, setCORSHeaders } = require("./_middleware");

const PRICES = {
  starter:        process.env.STRIPE_STARTER_PRICE_ID,
  pro:            process.env.STRIPE_PRO_PRICE_ID,
  starter_annual: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID,
  pro_annual:     process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
};

const VALID_PLANS = ["starter", "pro"];

module.exports = async (req, res) => {
  setCORSHeaders(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Rate limit: 10 checkout attempts per minute per IP
  if (!rateLimit(req, res, { maxRequests: 10, windowMs: 60 * 1000 })) return;

  // CSRF origin check
  if (!checkOrigin(req, res)) return;

  const { plan, annual, orgId, orgName, email } = req.body;

  // Validate inputs
  if (!plan || !VALID_PLANS.includes(plan)) {
    return res.status(400).json({ error: "Invalid plan specified" });
  }
  if (!orgId || typeof orgId !== "string" || orgId.length > 100) {
    return res.status(400).json({ error: "Invalid organization ID" });
  }

  const priceKey = annual ? `${plan}_annual` : plan;
  const priceId  = PRICES[priceKey];

  if (!priceId) {
    return res.status(400).json({
      error: annual
        ? `Annual pricing not yet configured for ${plan}. Please contact support.`
        : `Price not configured for plan: ${plan}`,
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://apex-crm-jhdm.vercel.app";

  try {
    const session = await stripe.checkout.sessions.create({
      mode:                 "subscription",
      payment_method_types: ["card"],
      line_items:           [{ price: priceId, quantity: 1 }],
      customer_email:       email || undefined,
      metadata:             { orgId, plan },
      subscription_data:    { metadata: { orgId, plan } },
      success_url:          `${appUrl}?upgraded=true&plan=${plan}`,
      cancel_url:           `${appUrl}?cancelled=true`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err.message);
    res.status(500).json({ error: "Failed to create checkout session. Please try again." });
  }
};
