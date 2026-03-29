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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) { setUser(session.user); fetchProfile(session.user.id); }
      else { setUser(null); setProfile(null); setOrg(null); setInitializing(false); }
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

  // Login with username + password
  // For new signups (real email): tries real email first, falls back to username@apexcrm.app
  async function login(username, password) {
    setError(""); setLoading(true);
    const trimmed = username.trim().toLowerCase();

    // First try: treat input as a username, look up the real email from profiles
    const { data: profileData } = await supabase
      .from("profiles")
      .select("real_email")
      .eq("username", trimmed)
      .single();

    let emailToUse = profileData?.real_email || null;

    // If no real email found, fall back to internal format (legacy users)
    if (!emailToUse) {
      emailToUse = `${trimmed}@apexcrm.app`;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    });

    setLoading(false);
    if (authError) {
      setError("Invalid username or password.");
      return false;
    }
    return true;
  }

  // Self-serve signup — uses REAL email for Supabase auth
  async function signup({ name, username, email, orgName, password }) {
    setError(""); setLoading(true);
    const trimmed  = username.trim().toLowerCase();
    const trimEmail = email.trim().toLowerCase();
    const slug = orgName.toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    // Create auth user with REAL email
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email:    trimEmail,
      password,
      options: {
        data: { name, username: trimmed },
        emailRedirectTo: window.location.origin,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return false;
    }

    // Supabase may require email confirmation — handle gracefully
    if (authData?.user && !authData.session) {
      // Email confirmation required — create org/profile and show confirmation message
      await supabase.rpc("create_org_and_profile", {
        p_user_id:  authData.user.id,
        p_username: trimmed,
        p_name:     name,
        p_org_name: orgName,
        p_org_slug: slug,
      });
      // Also store real_email in profile
      await supabase.from("profiles").update({ real_email: trimEmail }).eq("id", authData.user.id);
      setLoading(false);
      setNeedsConfirmation(true);
      return "confirm";
    }

    // No confirmation needed — create org + profile immediately
    const { error: fnError } = await supabase.rpc("create_org_and_profile", {
      p_user_id:  authData.user.id,
      p_username: trimmed,
      p_name:     name,
      p_org_name: orgName,
      p_org_slug: slug,
    });

    // Store real email in profile
    await supabase.from("profiles").update({ real_email: trimEmail }).eq("id", authData.user.id);

    if (fnError) {
      setError("Account created but setup failed. Contact support.");
      setLoading(false);
      return false;
    }

    setLoading(false);
    return true;
  }

  async function logout() { await supabase.auth.signOut(); }

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
