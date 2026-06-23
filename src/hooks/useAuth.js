import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { supabase } from "../lib/supabase";

// Deterministic password for Supabase sync (never shown to users)
function getSyncPassword(clerkId) {
  return "clk_" + clerkId + "_apex_sync_key";
}

export function useAuth() {
  const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { signOut: clerkSignOut } = useClerk();

  const [supabaseUser, setSupabaseUser] = useState(null);
  const [profile, setProfile]           = useState(null);
  const [org, setOrg]                   = useState(null);
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [initializing, setInitializing] = useState(true);

  // When Clerk auth state changes, sync with Supabase
  useEffect(() => {
    if (!clerkLoaded) return;

    if (isSignedIn && clerkUser) {
      setInitializing(true); // Show loading while syncing
      syncWithSupabase(clerkUser);
    } else {
      setSupabaseUser(null);
      setProfile(null);
      setOrg(null);
      setInitializing(false);
    }
  }, [clerkLoaded, isSignedIn, clerkUser?.id]);

  async function syncWithSupabase(cu) {
    setLoading(true);
    setError("");
    const clerkId      = cu.id;
    const email        = cu.primaryEmailAddress?.emailAddress || "";
    const name         = cu.fullName || cu.firstName || email.split("@")[0];
    const username     = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
    const password     = getSyncPassword(clerkId);
    const internalEmail = "clerk_" + clerkId + "@apexcrm.internal";

    // Try to sign into existing Supabase account
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: internalEmail,
      password: password,
    });

    if (!signInError && signInData?.user) {
      // Existing user — fetch profile
      setSupabaseUser(signInData.user);
      await fetchProfile(signInData.user.id);
      setLoading(false);
      return;
    }

    // New user — create Supabase account
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: internalEmail,
      password: password,
      options: { data: { name: name, username: username, clerk_id: clerkId } },
    });

    if (signUpError || !signUpData?.user) {
      setError("Failed to set up your account. Please try again.");
      setLoading(false);
      setInitializing(false);
      return;
    }

    // Create org + profile via your existing RPC
    const orgName = name + "'s Organization";
    const slug    = orgName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

    const { error: rpcError } = await supabase.rpc("create_org_and_profile", {
      p_user_id:  signUpData.user.id,
      p_username: username,
      p_name:     name,
      p_org_name: orgName,
      p_org_slug: slug,
    });

    if (rpcError) {
      setError("Account created but setup failed. Contact support.");
      setLoading(false);
      setInitializing(false);
      return;
    }

    setSupabaseUser(signUpData.user);
    await fetchProfile(signUpData.user.id);
    setLoading(false);
  }

  async function fetchProfile(userId) {
    const { data: p } = await supabase
      .from("profiles")
      .select("username, real_email, name, role, org_id")
      .eq("id", userId)
      .single();
    if (p) {
      setProfile(p);
      if (p.org_id) {
        const { data: o } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", p.org_id)
          .single();
        if (o) setOrg(o);
      }
    }
    setInitializing(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    await clerkSignOut();
  }

  // Trial helpers (unchanged from your original)
  const trialDaysLeft = org ? Math.max(0, Math.ceil((new Date(org.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24))) : 0;
  const isTrialExpired = org?.plan === "trial" && trialDaysLeft === 0;
  const isPro     = org?.plan === "pro";
  const isStarter = org?.plan === "starter";
  const isActive  = org && !isTrialExpired;

  const mergedUser = supabaseUser ? {
    id:       supabaseUser.id,
    email:    profile?.real_email || clerkUser?.primaryEmailAddress?.emailAddress || "",
    username: profile?.username   || clerkUser?.firstName?.toLowerCase() || "user",
    name:     profile?.name       || clerkUser?.fullName || "User",
    role:     profile?.role       || "User",
    org_id:   profile?.org_id     || null,
  } : null;

  return {
    user: mergedUser, org, error, loading, initializing,
    trialDaysLeft, isTrialExpired, isPro, isStarter, isActive,
    login: function(){},   // Clerk handles this now
    signup: function(){},  // Clerk handles this now
    logout,
  };
}