/**
 * executive-ai-chat
 * Asistente conversacional sobre el portafolio (clientes, tickets, sprints, equipo).
 *
 * Input:
 *   {
 *     messages: [{ role: "user"|"assistant", content: string }],  // historial
 *     question: string,                                            // pregunta nueva
 *   }
 *
 * Output:
 *   { reply: string, usage: { ... } }
 *
 * Aplica el AI safety pack: assertNotCliente, rate limit, audit con user_id,
 * redacción confidencial sobre el snapshot de tickets.
 */

import { corsHeaders, corsPreflight, AiError, resolvedModel } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, requireAuth, requireRole } from "../_shared/auth.ts";
import {
  redactConfidentialTickets, logAiCall, checkRateLimit, assertNotCliente,
} from "../_shared/aiSafety.ts";

const MODEL = "gemini-2.5-flash";
const FUNCTION_NAME = "executive-ai-chat";
const MAX_HISTORY = 20;

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  let ctx: any = null;
  let redactedCount = 0;

  try {
    ctx = await requireAuth(req);
    await assertNotCliente(ctx);
    await requireRole(ctx, ["admin", "pm", "gerente", "colaborador"]);
    await checkRateLimit(ctx.adminClient, ctx.userId, FUNCTION_NAME, 60); // 60/h, conversacional

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const body = await req.json().catch(() => ({}));
    const question: string = (body.question || "").trim();
    const history: Array<{ role: string; content: string }> = Array.isArray(body.messages) ? body.messages : [];

    if (!question || question.length > 4000) {
      return new Response(JSON.stringify({ error: "question (≤4000 chars) requerido" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const db = ctx.adminClient;

    // ─── Snapshot del portafolio (data útil para responder) ──────────
    const [clientsR, ticketsR, sprintsR, deliverablesR] = await Promise.all([
      db.from("clients").select("id, name, status, country, client_type, contract_end, progress").eq("status", "activo"),
      db.from("support_tickets")
        .select("id, ticket_id, asunto, estado, prioridad, tipo, producto, responsable, descripcion, dias_antiguedad, client_id, is_confidential, ai_classification, ai_risk_level")
        .not("estado", "in", "(CERRADA,ANULADA)")
        .order("dias_antiguedad", { ascending: false })
        .limit(150),
      db.from("sprints").select("id, name, status, client_id, start_date, end_date, goal").eq("status", "activo"),
      db.from("deliverables").select("id, title, status, client_id, due_date").not("status", "in", "(aprobado,entregado)").limit(60),
    ]);

    const clients = clientsR.data || [];
    const { tickets, redactedCount: rc } = redactConfidentialTickets(ticketsR.data || []);
    redactedCount = rc;
    const sprints = sprintsR.data || [];
    const deliverables = deliverablesR.data || [];

    const clientNameById = new Map(clients.map((c: any) => [c.id, c.name]));

    // ─── Resumen compacto (para no inflar context) ───────────────────
    const ticketsSummary = tickets.slice(0, 50).map((t: any) =>
      `[${t.ticket_id}] ${t.asunto.slice(0, 80)} | ${clientNameById.get(t.client_id) || t.client_id} | ${t.prioridad || ""} | ${t.estado} | ${t.dias_antiguedad}d | resp:${t.responsable || "—"}`
    ).join("\n");

    const criticalCount = tickets.filter((t: any) => /critica/i.test(t.prioridad || "")).length;
    const inAttention = tickets.filter((t: any) => t.estado === "EN ATENCIÓN").length;
    const pending = tickets.filter((t: any) => t.estado === "PENDIENTE").length;
    const old30 = tickets.filter((t: any) => (t.dias_antiguedad || 0) > 30).length;

    const overdueDeliverables = deliverables.filter((d: any) =>
      d.due_date && new Date(d.due_date) < new Date()
    ).length;

    const systemPrompt = `Eres un asistente ejecutivo del ERP de SYSDE (consultora financiera LATAM).
Hablas en español, sos directo, accionable y conciso (máximo 6 párrafos cortos).
Cuando referenciás casos, usá el ticket_id entre corchetes [SPRME-123].
Cuando hablás de un cliente, usá su nombre real.
Si no tenés data suficiente para responder, decilo y sugerí qué consultar.

═══ SNAPSHOT DEL PORTAFOLIO ═══
Clientes activos: ${clients.length}
${clients.slice(0, 20).map((c: any) => `  · ${c.name} (${c.client_type}) — progreso ${c.progress ?? 0}%`).join("\n")}

Sprints activos: ${sprints.length}
${sprints.map((s: any) => `  · ${s.name} (${clientNameById.get(s.client_id) || s.client_id}) — ${s.start_date} → ${s.end_date}`).join("\n")}

Casos abiertos (top ${Math.min(50, tickets.length)} de ${tickets.length} totales):
  Críticos: ${criticalCount} · En atención: ${inAttention} · Pendientes: ${pending} · >30 días: ${old30}
${ticketsSummary}

Entregables pendientes: ${deliverables.length} (vencidos: ${overdueDeliverables})

⚠ NOTA DE PRIVACIDAD: ${redactedCount > 0 ? `${redactedCount} casos son confidenciales — sus campos sensibles fueron enmascarados. Cuando un usuario pregunte por uno, indicá que la descripción no está disponible y referenciá sólo por ticket_id + asunto.` : "Sin casos confidenciales en este snapshot."}
`;

    // ─── Llamado a Gemini (chat conversacional) ──────────────────────
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
      ...history.slice(-MAX_HISTORY).map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "").slice(0, 4000),
      })),
      { role: "user", content: question },
    ];

    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.4,
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      throw new AiError(`AI gateway HTTP ${aiRes.status}: ${text.slice(0, 200)}`, aiRes.status === 429 ? 429 : 500);
    }

    const aiData = await aiRes.json();
    const reply = aiData.choices?.[0]?.message?.content?.trim() ?? "(Sin respuesta)";
    const usage = aiData.usage || {};

    await logAiCall(db, {
      function_name: FUNCTION_NAME,
      model: resolvedModel(MODEL),
      user_id: ctx.userId,
      scope: "portfolio",
      redacted: redactedCount > 0,
      status: "success",
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
      metadata: {
        question_chars: question.length,
        history_messages: history.length,
        clients_in_context: clients.length,
        tickets_in_context: tickets.length,
        tickets_redacted: redactedCount,
      },
    });

    return new Response(JSON.stringify({ reply, usage }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    if (e instanceof AuthError) {
      if (ctx?.adminClient) {
        await logAiCall(ctx.adminClient, {
          function_name: FUNCTION_NAME, model: MODEL,
          user_id: ctx?.userId, redacted: redactedCount > 0,
          status: e.status === 429 ? "rate_limited" : "error", error_message: e.message,
        });
      }
      return authErrorResponse(e, cors);
    }
    if (e instanceof AiError) {
      if (ctx?.adminClient) {
        await logAiCall(ctx.adminClient, {
          function_name: FUNCTION_NAME, model: MODEL, user_id: ctx?.userId,
          redacted: redactedCount > 0, status: "error", error_message: e.message,
        });
      }
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    console.error("executive-ai-chat error:", e);
    if (ctx?.adminClient) {
      await logAiCall(ctx.adminClient, {
        function_name: FUNCTION_NAME, model: MODEL, user_id: ctx?.userId,
        redacted: redactedCount > 0, status: "error",
        error_message: String(e?.message ?? e).slice(0, 500),
      });
    }
    return new Response(JSON.stringify({ error: e?.message ?? "Error desconocido" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
