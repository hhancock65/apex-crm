// api/stripe-webhook.js
const stripe  = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app";

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => { data += chunk; });
    req.on("end", () => resolve(Buffer.from(data)));
    req.on("error", reject);
  });
}

async function updateOrg(orgId, updates) {
  const { error } = await supabase.from("organizations").update(updates).eq("id", orgId);
  if (error) console.error("Supabase update error:", error);
}

async function getOrgAdmin(orgId) {
  const { data } = await supabase
    .from("profiles")
    .select("name, real_email")
    .eq("org_id", orgId)
    .eq("role", "Admin")
    .single();
  return data;
}

async function getOrg(orgId) {
  const { data } = await supabase.from("organizations").select("*").eq("id", orgId).single();
  return data;
}

async function sendEmail(type, to, data) {
  try {
    await fetch(`${APP_URL}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.INTERNAL_API_SECRET}` },
      body: JSON.stringify({ type, to, data }),
    });
  } catch (err) { console.error("Email send error:", err); }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  const { type, data } = event;

  try {
    switch (type) {

      case "checkout.session.completed": {
        const session = data.object;
        const { orgId, plan } = session.metadata || {};
        if (!orgId) break;

        await updateOrg(orgId, {
          plan,
          stripe_customer_id:      session.customer,
          stripe_subscription_id:  session.subscription,
          seats_limit:    plan === "pro" ? -1 : 2,
          contacts_limit: plan === "pro" ? -1 : 500,
        });

        // Send payment confirmation email
        const [admin, org] = await Promise.all([getOrgAdmin(orgId), getOrg(orgId)]);
        if (admin?.real_email) {
          await sendEmail("payment_confirm", admin.real_email, {
            name:    admin.name,
            orgName: org?.name,
            plan,
            amount:  plan === "pro" ? 99 : 29,
          });
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = data.object;
        if (!invoice.subscription) break;
        const sub = await stripe.subscriptions.retrieve(invoice.subscription);
        const { orgId, plan } = sub.metadata || {};
        if (!orgId) break;
        await updateOrg(orgId, { plan });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = data.object;
        if (!invoice.subscription) break;
        const sub = await stripe.subscriptions.retrieve(invoice.subscription);
        const { orgId } = sub.metadata || {};
        if (!orgId) break;
        console.log(`Payment failed for org ${orgId}`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = data.object;
        const { orgId } = sub.metadata || {};
        if (!orgId) break;
        await updateOrg(orgId, { plan: "cancelled", stripe_subscription_id: "" });
        break;
      }

      case "customer.subscription.updated": {
        const sub = data.object;
        const { orgId, plan } = sub.metadata || {};
        if (!orgId) break;
        await updateOrg(orgId, {
          plan,
          seats_limit:    plan === "pro" ? -1 : 2,
          contacts_limit: plan === "pro" ? -1 : 500,
        });
        break;
      }

      default:
        console.log(`Unhandled: ${type}`);
    }
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Internal error" });
  }

  res.status(200).json({ received: true });
};
