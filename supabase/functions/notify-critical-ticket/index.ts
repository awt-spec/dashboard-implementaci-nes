// Notificación automática para tickets CRÍTICOS.
// Se invoca desde el frontend al crear un ticket con prioridad "Critica, Impacto Negocio".
//
// Envía:
//  1. Webhook Slack si SLACK_WEBHOOK_URL está configurado
//  2. Email via Resend API si RESEND_API_KEY está configurado
//  3. Una notificación "critical" en client_notifications (siempre)
//  4. Un registro en ticket_access_log (siempre)
//
// Todos los canales externos son best-effort — si fallan, no rompe el flujo.

import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, requireAuth } from "../_shared/auth.ts";

// ─── Helpers de mensajería ────────────────────────────────────────────────

async function sendSlackWebhook(webhook: string, payload: {
  ticket_id: string;
  cliente: string;
  asunto: string;
  tipo: string;
  url: string;
  fuente: string;
}) {
  const { ticket_id, cliente, asunto, tipo, url, fuente } = payload;
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "🚨 TICKET CRÍTICO — Impacto de Negocio" },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Cliente:*\n${cliente}` },
        { type: "mrkdwn", text: `*Ticket:*\n\`${ticket_id}\`` },
        { type: "mrkdwn", text: `*Tipo:*\n${tipo}` },
        { type: "mrkdwn", text: `*Origen:*\n${fuente === "cliente" ? "Portal cliente" : "Equipo SVA"}` },
      ],
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Asunto:*\n${asunto}` },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Ver en ERP" },
          url,
          style: "primary",
        },
      ],
    },
  ];

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `🚨 Ticket crítico ${ticket_id} — ${cliente}: ${asunto}`,
      blocks,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Slack HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
}

async function sendResendEmail(apiKey: string, payload: {
  to: string[];
  ticket_id: string;
  cliente: string;
  asunto: string;
  tipo: string;
  url: string;
  descripcion: string;
}) {
  const { to, ticket_id, cliente, asunto, tipo, url, descripcion } = payload;
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 560px;">
      <div style="background: #b91c1c; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">🚨 Ticket Crítico — Impacto de Negocio</h2>
      </div>
      <div style="border: 1px solid #e5e5e5; border-top: 0; padding: 20px; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; font-size: 14px; line-height: 1.6;">
          <tr><td style="color: #666; width: 30%;">Ticket:</td><td><strong>${ticket_id}</strong></td></tr>
          <tr><td style="color: #666;">Cliente:</td><td><strong>${cliente}</strong></td></tr>
          <tr><td style="color: #666;">Tipo:</td><td>${tipo}</td></tr>
          <tr><td style="color: #666;">Asunto:</td><td>${asunto}</td></tr>
        </table>
        <div style="margin-top: 16px; padding: 12px; background: #f9fafb; border-left: 3px solid #b91c1c; font-size: 13px;">
          ${descripcion.replace(/\n/g, "<br>")}
        </div>
        <div style="margin-top: 20px; text-align: center;">
          <a href="${url}" style="background: #b91c1c; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Ver ticket en ERP</a>
        </div>
      </div>
    </div>
  `.trim();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "SVA SYSDE <sva@sysde.com>",
      to,
      subject: `🚨 [${ticket_id}] ${cliente} — ${asunto}`.slice(0, 150),
      html,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  try {
    const ctx = await requireAuth(req);

    const { ticket_id } = await req.json();
    if (!ticket_id) {
      return new Response(JSON.stringify({ error: "ticket_id requerido" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Leer ticket + cliente
    const { data: ticket, error: tErr } = await ctx.adminClient
      .from("support_tickets")
      .select("id, ticket_id, client_id, asunto, tipo, prioridad, fuente, descripcion, is_confidential")
      .eq("id", ticket_id)
      .maybeSingle();

    if (tErr) throw tErr;
    if (!ticket) {
      return new Response(JSON.stringify({ error: "Ticket no encontrado" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: client } = await ctx.adminClient
      .from("clients")
      .select("id, name, nivel_servicio")
      .eq("id", ticket.client_id)
      .maybeSingle();

    const clienteName = client?.name || ticket.client_id;
    const erpUrl = `${Deno.env.get("ERP_BASE_URL") || "https://erp.sysde.com"}/soporte?ticket=${ticket.id}`;

    const channels = { slack: false, email: false, notification: false };
    const errors: string[] = [];

    // 1. Notificación interna en client_notifications (siempre)
    try {
      await ctx.adminClient.from("client_notifications" as any).insert({
        client_id: ticket.client_id,
        type: "error",
        title: `🚨 CRÍTICO ${ticket.ticket_id}: ${ticket.asunto.slice(0, 60)}`,
        message: `Cliente ${clienteName} (${client?.nivel_servicio || "Base"}) · ${ticket.tipo} · ${
          ticket.fuente === "cliente" ? "Creado desde portal cliente" : "Creado por equipo SVA"
        }`,
      });
      channels.notification = true;
    } catch (e: any) {
      errors.push(`notification: ${e.message}`);
    }

    // 2. Slack (opcional)
    const slackWebhook = Deno.env.get("SLACK_WEBHOOK_URL");
    if (slackWebhook) {
      try {
        await sendSlackWebhook(slackWebhook, {
          ticket_id: ticket.ticket_id,
          cliente: clienteName,
          asunto: ticket.asunto,
          tipo: ticket.tipo,
          url: erpUrl,
          fuente: ticket.fuente || "interno",
        });
        channels.slack = true;
      } catch (e: any) {
        errors.push(`slack: ${e.message}`);
      }
    }

    // 3. Email via Resend (opcional)
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const oncallEmails = (Deno.env.get("ONCALL_EMAILS") || "")
      .split(",").map(s => s.trim()).filter(Boolean);
    if (resendKey && oncallEmails.length > 0) {
      try {
        await sendResendEmail(resendKey, {
          to: oncallEmails,
          ticket_id: ticket.ticket_id,
          cliente: clienteName,
          asunto: ticket.asunto,
          tipo: ticket.tipo,
          url: erpUrl,
          descripcion: ticket.is_confidential
            ? "[Contenido confidencial — solo accesible via ERP autorizado]"
            : (ticket.descripcion || "(sin descripción)").slice(0, 500),
        });
        channels.email = true;
      } catch (e: any) {
        errors.push(`email: ${e.message}`);
      }
    }

    // 4. Audit log
    try {
      await ctx.adminClient.from("ticket_access_log" as any).insert({
        ticket_id: ticket.id,
        user_id: ctx.userId,
        action: "update",
        metadata: {
          kind: "critical_notification",
          channels,
          errors: errors.length ? errors : undefined,
          oncall_count: oncallEmails.length,
        },
      });
    } catch { /* best-effort */ }

    return new Response(JSON.stringify({
      ok: true,
      ticket_id: ticket.ticket_id,
      channels,
      errors: errors.length ? errors : undefined,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error("notify-critical-ticket error:", e);
    return new Response(JSON.stringify({ error: e.message || "Error interno" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
