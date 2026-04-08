// Frontend Stripe helpers

const API_BASE = process.env.REACT_APP_API_URL || "";

// Redirect user to Stripe Checkout
export async function startCheckout({ plan, annual, orgId, orgName, email }) {
  const res = await fetch(`${API_BASE}/api/create-checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, annual: !!annual, orgId, orgName, email }),
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
  else throw new Error(data.error || "Failed to create checkout session");
}

// Open Stripe Customer Portal
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
