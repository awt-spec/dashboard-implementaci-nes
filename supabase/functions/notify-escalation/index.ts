import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { AuthError, requireAuth, requireRole } from "../_shared/auth.ts";

// ─────────────────────────────────────────────────────────────────────────────
// notify-escalation — Notifica de verdad una escalación del CSR.
// El CSR no puede insertar en user_notifications de otros usuarios (RLS lo
// restringe a admin/pm/gerente), así que esta función usa service_role para:
//   1) resolver los destinatarios reales por rol según el destino de escalación,
//   2) crear una notificación in-app (campana + realtime) para cada uno,
//   3) marcarla email_queued para que el pipeline de correo (Resend) la envíe.
// Los destinos "María Fernanda" (negocio) y "EW" (técnico) son placeholders del
// flujo del CSR; se resuelven a los roles responsables reales.
// ─────────────────────────────────────────────────────────────────────────────

const FUNCTION_NAME = "notify-escalation";

// Destino de escalación → roles que deben enterarse.
const TARGET_ROLES: Record<string, string[]> = {
  "María Fernanda": ["pm", "admin"],   // apoyo / negocio
  "EW": ["gerente_soporte", "admin"],  // escalamiento técnico
};
const CLOSED = ["CERRADA", "ANULADA", "ENTREGADA", "APROBADA"];

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);
  try {
    const ctx = await requireAuth(req);
    await requireRole(ctx, ["admin", "pm", "gerente_soporte", "csr"]);

    const { ticket_id, target, motivo } = await req.json().catch(() => ({}));
    if (!ticket_id || !target) {
      return new Response(JSON.stringify({ error: "ticket_id y target son requeridos." }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const admin = ctx.adminClient;
    const roles = TARGET_ROLES[target] ?? ["admin"];

    // 1) Resolver destinatarios reales por rol (sin el propio CSR).
    const { data: roleRows } = await admin
      .from("user_roles").select("user_id").in("role", roles);
    const recipientIds = [...new Set((roleRows ?? []).map((r: any) => r.user_id))]
      .filter((id: string) => id && id !== ctx.userId);

    // 2) Datos del ticket para el cuerpo de la notificación.
    const { data: ticket } = await admin
      .from("support_tickets")
      .select("ticket_id, asunto, client_id, estado")
      .eq("id", ticket_id).maybeSingle();
    const code = (ticket as any)?.ticket_id ?? "";
    const asunto = (ticket as any)?.asunto ?? "";

    // Nombre del CSR que escala.
    const { data: me } = await admin
      .from("profiles").select("full_name").eq("user_id", ctx.userId).maybeSingle();
    const fromName = (me as any)?.full_name ?? "Un agente";

    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0, note: "Sin destinatarios con el rol requerido." }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 3) Crear notificaciones in-app + encolar email.
    const title = `Caso escalado: ${code || "sin código"}`;
    const body = `${fromName} escaló a ${target}. ${asunto ? `Asunto: ${asunto}. ` : ""}${motivo?.trim() ? `Motivo: ${motivo.trim()}` : "Sin detalle."}`;
    const rows = recipientIds.map((uid: string) => ({
      user_id: uid,
      kind: "escalation",
      title,
      body,
      link: null,
      payload: { ticket_id, ticket_code: code, target, from_user: ctx.userId, from_name: fromName, motivo: motivo ?? null },
      email_queued: true,
    }));
    const { error: insErr } = await admin.from("user_notifications").insert(rows);
    if (insErr) throw new Error(insErr.message);

    return new Response(JSON.stringify({ success: true, notified: recipientIds.length, target, roles }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (e instanceof AuthError) return new Response(JSON.stringify({ error: e.message }), { status: e.status ?? 401, headers: { ...cors, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ error: e?.message ?? `Error en ${FUNCTION_NAME}` }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
