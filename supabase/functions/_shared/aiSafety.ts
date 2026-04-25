/**
 * Helpers de seguridad y trazabilidad para edge functions de IA.
 *
 * Importable desde cualquier función bajo supabase/functions/<nombre>/index.ts:
 *   import { redactConfidentialTicket, logAiCall, checkRateLimit, assertNotCliente } from "../_shared/aiSafety.ts";
 *
 * Cubre:
 *   • Redacción de campos confidenciales antes de enviar a LLM
 *   • Logging unificado en ai_usage_logs (con user_id + scope + redacted flag)
 *   • Rate limit por usuario + función (anti-abuso)
 *   • Bloqueo explícito del rol cliente (las IA son herramientas internas)
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { AuthError, getUserRole, type AuthContext } from "./auth.ts";

// ─── Confidencialidad ────────────────────────────────────────────────

/**
 * Campos potencialmente sensibles en un ticket (descripción técnica con
 * credenciales, notas con info de acceso, etc). Cuando is_confidential=true
 * los enmascaramos antes de pasar al LLM.
 */
const CONFIDENTIAL_FIELDS = [
  "descripcion",
  "notas",
  "ubicacion_error",
  "info_acceso",
  "usuario_de_servicio",
  "contrasena",
  "credenciales",
] as const;

/**
 * Redacta los campos confidenciales de un ticket si is_confidential=true.
 * Retorna { ticket: redactado, redacted: boolean }.
 *
 * El asunto + ticket_id quedan visibles (necesarios para que la IA tenga
 * contexto mínimo). Lo demás se reemplaza con "[REDACTADO — caso confidencial]".
 */
export function redactConfidentialTicket<T extends Record<string, any>>(
  ticket: T | null | undefined,
): { ticket: T | null; redacted: boolean } {
  if (!ticket) return { ticket: null, redacted: false };
  if (!ticket.is_confidential) return { ticket, redacted: false };

  const out: Record<string, any> = { ...ticket };
  for (const field of CONFIDENTIAL_FIELDS) {
    if (field in out && out[field] != null && out[field] !== "") {
      out[field] = "[REDACTADO — caso confidencial]";
    }
  }
  return { ticket: out as T, redacted: true };
}

/** Aplica redactConfidentialTicket a un array. */
export function redactConfidentialTickets<T extends Record<string, any>>(
  tickets: T[],
): { tickets: T[]; redactedCount: number } {
  let redactedCount = 0;
  const out = tickets.map((t) => {
    const { ticket, redacted } = redactConfidentialTicket(t);
    if (redacted) redactedCount++;
    return ticket as T;
  });
  return { tickets: out, redactedCount };
}

/**
 * Enmascara emails en un texto libre (foo@bar.com → f**@b**.com).
 * Usalo cuando el campo no se puede redactar entero pero querés mitigar PII.
 */
export function maskEmails(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(/([\w.+-])([\w.+-]*)@([\w])([\w.-]*)/g, (_m, a, _b, c, d) => {
    const dom = d.split(".");
    const tld = dom.pop();
    return `${a}***@${c}***.${tld}`;
  });
}

// ─── Audit log ──────────────────────────────────────────────────────

export interface AiCallLog {
  function_name: string;
  model: string;
  user_id?: string | null;
  scope?: string | null;
  client_id?: string | null;
  redacted?: boolean;
  status: "success" | "error" | "rate_limited";
  error_message?: string | null;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  metadata?: Record<string, any>;
}

/**
 * Inserta un row en ai_usage_logs. Usa service_role (adminClient) porque
 * el RLS de la tabla está endurecido. Nunca tira: si el insert falla solo
 * loggea a console.error.
 */
export async function logAiCall(
  adminClient: SupabaseClient,
  log: AiCallLog,
): Promise<void> {
  try {
    const { error } = await adminClient.from("ai_usage_logs").insert({
      function_name: log.function_name,
      model: log.model,
      user_id: log.user_id ?? null,
      scope: log.scope ?? null,
      client_id: log.client_id ?? null,
      redacted: log.redacted ?? false,
      status: log.status,
      error_message: log.error_message ?? null,
      prompt_tokens: log.prompt_tokens ?? 0,
      completion_tokens: log.completion_tokens ?? 0,
      total_tokens: log.total_tokens ?? 0,
      metadata: log.metadata ?? {},
    });
    if (error) console.error("[aiSafety] log insert failed:", error.message);
  } catch (e) {
    console.error("[aiSafety] log insert threw:", e);
  }
}

// ─── Rate limit ──────────────────────────────────────────────────────

/**
 * Cuenta llamadas previas del usuario a esta función en la última hora.
 * Tira AuthError 429 si excede maxPerHour.
 *
 * Uso típico al inicio del handler:
 *   await checkRateLimit(ctx.adminClient, ctx.userId, "case-strategy-ai", 30);
 */
export async function checkRateLimit(
  adminClient: SupabaseClient,
  userId: string,
  functionName: string,
  maxPerHour: number,
): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await adminClient
    .from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("function_name", functionName)
    .eq("status", "success")
    .gte("created_at", oneHourAgo);

  if (error) {
    console.warn("[aiSafety] rate limit check failed (open):", error.message);
    return; // si el query falla no bloqueamos al user
  }

  if ((count ?? 0) >= maxPerHour) {
    throw new AuthError(
      429,
      `Rate limit: máximo ${maxPerHour} llamadas/hora a ${functionName}. Intentá de nuevo en un rato.`,
    );
  }
}

// ─── Cliente role bloqueado ──────────────────────────────────────────

/**
 * Las IA del SVA son herramientas internas — el rol cliente NUNCA debe
 * invocarlas. Tira AuthError 403 si el caller es cliente.
 *
 * Llamarla DESPUÉS de requireAuth y ANTES de procesar el body.
 */
export async function assertNotCliente(ctx: AuthContext): Promise<void> {
  const role = await getUserRole(ctx.adminClient, ctx.userId);
  if (role === "cliente") {
    throw new AuthError(403, "Las funciones de IA son herramientas internas; rol cliente no autorizado");
  }
}
