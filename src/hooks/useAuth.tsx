import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

type AppRole = "admin" | "pm" | "gerente";

interface AuthContextType {
  user: User | null;
  role: AppRole | null;
  profile: { full_name: string; email: string; avatar_url: string | null } | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, role: null, profile: null, loading: true, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (u: User) => {
    try {
      const [{ data: roleData }, { data: profileData }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.id).maybeSingle(),
        supabase.from("profiles").select("full_name, email, avatar_url").eq("user_id", u.id).maybeSingle(),
      ]);
      setRole((roleData?.role as AppRole) ?? null);
      setProfile(profileData ?? null);
    } catch (err) {
      console.error("Error fetching user data:", err);
      setRole(null);
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    let initialDone = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        if (!initialDone) return;
        const u = session?.user ?? null;
        if (!u) {
          setUser(null);
          setRole(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        // Mark this tab as having an active login
        sessionStorage.setItem("sysde_session_active", "1");
        // On login: set loading=true, fetch role before showing UI
        setLoading(true);
        setUser(u);
        setTimeout(async () => {
          if (!mounted) return;
          await fetchUserData(u);
          if (mounted) setLoading(false);
        }, 0);
      }
    );

    // If no sessionStorage flag, sign out any persisted session so user sees login
    const sessionActive = sessionStorage.getItem("sysde_session_active");
    if (!sessionActive) {
      supabase.auth.signOut().then(() => {
        if (mounted) {
          setUser(null);
          setRole(null);
          setProfile(null);
          initialDone = true;
          setLoading(false);
        }
      });
    } else {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!mounted) return;
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          await fetchUserData(u);
        }
        initialDone = true;
        if (mounted) setLoading(false);
      });
    }

    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    sessionStorage.removeItem("sysde_session_active");
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
