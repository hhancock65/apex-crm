// api/create-checkout.js
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  starter:        process.env.STRIPE_STARTER_PRICE_ID,
  pro:            process.env.STRIPE_PRO_PRICE_ID,
  starter_annual: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID,
  pro_annual:     process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
};

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { plan, annual, orgId, orgName, email } = req.body;

  if (!plan || !orgId) return res.status(400).json({ error: "Missing plan or orgId" });

  // Pick the right price based on plan and billing period
  const priceKey = annual ? `${plan}_annual` : plan;
  const priceId  = PRICES[priceKey];

  if (!priceId) {
    return res.status(400).json({ error: `Price not configured for: ${priceKey}` });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      metadata: { orgId, plan },
      subscription_data: { metadata: { orgId, plan } },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://apex-crm-jhdm.vercel.app"}?upgraded=true`,
      cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL || "https://apex-crm-jhdm.vercel.app"}?cancelled=true`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: err.message });
  }
};
