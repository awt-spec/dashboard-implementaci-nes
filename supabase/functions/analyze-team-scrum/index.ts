import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, requireAuth, requireRole } from "../_shared/auth.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  const startedAt = Date.now();

  try {
    const ctx = await requireAuth(req);
    await requireRole(ctx, ["admin", "pm", "gerente"]);
    const sb = ctx.adminClient;

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY no configurado" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { items, sprints } = await req.json();

    // Compress payload to keep prompt small
    const compactItems = (items || []).slice(0, 200).map((i: any) => ({
      id: i.id,
      src: i.source,
      title: (i.title || "").slice(0, 100),
      owner: i.owner,
      status: i.status,
      priority: i.priority,
      sp: i.story_points,
      val: i.business_value,
      eff: i.effort,
      wsjf: i.wsjf,
      sprint: i.sprint_id ? "yes" : "no",
      scrum_status: i.scrum_status,
    }));

    const activeSprints = (sprints || []).filter((s: any) => s.status === "activo");

    // Pre-compute load per owner to feed AI
    const loadByOwner: Record<string, { total: number; in_progress: number; high_priority: number; unestimated: number; story_points: number }> = {};
    compactItems.forEach((i: any) => {
      const owner = (i.owner || "").trim();
      if (!owner || owner === "—") return;
      if (i.scrum_status === "done") return;
      const r = loadByOwner[owner] ||= { total: 0, in_progress: 0, high_priority: 0, unestimated: 0, story_points: 0 };
      r.total++;
      if (i.scrum_status === "in_progress") r.in_progress++;
      if (i.priority === "alta" || i.priority === "high" || i.priority === "critica") r.high_priority++;
      if (!i.sp && !i.eff) r.unestimated++;
      r.story_points += i.sp || 0;
    });
    const loadSummary = Object.entries(loadByOwner).map(([owner, l]) => ({ owner, ...l }));

    const systemPrompt = `Eres un Scrum Master experto. Analizas la carga del equipo y detectas riesgos y desbalances.
Responde SIEMPRE invocando la función analyze_team con los hallazgos.

Reglas:
- workload: clasifica a CADA persona como "sobrecargado" (>7 items o >3 high_priority), "saludable" (3-7 items), "subutilizado" (1-2 items o 0 in_progress) o "sin_carga" (0 items activos). Incluye a TODOS los owners listados.
- bottlenecks: SOLO sobrecargados con severity high/medium
- underutilized: personas con poca o ninguna carga (oportunidad de rebalanceo)
- risks: items en sprint activo sin estimación o con alta prioridad mal priorizados
- recommendations: 3-5 acciones concretas de rebalanceo (mencionar nombres concretos: "Reasignar X items de Juan a María")
- sprint_health: "saludable", "en_riesgo" o "critico"
- team_balance_score: 0-100 (100=perfectamente balanceado, 0=muy desbalanceado)`;

    const userPrompt = `Analiza el siguiente equipo Scrum.

Sprints activos: ${activeSprints.length}
Items totales: ${compactItems.length}
Personas con asignaciones: ${loadSummary.length}

CARGA POR PERSONA (precalculada):
${JSON.stringify(loadSummary, null, 1)}

Items (sample):
${JSON.stringify(compactItems.slice(0, 100), null, 1)}

Sprints activos:
${JSON.stringify(activeSprints, null, 1)}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_team",
            description: "Reporta análisis del equipo Scrum",
            parameters: {
              type: "object",
              properties: {
                workload: {
                  type: "array",
                  description: "Carga clasificada por persona",
                  items: {
                    type: "object",
                    properties: {
                      owner: { type: "string" },
                      level: { type: "string", enum: ["sobrecargado", "saludable", "subutilizado", "sin_carga"] },
                      items: { type: "number" },
                      story_points: { type: "number" },
                      reason: { type: "string" },
                    },
                    required: ["owner", "level", "items", "reason"],
                  },
                },
                bottlenecks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      owner: { type: "string" },
                      severity: { type: "string", enum: ["low", "medium", "high"] },
                      reason: { type: "string" },
                      load: { type: "number" },
                    },
                    required: ["owner", "severity", "reason", "load"],
                  },
                },
                underutilized: {
                  type: "array",
                  description: "Personas con poca o ninguna carga",
                  items: {
                    type: "object",
                    properties: {
                      owner: { type: "string" },
                      load: { type: "number" },
                      suggestion: { type: "string" },
                    },
                    required: ["owner", "load", "suggestion"],
                  },
                },
                risks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      item_id: { type: "string" },
                      reason: { type: "string" },
                      recommendation: { type: "string" },
                    },
                    required: ["item_id", "reason", "recommendation"],
                  },
                },
                recommendations: { type: "array", items: { type: "string" } },
                sprint_health: { type: "string", enum: ["saludable", "en_riesgo", "critico"] },
                team_balance_score: { type: "number", description: "0-100, 100=balanceado" },
              },
              required: ["workload", "bottlenecks", "underutilized", "risks", "recommendations", "sprint_health", "team_balance_score"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "analyze_team" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de IA alcanzado, intenta en unos minutos" }), {
          status: 429, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Sin créditos de IA. Recarga en Configuración." }), {
          status: 402, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      throw new Error(`AI error ${aiResponse.status}: ${t.slice(0, 200)}`);
    }

    const json = await aiResponse.json();
    const usage = json.usage || {};
    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");
    const result = JSON.parse(toolCall.function.arguments);

    // Augment with raw load summary for charts
    result.load_summary = loadSummary;

    // Log AI usage
    await sb.from("ai_usage_logs").insert({
      function_name: "analyze-team-scrum",
      model: "google/gemini-3-flash-preview",
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
      status: "success",
      metadata: { duration_ms: Date.now() - startedAt, items_analyzed: compactItems.length },
    });

    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error("analyze-team-scrum error:", e?.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
