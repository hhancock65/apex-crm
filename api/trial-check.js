// api/trial-check.js
// Runs daily via Vercel cron (see vercel.json)
// Sends trial warning emails at day 7 and day 3
// Pings health check URL so you know if it fails

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  // Verify this is called by Vercel cron, not a random request
  const authHeader = req.headers["authorization"] || "";
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://apex-crm-jhdm.vercel.app";
  const now    = new Date();
  let emailsSent = 0;
  let errors = 0;

  // Find orgs on trial with 7 or 3 days left
  const { data: orgs, error: fetchError } = await supabase
    .from("organizations")
    .select("id, name, trial_ends_at")
    .eq("plan", "trial")
    .not("trial_ends_at", "is", null);

  if (fetchError) {
    console.error("Failed to fetch orgs:", fetchError);
    return res.status(500).json({ error: fetchError.message });
  }

  for (const org of orgs || []) {
    const trialEnd  = new Date(org.trial_ends_at);
    const daysLeft  = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

    if (daysLeft !== 7 && daysLeft !== 3) continue;

    // Get admin email
    const { data: admin } = await supabase
      .from("profiles")
      .select("real_email, name")
      .eq("org_id", org.id)
      .eq("role", "Admin")
      .single();

    if (!admin?.real_email) continue;

    try {
      const emailRes = await fetch(`${appUrl}/api/send-email`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${process.env.INTERNAL_API_SECRET}`,
        },
        body: JSON.stringify({
          type: "trial_warning",
          to:   admin.real_email,
          data: { name: admin.name, daysLeft, orgName: org.name },
        }),
      });

      if (emailRes.ok) {
        emailsSent++;
        console.log(`Trial warning sent to ${admin.real_email} — ${daysLeft} days left`);
      } else {
        errors++;
        console.error(`Failed to send to ${admin.real_email}`);
      }
    } catch (err) {
      errors++;
      console.error(`Email error for org ${org.id}:`, err);
    }
  }

  const result = {
    success:     true,
    timestamp:   now.toISOString(),
    orgsChecked: orgs?.length || 0,
    emailsSent,
    errors,
  };

  console.log("Trial check complete:", result);

  // Ping health check monitor if configured
  // Sign up free at betteruptime.com or uptimerobot.com
  // Add your heartbeat URL as CRON_HEALTH_CHECK_URL in Vercel
  if (process.env.CRON_HEALTH_CHECK_URL && errors === 0) {
    try {
      await fetch(process.env.CRON_HEALTH_CHECK_URL);
    } catch (_) {}
  }

  res.status(200).json(result);
};
