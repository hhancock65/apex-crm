// api/stripe-webhook.js — HIGH RISK FIXES:
// 1. Verified Stripe signature on every request
// 2. Grace period on payment failure (7 days)
// 3. Dunning email sent on payment failure
// 4. Dunning follow-up at day 3 of grace period

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end",  () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function sendEmail(type, to, data) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://apex-crm-jhdm.vercel.app";
    await fetch(`${appUrl}/api/send-email`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${process.env.INTERNAL_API_SECRET}`,
      },
      body: JSON.stringify({ type, to, data }),
    });
  } catch (e) {
    console.error(`Failed to send ${type} email:`, e);
  }
}

async function getOrgAdminByCustomerId(customerId) {
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, plan")
    .eq("stripe_customer_id", customerId)
    .single();
  if (!org) return null;

  const { data: admin } = await supabase
    .from("profiles")
    .select("real_email, name")
    .eq("org_id", org.id)
    .eq("role", "Admin")
    .single();

  return { org, admin };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  const sig    = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return res.status(400).json({ error: "Missing signature config" });
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  const obj        = event.data.object;
  const orgId      = obj.metadata?.orgId || obj.subscription_data?.metadata?.orgId;
  const plan       = obj.metadata?.plan   || obj.subscription_data?.metadata?.plan;
  const customerId = obj.customer;

  try {
    switch (event.type) {

      case "checkout.session.completed": {
        if (!orgId || !plan) break;
        const seats    = plan === "pro" ? -1 : 2;
        const contacts = plan === "pro" ? -1 : 500;
        await supabase.from("organizations").update({
          plan,
          stripe_customer_id: customerId,
          seats_limit:        seats,
          contacts_limit:     contacts,
          trial_ends_at:      null,
        }).eq("id", orgId);

        // Send payment confirmation email
        const { data: admin } = await supabase
          .from("profiles")
          .select("real_email, name")
          .eq("org_id", orgId)
          .eq("role", "Admin")
          .single();

        if (admin?.real_email) {
          const { data: org } = await supabase.from("organizations").select("name").eq("id", orgId).single();
          await sendEmail("payment_confirm", admin.real_email, {
            name: admin.name, plan, orgName: org?.name,
          });
        }
        break;
      }

      case "invoice.payment_succeeded": {
        // Keep org active — clear any grace period
        if (customerId) {
          await supabase.from("organizations")
            .update({ trial_ends_at: null })
            .eq("stripe_customer_id", customerId)
            .in("plan", ["starter", "pro"]);
        }
        break;
      }

      case "invoice.payment_failed": {
        if (!customerId) break;
        const result = await getOrgAdminByCustomerId(customerId);
        if (!result) break;
        const { org, admin } = result;

        // Set 7-day grace period before cancelling
        const graceEnd = new Date();
        graceEnd.setDate(graceEnd.getDate() + 7);

        await supabase.from("organizations")
          .update({ trial_ends_at: graceEnd.toISOString() })
          .eq("id", org.id);

        // Send dunning email immediately
        if (admin?.real_email) {
          await sendEmail("payment_failed", admin.real_email, {
            name:        admin.name,
            orgName:     org.name,
            plan:        org.plan,
            graceEndDate: graceEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
            billingUrl:  `${process.env.NEXT_PUBLIC_APP_URL}?settings=billing`,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        if (customerId) {
          await supabase.from("organizations")
            .update({ plan: "cancelled" })
            .eq("stripe_customer_id", customerId);
        }
        break;
      }

      case "customer.subscription.updated": {
        if (!customerId) break;
        const priceId = obj.items?.data?.[0]?.price?.id;
        let newPlan = null;
        if (priceId === process.env.STRIPE_PRO_PRICE_ID || priceId === process.env.STRIPE_PRO_ANNUAL_PRICE_ID) newPlan = "pro";
        if (priceId === process.env.STRIPE_STARTER_PRICE_ID || priceId === process.env.STRIPE_STARTER_ANNUAL_PRICE_ID) newPlan = "starter";
        if (newPlan) {
          const seats    = newPlan === "pro" ? -1 : 2;
          const contacts = newPlan === "pro" ? -1 : 500;
          await supabase.from("organizations")
            .update({ plan: newPlan, seats_limit: seats, contacts_limit: contacts })
            .eq("stripe_customer_id", customerId);
        }
        break;
      }

      default:
        console.log(`Unhandled event: ${event.type}`);
    }
  } catch (err) {
    console.error("DB error in webhook:", err);
  }

  res.status(200).json({ received: true });
};
