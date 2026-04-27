import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

type AppRole = "admin" | "pm" | "gerente" | "colaborador" | "cliente" | "ceo";
export type ClientePermission = "viewer" | "editor" | "admin";

export interface ClienteAssignment {
  client_id: string;
  permission_level: ClientePermission;
}

interface AuthContextType {
  user: User | null;
  role: AppRole | null;
  profile: { full_name: string; email: string; avatar_url: string | null } | null;
  /** Sólo existe cuando role === "cliente". */
  clienteAssignment: ClienteAssignment | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, role: null, profile: null, clienteAssignment: null, loading: true, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [clienteAssignment, setClienteAssignment] = useState<ClienteAssignment | null>(null);
  const [loading, setLoading] = useState(true);

  // Prioridad: ceo > admin > pm > gerente > colaborador > cliente.
  // El CEO tiene la prioridad más alta porque es read-only sobre todo el sistema
  // y debe llevarse a su dashboard ejecutivo aunque tenga otros roles secundarios.
  // El trigger `handle_new_user` inserta `gerente` por default, así que un
  // usuario puede tener múltiples filas en user_roles. Elegimos la más alta.
  const ROLE_PRIORITY: Record<string, number> = {
    ceo: 6,
    admin: 5,
    pm: 4,
    gerente: 3,
    colaborador: 2,
    cliente: 1,
  };

  const fetchUserData = async (u: User) => {
    try {
      const [{ data: roleRows }, { data: profileData }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.id),
        supabase.from("profiles").select("full_name, email, avatar_url").eq("user_id", u.id).maybeSingle(),
      ]);
      const rows = (roleRows ?? []) as Array<{ role: string }>;
      const best = rows.reduce<string | null>((acc, r) => {
        if (!r?.role) return acc;
        if (!acc) return r.role;
        return (ROLE_PRIORITY[r.role] ?? 0) > (ROLE_PRIORITY[acc] ?? 0) ? r.role : acc;
      }, null);
      const bestRole = (best as AppRole | null) ?? null;
      setRole(bestRole);
      setProfile(profileData ?? null);

      // Cuando es cliente, buscamos su asignación (empresa + nivel de permiso).
      if (bestRole === "cliente") {
        const { data: assignment } = await supabase
          .from("cliente_company_assignments" as any)
          .select("client_id, permission_level")
          .eq("user_id", u.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setClienteAssignment(
          assignment ? (assignment as unknown as ClienteAssignment) : null
        );
      } else {
        setClienteAssignment(null);
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
      setRole(null);
      setProfile(null);
      setClienteAssignment(null);
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
          setClienteAssignment(null);
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
          setClienteAssignment(null);
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
    setClienteAssignment(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, profile, clienteAssignment, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
