// api/send-email.js
// Vercel serverless function — sends transactional emails via Resend
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.EMAIL_FROM || "Apex CRM <noreply@apexcrm.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app";

// ── Email templates ──────────────────────────────────────
function welcomeEmail({ name, orgName, plan, trialDays = 14 }) {
  return {
    subject: `Welcome to Apex CRM, ${name}!`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#1A1917">
        <div style="font-size:20px;font-weight:700;margin-bottom:32px">Apex <span style="color:#185FA5;font-weight:400">CRM</span></div>
        <h1 style="font-size:26px;font-weight:700;letter-spacing:-0.5px;margin-bottom:12px">Welcome, ${name}!</h1>
        <p style="font-size:15px;color:#7A7875;line-height:1.7;margin-bottom:24px">
          Your <strong>${orgName}</strong> workspace is ready. You're on the <strong>${plan === "pro" ? "Pro" : "Starter"} trial</strong> — 
          ${trialDays} days free, no credit card required.
        </p>
        <a href="${APP_URL}" style="display:inline-block;background:#185FA5;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;margin-bottom:32px">
          Open your CRM →
        </a>
        <div style="border-top:1px solid #F1F0EE;padding-top:24px">
          <p style="font-size:13px;color:#7A7875;margin-bottom:8px"><strong>Here's how to get started:</strong></p>
          <ol style="font-size:13px;color:#7A7875;line-height:2;padding-left:20px">
            <li>Add your first contacts</li>
            <li>Create deals in the pipeline</li>
            <li>Invite your team under the Team tab</li>
          </ol>
        </div>
        <p style="font-size:12px;color:#B4B2A9;margin-top:32px">© 2026 Apex CRM</p>
      </div>
    `,
  };
}

function trialWarningEmail({ name, orgName, daysLeft, plan }) {
  const urgent = daysLeft <= 3;
  const accentColor = urgent ? "#E24B4A" : "#EF9F27";
  return {
    subject: urgent
      ? `⚠️ Your Apex CRM trial expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`
      : `Your Apex CRM trial ends in ${daysLeft} days`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#1A1917">
        <div style="font-size:20px;font-weight:700;margin-bottom:32px">Apex <span style="color:#185FA5;font-weight:400">CRM</span></div>
        <div style="background:${urgent ? "#FCEBEB" : "#FAEEDA"};border-radius:10px;padding:20px 24px;margin-bottom:28px">
          <p style="font-size:15px;font-weight:600;color:${accentColor};margin:0 0 6px">
            ${urgent ? "⚠️" : "⏳"} ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left in your trial
          </p>
          <p style="font-size:13px;color:${accentColor};margin:0;opacity:0.8">
            Upgrade now to keep ${orgName}'s data and continue without interruption.
          </p>
        </div>
        <p style="font-size:15px;color:#7A7875;line-height:1.7;margin-bottom:24px">
          Hi ${name}, your free trial of Apex CRM ends in <strong>${daysLeft} day${daysLeft !== 1 ? "s" : ""}</strong>. 
          After that your account will be locked — but all your data is safe and waiting.
        </p>
        <a href="${APP_URL}" style="display:inline-block;background:#185FA5;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;margin-bottom:32px">
          Upgrade now — from $29/mo →
        </a>
        <div style="border-top:1px solid #F1F0EE;padding-top:20px">
          <p style="font-size:13px;color:#7A7875;line-height:1.7">
            Questions? Just reply to this email and we'll help you out.
          </p>
        </div>
        <p style="font-size:12px;color:#B4B2A9;margin-top:32px">© 2026 Apex CRM</p>
      </div>
    `,
  };
}

function paymentConfirmEmail({ name, orgName, plan, amount }) {
  return {
    subject: `Payment confirmed — Apex CRM ${plan === "pro" ? "Pro" : "Starter"}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#1A1917">
        <div style="font-size:20px;font-weight:700;margin-bottom:32px">Apex <span style="color:#185FA5;font-weight:400">CRM</span></div>
        <div style="background:#EAF3DE;border-radius:10px;padding:20px 24px;margin-bottom:28px">
          <p style="font-size:15px;font-weight:600;color:#3B6D11;margin:0 0 4px">✓ Payment confirmed</p>
          <p style="font-size:13px;color:#3B6D11;margin:0;opacity:0.8">${orgName} is now on the ${plan === "pro" ? "Pro" : "Starter"} plan</p>
        </div>
        <p style="font-size:15px;color:#7A7875;line-height:1.7;margin-bottom:16px">
          Hi ${name}, thanks for subscribing! Your payment of <strong>$${amount}/month</strong> was successful.
        </p>
        <a href="${APP_URL}" style="display:inline-block;background:#185FA5;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">
          Open Apex CRM →
        </a>
        <p style="font-size:12px;color:#B4B2A9;margin-top:32px">© 2026 Apex CRM · Manage billing at any time from your account settings.</p>
      </div>
    `,
  };
}

// ── Handler ──────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  // Simple auth check — internal calls only
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.INTERNAL_API_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { type, to, data } = req.body;
  if (!type || !to) return res.status(400).json({ error: "Missing type or to" });

  let template;
  if      (type === "welcome")         template = welcomeEmail(data);
  else if (type === "trial_warning")   template = trialWarningEmail(data);
  else if (type === "payment_confirm") template = paymentConfirmEmail(data);
  else return res.status(400).json({ error: "Unknown email type" });

  try {
    const result = await resend.emails.send({
      from:    FROM,
      to:      [to],
      subject: template.subject,
      html:    template.html,
    });
    res.status(200).json({ id: result.id });
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ error: err.message });
  }
};
