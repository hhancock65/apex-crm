// api/invite-user.js
// SECURITY FIXES:
// 1. Uses Supabase inviteUserByEmail (magic link) instead of temp passwords
// 2. Rate limited to 5 invites per hour per IP
// 3. Origin validated — only callable from your app
// 4. Admin role verified server-side

const { createClient } = require("@supabase/supabase-js");
const { rateLimit, checkOrigin, setCORSHeaders } = require("./_middleware");

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  setCORSHeaders(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Rate limit: max 5 invites per hour per IP
  if (!rateLimit(req, res, { maxRequests: 5, windowMs: 60 * 60 * 1000 })) return;

  // CSRF check
  if (!checkOrigin(req, res)) return;

  const { name, username, email, role, orgId, inviterUserId } = req.body;

  if (!name || !username || !email || !orgId || !inviterUserId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Validate email format
  if (!/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  // Validate username format
  if (!/^[a-z0-9._-]{3,30}$/.test(username.toLowerCase())) {
    return res.status(400).json({ error: "Username: 3-30 chars, letters/numbers/dots/dashes only" });
  }

  // SERVER-SIDE: Verify the inviter is an Admin of this org
  const { data: inviter, error: inviterErr } = await supabase
    .from("profiles")
    .select("role, org_id")
    .eq("id", inviterUserId)
    .single();

  if (inviterErr || !inviter) {
    return res.status(403).json({ error: "Could not verify your account" });
  }
  if (inviter.role !== "Admin") {
    return res.status(403).json({ error: "Only admins can invite team members" });
  }
  if (inviter.org_id !== orgId) {
    return res.status(403).json({ error: "You can only invite members to your own organization" });
  }

  // Check plan seat limits
  const { data: org } = await supabase
    .from("organizations")
    .select("plan, seats_limit, name")
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

  // Check username not already taken globally
  const { data: existingUsername } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  if (existingUsername) {
    return res.status(400).json({ error: "That username is already taken. Please choose another." });
  }

  // SECURITY: Use Supabase magic link invite instead of temp passwords
  // User clicks a link in their email to set their own password
  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    email,
    {
      data: {
        name,
        username: username.toLowerCase(),
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://apex-crm-jhdm.vercel.app"}/`,
    }
  );

  if (inviteError) {
    // Handle already-registered email
    if (inviteError.message?.includes("already registered")) {
      return res.status(400).json({ error: "That email is already registered in Apex CRM." });
    }
    console.error("Invite error:", inviteError);
    return res.status(400).json({ error: inviteError.message });
  }

  // Create their profile in the org
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id:         inviteData.user.id,
      username:   username.toLowerCase(),
      name,
      role:       role || "User",
      org_id:     orgId,
      real_email: email,
    });

  if (profileError) {
    // Cleanup on failure
    await supabase.auth.admin.deleteUser(inviteData.user.id);
    console.error("Profile creation error:", profileError);
    return res.status(500).json({ error: "Failed to create user profile. Please try again." });
  }

  // Success — no temp password exposed
  res.status(200).json({
    success:  true,
    userId:   inviteData.user.id,
    message:  `Invitation sent to ${email}. They will receive a link to set their password and log in.`,
  });
};
