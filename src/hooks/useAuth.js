import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useAuth() {
  const [user, setUser]           = useState(null);
  const [profile, setProfile]     = useState(null);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Restore session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
      setInitializing(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from("profiles")
      .select("username, real_email, name, role")
      .eq("id", userId)
      .single();
    if (data) setProfile(data);
  }

  // Login with username + password
  // Converts username → internal fake email, then signs in via Supabase auth
  async function login(username, password) {
    setError("");
    setLoading(true);

    const trimmed = username.trim().toLowerCase();

    // Validate username format before hitting the DB
    if (!/^[a-z0-9._-]{3,30}$/.test(trimmed)) {
      setError("Username must be 3–30 characters: letters, numbers, dots, dashes.");
      setLoading(false);
      return false;
    }

    // Convert username to the internal email format we store in Supabase auth
    const internalEmail = `${trimmed}@apexcrm.internal`;

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: internalEmail,
      password,
    });

    setLoading(false);

    if (authError) {
      setError("Invalid username or password.");
      return false;
    }

    return true;
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  // Merged user object exposed to the rest of the app
  const mergedUser = user
    ? {
        id:        user.id,
        username:  profile?.username  || user.email.split("@")[0],
        email:     profile?.real_email || "",
        name:      profile?.name      || profile?.username || user.email.split("@")[0],
        role:      profile?.role      || "User",
      }
    : null;

  return { user: mergedUser, error, loading, initializing, login, logout };
}
