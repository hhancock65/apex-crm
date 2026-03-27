// Frontend Stripe helpers — calls our Vercel serverless functions

const API_BASE = process.env.REACT_APP_API_URL || "";

// Redirect user to Stripe Checkout to start a paid subscription
export async function startCheckout({ plan, orgId, orgName, email }) {
  const res = await fetch(`${API_BASE}/api/create-checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, orgId, orgName, email }),
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
  else throw new Error(data.error || "Failed to create checkout session");
}

// Redirect user to Stripe Customer Portal to manage billing
export async function openBillingPortal(customerId) {
  const res = await fetch(`${API_BASE}/api/create-portal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerId }),
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
  else throw new Error(data.error || "Failed to open portal");
}
