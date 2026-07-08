import { corsHeaders, corsPreflight, aiTool, AiError, resolvedModel } from "../_shared/cors.ts";
import { AuthError, requireAuth, requireRole } from "../_shared/auth.ts";
import { logAiCall, checkRateLimit, assertNotCliente } from "../_shared/aiSafety.ts";

// ─────────────────────────────────────────────────────────────────────────────
// csr-assistant — Asistente IA del agente de soporte (CSR).
// Recibe un resumen de la cola del agente (+ pregunta opcional) y devuelve un
// plan de jornada: resumen, priorización, casos urgentes y acciones sugeridas.
// One-shot (sin estado de chat). El front envía los tickets ya cargados.
// ─────────────────────────────────────────────────────────────────────────────

const MODEL = "gemini-2.5-flash-lite"; // el gateway lo normaliza a Claude
const FUNCTION_NAME = "csr-assistant";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);
  try {
    const ctx = await requireAuth(req);
    await assertNotCliente(ctx);
    await requireRole(ctx, ["admin", "pm", "gerente_soporte", "csr"]);
    await checkRateLimit(ctx.adminClient, ctx.userId, FUNCTION_NAME, 30);

    const { tickets, question } = await req.json().catch(() => ({}));
    const list = Array.isArray(tickets) ? tickets.slice(0, 60) : [];
    if (list.length === 0) {
      return new Response(JSON.stringify({ error: "No hay casos en la cola para analizar." }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Eres el copiloto de un agente de soporte (CSR) de SYSDE. A partir de su cola de casos, ayudás a priorizar y a planificar la jornada: qué atender primero, qué está en riesgo por antigüedad/prioridad, y acciones concretas. Sé breve, accionable y en español neutro. No inventes casos: usá solo los provistos.`;
    const userPrompt = `Cola de casos (JSON):\n${JSON.stringify(list, null, 2)}\n\n${question ? `Pregunta del agente: ${question}` : "Priorizá mi jornada y decime en qué enfocarme."}`;

    const { result, usage } = await aiTool<any>({
      model: MODEL,
      system: systemPrompt,
      userPrompt,
      maxTokens: 2048,
      timeoutMs: 40000,
      tool: {
        name: "plan_jornada",
        description: "Plan de trabajo priorizado para el agente de soporte.",
        input_schema: {
          type: "object",
          properties: {
            resumen: { type: "string", description: "2-3 frases sobre el estado de la cola y el foco del día." },
            prioridades: {
              type: "array",
              description: "Casos a atender primero, en orden.",
              items: {
                type: "object",
                properties: {
                  ticket_id: { type: "string" },
                  razon: { type: "string" },
                },
                required: ["ticket_id", "razon"],
              },
            },
            urgentes: { type: "array", description: "ticket_id de casos en riesgo (antigüedad/prioridad).", items: { type: "string" } },
            acciones: { type: "array", description: "Acciones concretas sugeridas para hoy.", items: { type: "string" } },
          },
          required: ["resumen", "prioridades", "acciones"],
        },
      },
    });

    await logAiCall(ctx.adminClient, {
      function_name: FUNCTION_NAME,
      model: resolvedModel(MODEL),
      user_id: ctx.userId,
      scope: "csr-queue",
      client_id: null,
      redacted: false,
      status: "success",
      prompt_tokens: usage.input_tokens,
      completion_tokens: usage.output_tokens,
      total_tokens: usage.total_tokens,
      metadata: { casos: list.length },
    });

    return new Response(JSON.stringify({ success: true, plan: result }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (e instanceof AuthError) return new Response(JSON.stringify({ error: e.message }), { status: e.status ?? 401, headers: { ...cors, "Content-Type": "application/json" } });
    if (e instanceof AiError) return new Response(JSON.stringify({ error: e.message }), { status: e.status ?? 500, headers: { ...cors, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ error: e?.message ?? "Error del asistente" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
