// Notificación automática para tickets que cruzaron 3+ reincidencias.
//
// Patrón QA crítico identificado por María Fernanda Angulo (COO):
//   "Es una reincidencia o cantidad de iteraciones que ha tenido. Como no
//    tenemos un QA en soporte, te podrás imaginar la cantidad de veces que
//    me devuelven cosas (...). Tengo que ir a ver quién hizo mal la tarea."
//
// Trigger:
//   - Llamado desde el front DESPUÉS de un reopen (al detectar que
//     reopen_count cruzó de <3 a >=3 en la misma operación), O
//   - Llamado desde un webhook de DB (pg_net o supabase_functions.http_request)
//
// Acciones:
//   1. INSERT en client_notifications para usuarios con rol gerente_soporte y pm
//   2. (Opcional) Slack a SLACK_WEBHOOK_URL si está configurado
//   3. Audit log
//
// Body: { ticket_id: UUID, threshold?: number (default 3) }

import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, requireAuth } from "../_shared/auth.ts";

interface RequestBody {
  ticket_id: string;
  threshold?: number;
}

async function sendSlack(webhook: string, payload: {
  ticket_id: string;
  cliente: string;
  asunto: string;
  reopen_count: number;
  reason: string;
  responsable: string;
  url: string;
}) {
  const { ticket_id, cliente, asunto, reopen_count, reason, responsable, url } = payload;
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `🔁 ${reopen_count}× REINCIDENCIA — Patrón QA` },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Cliente:*\n${cliente}` },
        { type: "mrkdwn", text: `*Ticket:*\n\`${ticket_id}\`` },
        { type: "mrkdwn", text: `*Responsable:*\n${responsable}` },
        { type: "mrkdwn", text: `*Vueltas:*\n${reopen_count}` },
      ],
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Asunto:* ${asunto}\n*Último motivo:* ${reason}` },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Ver caso en ERP" },
          url,
          style: "danger",
        },
      ],
    },
  ];

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });
  if (!res.ok) throw new Error(`Slack ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  const pf = corsPreflight(req); if (pf) return pf;

  try {
    const ctx = await requireAuth(req);
    const body = await req.json() as RequestBody;

    const ticketId = body.ticket_id;
    const threshold = body.threshold ?? 3;

    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: "ticket_id requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Cargar ticket + cliente + última reincidencia
    const { data: ticket, error: tErr } = await ctx.adminClient
      .from("support_tickets")
      .select("id,ticket_id,client_id,asunto,responsable,reopen_count,last_reopen_reason")
      .eq("id", ticketId)
      .maybeSingle();
    if (tErr || !ticket) {
      return new Response(
        JSON.stringify({ error: "Ticket no encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const reopenCount = (ticket as any).reopen_count ?? 0;
    if (reopenCount < threshold) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `reopen_count=${reopenCount} < threshold=${threshold}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Cargar nombre del cliente
    const { data: client } = await ctx.adminClient
      .from("clients")
      .select("name,nivel_servicio")
      .eq("id", (ticket as any).client_id)
      .maybeSingle();
    const clienteName = (client as any)?.name || (ticket as any).client_id;

    const erpUrl = `${Deno.env.get("ERP_BASE_URL") || "https://erp.sysde.com"}/soporte?ticket=${ticket.id}`;

    // 2. Notificación interna por client_id (visible en NotificationBell)
    //    El RLS de client_notifications scopea por user; insertamos una
    //    fila por client_id que los roles internos (gerente_soporte, pm,
    //    admin) pueden leer.
    const channels = { notification: false, slack: false };
    const errors: string[] = [];

    try {
      await ctx.adminClient.from("client_notifications" as any).insert({
        client_id: (ticket as any).client_id,
        type: "warning",
        title: `🔁 ${(ticket as any).ticket_id}: ${reopenCount}ª reincidencia`,
        message: `${clienteName} · ${(ticket as any).asunto.slice(0, 80)}\n` +
                 `Responsable: ${(ticket as any).responsable || "(sin asignar)"}\n` +
                 `Último motivo: ${(ticket as any).last_reopen_reason || "(no registrado)"}`,
      });
      channels.notification = true;
    } catch (e: any) {
      errors.push(`notification: ${e.message}`);
    }

    // 3. Slack opcional
    const slackWebhook = Deno.env.get("SLACK_WEBHOOK_URL");
    if (slackWebhook) {
      try {
        await sendSlack(slackWebhook, {
          ticket_id: (ticket as any).ticket_id,
          cliente: clienteName,
          asunto: (ticket as any).asunto,
          reopen_count: reopenCount,
          reason: (ticket as any).last_reopen_reason || "(no registrado)",
          responsable: (ticket as any).responsable || "(sin asignar)",
          url: erpUrl,
        });
        channels.slack = true;
      } catch (e: any) {
        errors.push(`slack: ${e.message}`);
      }
    }

    // 4. Audit
    try {
      await ctx.adminClient.from("ticket_access_log" as any).insert({
        ticket_id: ticket.id,
        user_id: ctx.userId,
        action: "update",
        metadata: {
          kind: "recurring_reopen_notification",
          reopen_count: reopenCount,
          threshold,
          channels,
          errors: errors.length ? errors : undefined,
        },
      });
    } catch { /* best-effort */ }

    return new Response(
      JSON.stringify({ ok: true, reopen_count: reopenCount, channels, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error("notify-recurring-reopens error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Error interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
