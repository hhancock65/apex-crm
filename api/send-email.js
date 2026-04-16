// api/send-email.js
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

// ── Email templates ───────────────────────────────────────────

function welcomeEmail({ name, orgName }) {
  return {
    subject: `Welcome to Apex CRM, ${name}!`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px">
        <div style="font-size:20px;font-weight:700;color:#1A1917;margin-bottom:32px">Apex <span style="color:#185FA5;font-weight:400">CRM</span></div>
        <h1 style="font-size:24px;font-weight:700;color:#1A1917;margin-bottom:12px">Welcome aboard, ${name}!</h1>
        <p style="font-size:15px;color:#7A7875;line-height:1.7;margin-bottom:24px">
          Your account for <strong>${orgName}</strong> is all set. You have 14 days to explore everything Apex CRM has to offer — no credit card needed.
        </p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="display:inline-block;background:#185FA5;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;margin-bottom:32px">
          Open Apex CRM →
        </a>
        <p style="font-size:12px;color:#B4B2A9;margin-top:32px">© 2026 Apex CRM</p>
      </div>`,
  };
}

function trialWarningEmail({ name, daysLeft, orgName }) {
  const urgent = daysLeft <= 3;
  return {
    subject: urgent
      ? `⚠️ Only ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left in your Apex CRM trial`
      : `Your Apex CRM trial ends in ${daysLeft} days`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px">
        <div style="font-size:20px;font-weight:700;color:#1A1917;margin-bottom:32px">Apex <span style="color:#185FA5;font-weight:400">CRM</span></div>
        <h1 style="font-size:24px;font-weight:700;color:#1A1917;margin-bottom:12px">
          ${urgent ? `⚠️ Your trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}` : `Your trial ends in ${daysLeft} days`}
        </h1>
        <p style="font-size:15px;color:#7A7875;line-height:1.7;margin-bottom:24px">
          Hi ${name}, your free trial for <strong>${orgName}</strong> is almost over.
          Upgrade now to keep all your contacts, deals, and data — and continue closing more business.
        </p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}?upgrade=true" style="display:inline-block;background:${urgent ? "#E24B4A" : "#185FA5"};color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;margin-bottom:32px">
          Choose a plan →
        </a>
        <p style="font-size:12px;color:#B4B2A9;margin-top:32px">© 2026 Apex CRM</p>
      </div>`,
  };
}

function paymentConfirmEmail({ name, plan, orgName }) {
  return {
    subject: `Payment confirmed — Welcome to Apex CRM ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px">
        <div style="font-size:20px;font-weight:700;color:#1A1917;margin-bottom:32px">Apex <span style="color:#185FA5;font-weight:400">CRM</span></div>
        <h1 style="font-size:24px;font-weight:700;color:#1A1917;margin-bottom:12px">Payment confirmed!</h1>
        <p style="font-size:15px;color:#7A7875;line-height:1.7;margin-bottom:24px">
          Hi ${name}, your payment was successful. <strong>${orgName}</strong> is now on the
          <strong>${plan.charAt(0).toUpperCase() + plan.slice(1)}</strong> plan — all features are unlocked.
        </p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="display:inline-block;background:#185FA5;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;margin-bottom:32px">
          Open Apex CRM →
        </a>
        <p style="font-size:12px;color:#B4B2A9;margin-top:32px">© 2026 Apex CRM · You can manage your billing anytime from Settings.</p>
      </div>`,
  };
}

function paymentFailedEmail({ name, orgName, plan, graceEndDate, billingUrl }) {
  return {
    subject: `Action required — Payment failed for your Apex CRM account`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px">
        <div style="font-size:20px;font-weight:700;color:#1A1917;margin-bottom:32px">Apex <span style="color:#185FA5;font-weight:400">CRM</span></div>
        <div style="background:#FCEBEB;border:1px solid #F09595;border-radius:8px;padding:16px;margin-bottom:24px">
          <div style="font-size:14px;font-weight:600;color:#A32D2D;margin-bottom:4px">Payment failed</div>
          <div style="font-size:13px;color:#A32D2D">We were unable to charge the card on file for your ${plan} subscription.</div>
        </div>
        <h1 style="font-size:22px;font-weight:700;color:#1A1917;margin-bottom:12px">Hi ${name}, please update your payment</h1>
        <p style="font-size:15px;color:#7A7875;line-height:1.7;margin-bottom:8px">
          Your <strong>${orgName}</strong> account will remain active until <strong>${graceEndDate}</strong>.
          After that, your account will be paused and you'll lose access to your data.
        </p>
        <p style="font-size:15px;color:#7A7875;line-height:1.7;margin-bottom:24px">
          To keep your account active, please update your payment method before ${graceEndDate}.
        </p>
        <a href="${billingUrl || process.env.NEXT_PUBLIC_APP_URL}" style="display:inline-block;background:#E24B4A;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;margin-bottom:24px">
          Update payment method →
        </a>
        <p style="font-size:13px;color:#7A7875;line-height:1.7">
          If you have questions about your bill, reply to this email or contact us at support@apexcrm.com.
        </p>
        <p style="font-size:12px;color:#B4B2A9;margin-top:32px">© 2026 Apex CRM</p>
      </div>`,
  };
}

function teamInviteEmail({ name, username, appUrl }) {
  return {
    subject: `You've been invited to Apex CRM`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px">
        <div style="font-size:20px;font-weight:700;color:#1A1917;margin-bottom:32px">Apex <span style="color:#185FA5;font-weight:400">CRM</span></div>
        <h1 style="font-size:24px;font-weight:700;color:#1A1917;margin-bottom:12px">You're invited!</h1>
        <p style="font-size:15px;color:#7A7875;line-height:1.7;margin-bottom:24px">
          Hi ${name}, you've been added as a team member on Apex CRM.
          Click the button below to set your password and get started.
        </p>
        <div style="background:#F5F5F4;border-radius:8px;padding:14px 16px;margin-bottom:24px;font-size:13px;color:#7A7875">
          Your username: <strong style="color:#1A1917;font-family:monospace">${username}</strong>
        </div>
        <a href="${appUrl}" style="display:inline-block;background:#185FA5;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;margin-bottom:32px">
          Accept invitation →
        </a>
        <p style="font-size:12px;color:#B4B2A9;margin-top:32px">© 2026 Apex CRM</p>
      </div>`,
  };
}

// ── Handler ───────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Internal auth check
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace("Bearer ", "");
  if (token !== process.env.INTERNAL_API_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { type, to, data } = req.body;
  if (!type || !to) return res.status(400).json({ error: "Missing type or recipient" });

  let template;
  if      (type === "welcome")         template = welcomeEmail(data);
  else if (type === "trial_warning")   template = trialWarningEmail(data);
  else if (type === "payment_confirm") template = paymentConfirmEmail(data);
  else if (type === "payment_failed")  template = paymentFailedEmail(data);
  else if (type === "team_invite")     template = teamInviteEmail(data);
  else return res.status(400).json({ error: `Unknown email type: ${type}` });

  const fromAddress = process.env.EMAIL_FROM || "Apex CRM <noreply@apexcrm.com>";

  try {
    const { data: result, error } = await resend.emails.send({
      from:    fromAddress,
      to:      [to],
      subject: template.subject,
      html:    template.html,
    });
    if (error) throw error;
    res.status(200).json({ success: true, id: result?.id });
  } catch (err) {
    console.error("Email send error:", err);
    res.status(500).json({ error: err.message });
  }
};
