// api/create-portal.js
// Opens Stripe Customer Portal — lets users manage billing, cancel, upgrade
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  const { customerId } = req.body;
  if (!customerId) return res.status(400).json({ error: "Missing customerId" });

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app",
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Portal error:", err);
    res.status(500).json({ error: err.message });
  }
};
