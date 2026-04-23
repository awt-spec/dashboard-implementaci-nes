// Descifra la descripción de un ticket confidencial.
// Solo accesible para roles admin/pm. Registra el acceso en ticket_access_log.
// Requiere el secret ENCRYPTION_KEY configurado en Supabase Edge Functions.

import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, requireAuth, requireRole } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  try {
    const ctx = await requireAuth(req);
    await requireRole(ctx, ["admin", "pm"]);

    const ENCRYPTION_KEY = Deno.env.get("ENCRYPTION_KEY");
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 16) {
      return new Response(
        JSON.stringify({
          error: "ENCRYPTION_KEY no configurado (mínimo 16 chars). Configurar en Supabase Dashboard → Edge Functions → Secrets.",
        }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const { ticket_id } = await req.json();
    if (!ticket_id) {
      return new Response(
        JSON.stringify({ error: "ticket_id requerido" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Leer ticket y verificar que sea confidencial + tenga payload cifrado
    const { data: ticket, error: readErr } = await ctx.adminClient
      .from("support_tickets")
      .select("id, ticket_id, client_id, is_confidential, descripcion_cifrada, asunto")
      .eq("id", ticket_id)
      .maybeSingle();

    if (readErr) throw readErr;
    if (!ticket) {
      return new Response(
        JSON.stringify({ error: "Ticket no encontrado" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
    if (!ticket.is_confidential) {
      return new Response(
        JSON.stringify({ error: "Este ticket no está marcado como confidencial" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
    if (!ticket.descripcion_cifrada) {
      return new Response(
        JSON.stringify({ error: "Ticket sin payload cifrado. Posiblemente fue creado antes de configurar ENCRYPTION_KEY." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Descifrar vía RPC (usa la función decrypt_sensitive definida en la migración)
    const { data: decrypted, error: decryptErr } = await ctx.adminClient.rpc(
      "decrypt_sensitive" as any,
      { ciphertext: ticket.descripcion_cifrada, key: ENCRYPTION_KEY },
    );

    if (decryptErr) throw decryptErr;

    // Registrar el acceso en ticket_access_log
    await ctx.adminClient.from("ticket_access_log" as any).insert({
      ticket_id: ticket.id,
      user_id: ctx.userId,
      action: "decrypt",
      metadata: {
        ticket_id_legible: ticket.ticket_id,
        client_id: ticket.client_id,
        asunto: ticket.asunto,
      },
    });

    return new Response(
      JSON.stringify({
        ticket_id: ticket.id,
        ticket_id_legible: ticket.ticket_id,
        descripcion: decrypted,
        decrypted_at: new Date().toISOString(),
        decrypted_by: ctx.userId,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error("decrypt-ticket error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Error al descifrar" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
