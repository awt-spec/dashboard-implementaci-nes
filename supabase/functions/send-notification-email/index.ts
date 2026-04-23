import { corsHeaders, corsPreflight } from "../_shared/cors.ts";

/**
 * send-notification-email
 * Procesa notificaciones en user_notifications con email_queued=true y manda
 * email via Resend. Marca email_sent_at al terminar.
 *
 * Invocación:
 *   - Manual / cron: POST sin body → procesa hasta 50 pendientes
 *   - Puntual:       POST con { notification_id } → procesa solo esa
 *
 * Requiere:
 *   RESEND_API_KEY  — generala en https://resend.com/api-keys
 *   EMAIL_FROM      — ej. "SYSDE Soporte <no-reply@tu-dominio.com>"
 *                     (Resend requiere dominio verificado; para pruebas
 *                      Resend provee "onboarding@resend.dev" con límites)
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "SYSDE Notificaciones <onboarding@resend.dev>";

  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY no configurada. Set via `supabase secrets set RESEND_API_KEY=re_xxx`." }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.json().catch(() => ({})) as { notification_id?: string };

    // Query notificaciones pendientes
    const url = body.notification_id
      ? `${SUPABASE_URL}/rest/v1/user_notifications?id=eq.${body.notification_id}&select=*`
      : `${SUPABASE_URL}/rest/v1/user_notifications?email_queued=eq.true&email_sent_at=is.null&select=*&limit=50&order=created_at.asc`;

    const notifsResp = await fetch(url, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
    if (!notifsResp.ok) throw new Error(`fetch notifs: ${notifsResp.status}`);
    const notifs = await notifsResp.json() as Array<any>;
    if (notifs.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "no pending notifications" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let sent = 0, failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const n of notifs) {
      try {
        // Lookup email via helper
        const emailResp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_email`, {
          method: "POST",
          headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ _user_id: n.user_id }),
        });
        const email = (await emailResp.json()) as string | null;
        if (!email) {
          errors.push({ id: n.id, error: "user sin email" });
          failed++;
          continue;
        }

        const html = renderEmail(n);

        const resendResp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: [email],
            subject: n.title,
            html,
          }),
        });

        if (!resendResp.ok) {
          const t = await resendResp.text();
          errors.push({ id: n.id, error: `Resend ${resendResp.status}: ${t.slice(0, 150)}` });
          failed++;
          continue;
        }

        // Marcar como enviado
        await fetch(`${SUPABASE_URL}/rest/v1/user_notifications?id=eq.${n.id}`, {
          method: "PATCH",
          headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ email_sent_at: new Date().toISOString() }),
        });
        sent++;
      } catch (e: any) {
        errors.push({ id: n.id, error: e?.message ?? String(e) });
        failed++;
      }
    }

    return new Response(JSON.stringify({ processed: notifs.length, sent, failed, errors }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-notification-email error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

// ─── Plantilla simple de email ──────────────────────────────────────

function renderEmail(n: any): string {
  const link = n.link
    ? `https://app.sysde.com${n.link}` // ajustar dominio cuando se hostee
    : "";
  const linkHtml = link
    ? `<p style="margin:18px 0;"><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#7c3aed;color:white;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Abrir en la plataforma →</a></p>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f4f4f5;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:28px;box-shadow:0 2px 4px rgba(0,0,0,0.05);">
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;margin-bottom:8px;">
      SYSDE Soporte
    </div>
    <h1 style="font-size:20px;color:#111827;margin:0 0 12px;font-weight:700;">
      ${escapeHtml(n.title)}
    </h1>
    ${n.body ? `<p style="color:#374151;font-size:14px;line-height:1.5;margin:0 0 4px;">${escapeHtml(n.body)}</p>` : ""}
    ${linkHtml}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
    <p style="color:#9ca3af;font-size:11px;margin:0;">
      Recibís este correo porque sos usuario de la plataforma SYSDE ERP.<br/>
      Para dejar de recibir notificaciones, cambialo desde Configuración.
    </p>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
