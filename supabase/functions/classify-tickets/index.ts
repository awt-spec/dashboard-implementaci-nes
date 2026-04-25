import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, requireAuth, requireRole } from "../_shared/auth.ts";
import {
  redactConfidentialTickets, logAiCall, checkRateLimit, assertNotCliente,
} from "../_shared/aiSafety.ts";

const FUNCTION_NAME = "classify-tickets";

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  let ctx: any = null;
  let redactedCountTotal = 0;
  try {
    ctx = await requireAuth(req);
    await assertNotCliente(ctx);
    await requireRole(ctx, ["admin", "pm", "gerente"]);
    await checkRateLimit(ctx.adminClient, ctx.userId, FUNCTION_NAME, 20);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const { ticketIds } = await req.json();

    const supabase = ctx.adminClient;

    // Trae también is_confidential para que la redacción funcione
    let query = supabase.from("support_tickets").select("id, ticket_id, asunto, tipo, prioridad, estado, dias_antiguedad, producto, responsable, notas, client_id, is_confidential, descripcion");

    if (ticketIds && ticketIds.length > 0) {
      query = query.in("id", ticketIds);
    } else {
      query = query.is("ai_classification", null).limit(50);
    }

    const { data: ticketsRaw, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    if (!ticketsRaw || ticketsRaw.length === 0) {
      return new Response(JSON.stringify({ classified: 0, message: "No tickets to classify" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Redactar campos confidenciales antes de mandar al LLM
    const { tickets, redactedCount } = redactConfidentialTickets(ticketsRaw);
    redactedCountTotal = redactedCount;

    const ticketDescriptions = tickets.map((t: any) =>
      `ID:${t.ticket_id} | Asunto:${t.asunto} | Tipo:${t.tipo} | Prioridad:${t.prioridad} | Estado:${t.estado} | Días:${t.dias_antiguedad} | Producto:${t.producto} | Responsable:${t.responsable || 'N/A'} | Notas:${t.notas || 'N/A'}`
    ).join("\n");

    const model = "gemini-2.5-flash-lite";
    const startTime = Date.now();

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `Eres un analista de soporte técnico. Clasifica cada ticket en:
- classification: una categoría concisa (Bug, Mejora, Configuración, Capacitación, Consulta, Integración, Urgencia Operativa, Mantenimiento)
- risk_level: critical, high, medium, low (basado en prioridad + días de antigüedad + impacto)  
- summary: resumen ejecutivo de 1 línea del caso en español

Responde SOLO con JSON válido sin markdown.`
          },
          {
            role: "user",
            content: `Clasifica estos ${tickets.length} tickets:\n${ticketDescriptions}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "classify_tickets",
            description: "Classify support tickets",
            parameters: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      ticket_id: { type: "string" },
                      classification: { type: "string" },
                      risk_level: { type: "string", enum: ["critical", "high", "medium", "low"] },
                      summary: { type: "string" }
                    },
                    required: ["ticket_id", "classification", "risk_level", "summary"]
                  }
                }
              },
              required: ["results"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "classify_tickets" } },
      }),
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text();
      
      // Log failed AI call (con user_id + redacted)
      await logAiCall(supabase, {
        function_name: FUNCTION_NAME, model,
        user_id: ctx.userId,
        redacted: redactedCountTotal > 0,
        status: status === 429 ? "rate_limited" : "error",
        error_message: `HTTP ${status}: ${errorText.slice(0, 200)}`,
        metadata: { tickets_count: tickets.length, elapsed_ms: elapsed, tickets_redacted: redactedCountTotal },
      });

      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      console.error("AI error:", status, errorText);
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    // Extract token usage
    const usage = aiResult.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || (promptTokens + completionTokens);

    const parsed = JSON.parse(toolCall.function.arguments);
    const results = parsed.results || [];

    // Update tickets in DB
    let classified = 0;
    const clientIds = new Set<string>();
    for (const r of results) {
      const ticket = tickets.find((t: any) => t.ticket_id === r.ticket_id);
      if (!ticket) continue;
      if (ticket.client_id) clientIds.add(ticket.client_id);
      
      const { error: updateError } = await supabase
        .from("support_tickets")
        .update({
          ai_classification: r.classification,
          ai_risk_level: r.risk_level,
          ai_summary: r.summary,
        })
        .eq("id", ticket.id);
      
      if (!updateError) classified++;
    }

    // Log successful AI call (con user_id + redacted)
    await logAiCall(supabase, {
      function_name: FUNCTION_NAME, model,
      user_id: ctx.userId,
      client_id: clientIds.size === 1 ? [...clientIds][0] : null,
      redacted: redactedCountTotal > 0,
      status: "success",
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      metadata: { tickets_count: tickets.length, classified_count: classified, elapsed_ms: elapsed, tickets_redacted: redactedCountTotal },
    });

    return new Response(JSON.stringify({ classified, total: tickets.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    if (e instanceof AuthError) {
      if (ctx?.adminClient) {
        await logAiCall(ctx.adminClient, {
          function_name: FUNCTION_NAME, model: "gemini-2.5-flash-lite",
          user_id: ctx.userId, redacted: redactedCountTotal > 0,
          status: e.status === 429 ? "rate_limited" : "error", error_message: e.message,
        });
      }
      return authErrorResponse(e, cors);
    }
    console.error("classify-tickets error:", e);
    if (ctx?.adminClient) {
      await logAiCall(ctx.adminClient, {
        function_name: FUNCTION_NAME, model: "gemini-2.5-flash-lite",
        user_id: ctx.userId, redacted: redactedCountTotal > 0,
        status: "error", error_message: String(e?.message ?? e).slice(0, 500),
      });
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
