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

  // Login — uses real email directly (stored in Supabase auth)
  // Users sign in with username, but we look it up via a public RPC function
  async function login(username, password) {
    setError(""); setLoading(true);
    const trimmed = username.trim().toLowerCase();

    // Call a public Supabase function to resolve username → email
    // This bypasses RLS since it's a SECURITY DEFINER function
    const { data: emailData, error: rpcError } = await supabase
      .rpc("get_email_for_username_v2", { p_username: trimmed });

    let emailToUse = emailData || null;

    // Fallback for legacy users created with @apexcrm.app
    if (!emailToUse || rpcError) {
      emailToUse = `${trimmed}@apexcrm.app`;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    });

    // If first attempt fails, try the other format
    if (authError) {
      const fallback = emailToUse.includes("@apexcrm.app")
        ? null
        : `${trimmed}@apexcrm.app`;

      if (fallback) {
        const { error: fallbackError } = await supabase.auth.signInWithPassword({
          email: fallback,
          password,
        });
        if (!fallbackError) { setLoading(false); return true; }
      }

      setError("Invalid username or password.");
      setLoading(false);
      return false;
    }

    setLoading(false);
    return true;
  }

  // Self-serve signup — uses REAL email for Supabase auth
  async function signup({ name, username, email, orgName, password }) {
    setError(""); setLoading(true);
    const trimmed   = username.trim().toLowerCase();
    const trimEmail = email.trim().toLowerCase();
    const slug = orgName.toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

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

    // Email confirmation required
    if (authData?.user && !authData.session) {
      await supabase.rpc("create_org_and_profile", {
        p_user_id:  authData.user.id,
        p_username: trimmed,
        p_name:     name,
        p_org_name: orgName,
        p_org_slug: slug,
      });
      await supabase.from("profiles")
        .update({ real_email: trimEmail })
        .eq("id", authData.user.id);
      setLoading(false);
      setNeedsConfirmation(true);
      return "confirm";
    }

    // No confirmation needed
    await supabase.rpc("create_org_and_profile", {
      p_user_id:  authData.user.id,
      p_username: trimmed,
      p_name:     name,
      p_org_name: orgName,
      p_org_slug: slug,
    });
    await supabase.from("profiles")
      .update({ real_email: trimEmail })
      .eq("id", authData.user.id);

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
