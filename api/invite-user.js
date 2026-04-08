// api/invite-user.js
// Creates a new team member under an existing org
// Only callable by Admins — verified server-side

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, username, email, role, orgId, inviterUserId } = req.body;

  if (!name || !username || !email || !orgId || !inviterUserId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Verify the inviter is an Admin of this org
  const { data: inviter } = await supabase
    .from("profiles")
    .select("role, org_id")
    .eq("id", inviterUserId)
    .single();

  if (!inviter || inviter.role !== "Admin" || inviter.org_id !== orgId) {
    return res.status(403).json({ error: "Only admins can invite team members" });
  }

  // Check plan limits
  const { data: org } = await supabase
    .from("organizations")
    .select("plan, seats_limit")
    .eq("id", orgId)
    .single();

  const { count: currentMembers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  if (org?.seats_limit !== -1 && currentMembers >= org?.seats_limit) {
    return res.status(403).json({
      error: `Your ${org.plan} plan allows ${org.seats_limit} team member${org.seats_limit !== 1 ? "s" : ""}. Upgrade to Pro for unlimited members.`,
      limitReached: true,
    });
  }

  // Check username not already taken
  const { data: existingUsername } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username.toLowerCase())
    .single();

  if (existingUsername) {
    return res.status(400).json({ error: "That username is already taken. Please choose another." });
  }

  // Generate a temporary password
  const tempPassword = Math.random().toString(36).slice(-10) + "Ax1!";

  // Create the auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true, // Auto-confirm so they can log in immediately
    user_metadata: {
      name,
      username: username.toLowerCase(),
      org_name: "", // Will be set via profile
    },
  });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  // Create their profile in the same org
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id:         authData.user.id,
      username:   username.toLowerCase(),
      name,
      role:       role || "User",
      org_id:     orgId,
      real_email: email,
    });

  if (profileError) {
    // Cleanup the auth user if profile creation failed
    await supabase.auth.admin.deleteUser(authData.user.id);
    return res.status(500).json({ error: "Failed to create user profile" });
  }

  // Send welcome email with credentials via Resend
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://apex-crm-jhdm.vercel.app";
    await fetch(`${appUrl}/api/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.INTERNAL_API_SECRET}`,
      },
      body: JSON.stringify({
        type: "team_invite",
        to: email,
        data: { name, username: username.toLowerCase(), tempPassword, appUrl, inviterName: "" },
      }),
    });
  } catch (e) {
    console.error("Failed to send invite email:", e);
    // Don't fail the whole request if email fails
  }

  res.status(200).json({
    success: true,
    userId: authData.user.id,
    tempPassword, // Return so admin can share it if email fails
  });
};
