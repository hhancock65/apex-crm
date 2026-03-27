import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useAuth() {
  const [user, setUser]             = useState(null);
  const [profile, setProfile]       = useState(null);
  const [org, setOrg]               = useState(null);
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [initializing, setInitializing] = useState(true);

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

  async function login(username, password) {
    setError(""); setLoading(true);
    const trimmed = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(trimmed)) {
      setError("Username must be 3–30 characters: letters, numbers, dots, dashes.");
      setLoading(false); return false;
    }
    const internalEmail = `${trimmed}@apexcrm.internal`;
    const { error: authError } = await supabase.auth.signInWithPassword({ email: internalEmail, password });
    setLoading(false);
    if (authError) { setError("Invalid username or password."); return false; }
    return true;
  }

  // Self-serve signup — creates auth user + org + profile
  async function signup({ name, username, orgName, password }) {
    setError(""); setLoading(true);
    const trimmed = username.trim().toLowerCase();
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const internalEmail = `${trimmed}@apexcrm.internal`;

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: internalEmail,
      password,
      options: { data: { name, username } },
    });
    if (authError) { setError(authError.message); setLoading(false); return false; }

    // Create org + profile
    const { error: fnError } = await supabase.rpc("create_org_and_profile", {
      p_user_id:  authData.user.id,
      p_username: trimmed,
      p_name:     name,
      p_org_name: orgName,
      p_org_slug: slug,
    });
    if (fnError) { setError("Account created but setup failed. Contact support."); setLoading(false); return false; }

    setLoading(false);
    return true;
  }

  async function logout() { await supabase.auth.signOut(); }

  // Trial helpers
  const trialDaysLeft = org ? Math.max(0, Math.ceil((new Date(org.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24))) : 0;
  const isTrialExpired = org?.plan === "trial" && trialDaysLeft === 0;
  const isPro = org?.plan === "pro";
  const isStarter = org?.plan === "starter";
  const isActive = org && !isTrialExpired;

  const mergedUser = user ? {
    id:       user.id,
    email:    profile?.real_email || "",
    username: profile?.username   || user.email.split("@")[0],
    name:     profile?.name       || profile?.username || user.email.split("@")[0],
    role:     profile?.role       || "User",
    org_id:   profile?.org_id     || null,
  } : null;

  return {
    user: mergedUser, org, error, loading, initializing,
    trialDaysLeft, isTrialExpired, isPro, isStarter, isActive,
    login, signup, logout,
  };
}
