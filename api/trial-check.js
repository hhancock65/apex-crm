// api/trial-check.js
// Vercel Cron Job — runs daily, sends trial warning emails
// Add to vercel.json cron config to run automatically

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app";

async function sendEmail(type, to, data) {
  await fetch(`${APP_URL}/api/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.INTERNAL_API_SECRET}`,
    },
    body: JSON.stringify({ type, to, data }),
  });
}

module.exports = async (req, res) => {
  // Verify this is called by Vercel cron (or our own secret)
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Find all orgs on trial
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, plan, trial_ends_at")
    .eq("plan", "trial");

  if (!orgs?.length) return res.status(200).json({ checked: 0 });

  let emailsSent = 0;

  for (const org of orgs) {
    const daysLeft = Math.max(0, Math.ceil(
      (new Date(org.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)
    ));

    // Only send at day 7 and day 3
    if (daysLeft !== 7 && daysLeft !== 3) continue;

    // Get admin user for this org
    const { data: admin } = await supabase
      .from("profiles")
      .select("name, real_email")
      .eq("org_id", org.id)
      .eq("role", "Admin")
      .single();

    if (!admin?.real_email) continue;

    await sendEmail("trial_warning", admin.real_email, {
      name:    admin.name,
      orgName: org.name,
      daysLeft,
    });

    emailsSent++;
  }

  res.status(200).json({ checked: orgs.length, emailsSent });
};
