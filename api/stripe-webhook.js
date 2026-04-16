// api/stripe-webhook.js
// CRITICAL: Verifies Stripe signature on every request
// Without this, anyone can POST fake payment events

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Required to parse raw body for Stripe signature verification
export const config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const sig     = req.headers["stripe-signature"];
  const secret  = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    console.error("Missing Stripe signature or webhook secret");
    return res.status(400).json({ error: "Missing signature" });
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    // This throws if signature is invalid — CRITICAL security check
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  const session      = event.data.object;
  const orgId        = session.metadata?.orgId || session.subscription_data?.metadata?.orgId;
  const plan         = session.metadata?.plan   || session.subscription_data?.metadata?.plan;
  const customerId   = session.customer;

  console.log(`Stripe event: ${event.type} | org: ${orgId} | plan: ${plan}`);

  try {
    switch (event.type) {

      case "checkout.session.completed": {
        if (!orgId || !plan) { console.warn("Missing orgId or plan in metadata"); break; }
        const seats = plan === "pro" ? -1 : 2;
        const contacts = plan === "pro" ? -1 : 500;
        await supabase.from("organizations").update({
          plan,
          stripe_customer_id: customerId,
          seats_limit:        seats,
          contacts_limit:     contacts,
          trial_ends_at:      null,
        }).eq("id", orgId);

        // Send payment confirmation email
        try {
          const { data: org } = await supabase.from("organizations").select("name").eq("id", orgId).single();
          const { data: profile } = await supabase.from("profiles").select("real_email, name").eq("org_id", orgId).eq("role", "Admin").single();
          if (profile?.real_email) {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-email`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.INTERNAL_API_SECRET}` },
              body: JSON.stringify({ type: "payment_confirm", to: profile.real_email, data: { name: profile.name, plan, orgName: org?.name } }),
            });
          }
        } catch (emailErr) { console.error("Failed to send payment email:", emailErr); }
        break;
      }

      case "invoice.payment_succeeded": {
        // Keep org active on renewal
        if (customerId) {
          const { data: org } = await supabase.from("organizations").select("id, plan").eq("stripe_customer_id", customerId).single();
          if (org && org.plan !== "trial") {
            await supabase.from("organizations").update({ plan: org.plan }).eq("id", org.id);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        // Give a 7-day grace period, not immediate cancellation
        if (customerId) {
          const grace = new Date();
          grace.setDate(grace.getDate() + 7);
          await supabase.from("organizations")
            .update({ trial_ends_at: grace.toISOString() })
            .eq("stripe_customer_id", customerId);
          console.log(`Payment failed for customer ${customerId} — grace period set to ${grace.toISOString()}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        if (customerId) {
          await supabase.from("organizations").update({ plan: "cancelled" }).eq("stripe_customer_id", customerId);
        }
        break;
      }

      case "customer.subscription.updated": {
        // Handle plan changes
        if (customerId) {
          const priceId = session.items?.data?.[0]?.price?.id;
          let newPlan = null;
          if (priceId === process.env.STRIPE_PRO_PRICE_ID || priceId === process.env.STRIPE_PRO_ANNUAL_PRICE_ID) newPlan = "pro";
          if (priceId === process.env.STRIPE_STARTER_PRICE_ID || priceId === process.env.STRIPE_STARTER_ANNUAL_PRICE_ID) newPlan = "starter";
          if (newPlan) {
            const seats    = newPlan === "pro" ? -1 : 2;
            const contacts = newPlan === "pro" ? -1 : 500;
            await supabase.from("organizations").update({ plan: newPlan, seats_limit: seats, contacts_limit: contacts }).eq("stripe_customer_id", customerId);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (dbErr) {
    console.error("Database error handling webhook:", dbErr);
    // Still return 200 so Stripe doesn't retry — log and investigate separately
  }

  res.status(200).json({ received: true });
};
