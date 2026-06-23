// Frontend email helper — calls /api/send-email
const API_BASE = process.env.REACT_APP_API_URL || "";
const SECRET   = process.env.REACT_APP_INTERNAL_API_SECRET || "";

export async function sendWelcomeEmail({ to, name, orgName, plan }) {
  if (!to) return; // Skip if no real email set
  try {
    await fetch(`${API_BASE}/api/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SECRET}`,
      },
      body: JSON.stringify({
        type: "welcome",
        to,
        data: { name, orgName, plan, trialDays: 14 },
      }),
    });
  } catch (err) {
    console.error("Welcome email error:", err);
  }
}
