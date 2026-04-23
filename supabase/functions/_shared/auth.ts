import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export type AppRole = "admin" | "pm" | "gerente" | "colaborador";

export interface AuthContext {
  userId: string;
  email: string | null;
  /** Cliente con JWT del usuario (respeta RLS). */
  userClient: SupabaseClient;
  /** Cliente service_role (bypass RLS, usar con cuidado). */
  adminClient: SupabaseClient;
}

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/**
 * Valida el JWT del usuario que llama a la función.
 * Lanza AuthError si falta o es inválido.
 */
export async function requireAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError(401, "Authorization header requerido");
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    throw new AuthError(401, "Token inválido o expirado");
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    userClient,
    adminClient,
  };
}

/** Lee el rol del usuario desde public.user_roles. */
export async function getUserRole(
  adminClient: SupabaseClient,
  userId: string,
): Promise<AppRole | null> {
  const { data } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.role as AppRole) ?? null;
}

/** Lanza AuthError 403 si el rol no está permitido. */
export async function requireRole(
  ctx: AuthContext,
  allowed: AppRole[],
): Promise<AppRole> {
  const role = await getUserRole(ctx.adminClient, ctx.userId);
  if (!role || !allowed.includes(role)) {
    throw new AuthError(403, `Rol ${role ?? "sin rol"} no autorizado para esta operación`);
  }
  return role;
}

/**
 * Retorna true si el caller es el mismo usuario que targetUserId
 * o si tiene un rol privilegiado.
 */
export async function canActOnUser(
  ctx: AuthContext,
  targetUserId: string,
  privilegedRoles: AppRole[] = ["admin", "pm", "gerente"],
): Promise<boolean> {
  if (ctx.userId === targetUserId) return true;
  const role = await getUserRole(ctx.adminClient, ctx.userId);
  return !!role && privilegedRoles.includes(role);
}

/**
 * Chequeo de ownership para recursos ligados a un miembro del equipo.
 * Retorna true si el caller es el owner del team_member O tiene un rol privilegiado.
 */
export async function canAccessMember(
  ctx: AuthContext,
  memberId: string,
  privilegedRoles: AppRole[] = ["admin", "pm", "gerente"],
): Promise<boolean> {
  const role = await getUserRole(ctx.adminClient, ctx.userId);
  if (role && privilegedRoles.includes(role)) return true;

  const { data } = await ctx.adminClient
    .from("sysde_team_members")
    .select("user_id")
    .eq("id", memberId)
    .maybeSingle();
  return data?.user_id === ctx.userId;
}

export function authErrorResponse(err: unknown, corsHeaders: Record<string, string>): Response {
  const status = err instanceof AuthError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unknown error";
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
