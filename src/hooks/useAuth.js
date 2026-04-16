import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useAuth() {
  const [user, setUser]                 = useState(null);
  const [profile, setProfile]           = useState(null);
  const [org, setOrg]                   = useState(null);
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); fetchProfile(session.user.id); }
      else setInitializing(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (session?.user) { setUser(session.user); fetchProfile(session.user.id); }
      } else if (event === "SIGNED_OUT") {
        setUser(null); setProfile(null); setOrg(null); setInitializing(false);
      } else if (!session) {
        setInitializing(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

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

  // Login — resolves username → real email via RPC, then authenticates
  async function login(username, password) {
    setError(""); setLoading(true);
    const trimmed = username.trim().toLowerCase();

    // Step 1: resolve username to real email via SECURITY DEFINER function
    let emailToUse = null;
    try {
      const { data: emailData } = await supabase
        .rpc("get_email_for_username_v2", { p_username: trimmed });
      if (emailData) emailToUse = emailData;
    } catch (rpcErr) {
      console.warn("RPC lookup failed, trying fallback:", rpcErr);
    }

    // Step 2: if RPC failed, try direct profile lookup (may fail due to RLS)
    if (!emailToUse) {
      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("real_email")
          .eq("username", trimmed)
          .single();
        if (profileData?.real_email) emailToUse = profileData.real_email;
      } catch (_) {}
    }

    // Step 3: if still nothing, they might be a legacy user
    if (!emailToUse) {
      emailToUse = `${trimmed}@apexcrm.app`;
    }

    // Attempt login with resolved email
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    });

    // If that failed and we used a real email, don't try again
    if (authError) {
      setError("Invalid username or password. Please check your credentials.");
      setLoading(false);
      return false;
    }

    setLoading(false);
    return true;
  }

  // Self-serve signup — org + profile created by DB trigger
  async function signup({ name, username, email, orgName, password }) {
    setError(""); setLoading(true);
    const trimmed   = username.trim().toLowerCase();
    const trimEmail = email.trim().toLowerCase();
    const slug = orgName.toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const redirectUrl = process.env.REACT_APP_SITE_URL || window.location.origin;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email:    trimEmail,
      password,
      options: {
        data: { name, username: trimmed, org_name: orgName, org_slug: slug },
        emailRedirectTo: redirectUrl,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return false;
    }

    // Email confirmation required — trigger already created org+profile
    if (authData?.user && !authData.session) {
      setLoading(false);
      setNeedsConfirmation(true);
      return "confirm";
    }

    setLoading(false);
    return true;
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  const trialDaysLeft  = org ? Math.max(0, Math.ceil((new Date(org.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24))) : 0;
  const isTrialExpired = org?.plan === "trial" && trialDaysLeft === 0;
  const isPro          = org?.plan === "pro";
  const isStarter      = org?.plan === "starter";
  const isActive       = org && !isTrialExpired;

  const mergedUser = user ? {
    id:       user.id,
    email:    profile?.real_email || user.email || "",
    username: profile?.username   || user.email?.split("@")[0] || "",
    name:     profile?.name       || profile?.username || "",
    role:     profile?.role       || "User",
    org_id:   profile?.org_id     || null,
  } : null;

  return {
    user: mergedUser, org, error, loading, initializing,
    needsConfirmation, setNeedsConfirmation,
    trialDaysLeft, isTrialExpired, isPro, isStarter, isActive,
    login, signup, logout,
  };
}
