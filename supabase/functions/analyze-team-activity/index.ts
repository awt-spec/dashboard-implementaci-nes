// Analiza la actividad de un colaborador con Lovable AI y devuelve insights estructurados.
import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, canActOnUser, requireAuth } from "../_shared/auth.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface ActivityRow {
  action: string;
  entity_type: string | null;
  client_id: string | null;
  metadata: any;
  created_at: string;
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  try {
    const ctx = await requireAuth(req);

    const { user_id, user_name, role, days = 7 } = await req.json();
    if (!user_id) throw new Error("user_id requerido");

    if (!(await canActOnUser(ctx, user_id))) {
      return new Response(JSON.stringify({ error: "No autorizado a analizar la actividad de este usuario" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = ctx.adminClient;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [actsRes, clientsRes, sessionsRes] = await Promise.all([
      sb.from("user_activity_log" as any).select("action, entity_type, client_id, metadata, created_at")
        .eq("user_id", user_id).gte("created_at", since).order("created_at", { ascending: true }).limit(800),
      sb.from("clients").select("id, name"),
      sb.from("user_sessions" as any).select("started_at, last_heartbeat, ended_at")
        .eq("user_id", user_id).gte("started_at", since).order("started_at", { ascending: true }).limit(100),
    ]);

    const acts = (actsRes.data as ActivityRow[]) || [];
    const clientMap = new Map<string, string>();
    ((clientsRes.data as any[]) || []).forEach((c) => clientMap.set(c.id, c.name));
    const sessions = (sessionsRes.data as any[]) || [];

    if (acts.length === 0 && sessions.length === 0) {
      return new Response(
        JSON.stringify({
          summary: "Sin datos suficientes para análisis. El colaborador no registra actividad en el período seleccionado.",
          patterns: [],
          recommendations: ["Verificar si el colaborador tiene tareas asignadas", "Revisar si el sistema de tracking está activo en su sesión"],
          productivity_score: 0,
          working_hours: null,
          top_actions: [],
        }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Agregaciones
    const actionCounts: Record<string, number> = {};
    const clientCounts: Record<string, number> = {};
    const hourlyDistribution: number[] = new Array(24).fill(0);
    const dailyActivity: Record<string, number> = {};
    let firstActivity: string | null = null;
    let lastActivity: string | null = null;

    acts.forEach((a) => {
      actionCounts[a.action] = (actionCounts[a.action] || 0) + 1;
      if (a.client_id) {
        const name = clientMap.get(a.client_id) || a.client_id;
        clientCounts[name] = (clientCounts[name] || 0) + 1;
      }
      const d = new Date(a.created_at);
      hourlyDistribution[d.getHours()]++;
      const day = d.toISOString().split("T")[0];
      dailyActivity[day] = (dailyActivity[day] || 0) + 1;
      if (!firstActivity) firstActivity = a.created_at;
      lastActivity = a.created_at;
    });

    // Horario inferido: percentiles 10 y 90 sobre las horas con actividad
    const activeHours: number[] = [];
    hourlyDistribution.forEach((count, hour) => {
      for (let i = 0; i < count; i++) activeHours.push(hour);
    });
    activeHours.sort((a, b) => a - b);
    const p10Hour = activeHours[Math.floor(activeHours.length * 0.1)] ?? 9;
    const p90Hour = activeHours[Math.floor(activeHours.length * 0.9)] ?? 18;

    // Total session minutes
    let totalSessionMinutes = 0;
    sessions.forEach((s) => {
      const start = new Date(s.started_at).getTime();
      const end = new Date(s.ended_at || s.last_heartbeat || s.started_at).getTime();
      totalSessionMinutes += Math.max(0, Math.round((end - start) / 60000));
    });

    const topActions = Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([action, count]) => ({ action, count }));

    const topClients = Object.entries(clientCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([client, count]) => ({ client, count }));

    // Prompt para IA
    const prompt = `Analiza la actividad reciente de este colaborador de SYSDE y devuelve insights accionables en español.

COLABORADOR: ${user_name || "—"} (rol: ${role || "—"})
PERÍODO: últimos ${days} días
TOTAL EVENTOS: ${acts.length}
DÍAS CON ACTIVIDAD: ${Object.keys(dailyActivity).length}
HORAS DE TRABAJO ESTIMADAS (sesiones): ${Math.round(totalSessionMinutes / 60)}h
HORARIO INFERIDO: ${p10Hour}:00 - ${p90Hour}:00
PRIMERA ACTIVIDAD: ${firstActivity}
ÚLTIMA ACTIVIDAD: ${lastActivity}

DISTRIBUCIÓN POR HORA (0-23):
${hourlyDistribution.map((c, h) => `${h}h: ${c}`).join(", ")}

ACCIONES MÁS FRECUENTES:
${topActions.map((a) => `- ${a.action}: ${a.count} veces`).join("\n")}

CLIENTES EN LOS QUE TRABAJÓ:
${topClients.map((c) => `- ${c.client}: ${c.count} interacciones`).join("\n")}

ACTIVIDAD POR DÍA:
${Object.entries(dailyActivity).slice(-7).map(([d, c]) => `${d}: ${c} eventos`).join("\n")}

Devuelve un análisis con:
1. summary: 2-3 frases resumiendo qué hizo y patrón general
2. patterns: 3-5 patrones observados (horario, focos de trabajo, picos de productividad)
3. recommendations: 2-4 recomendaciones accionables para el manager
4. productivity_score: número 0-100
5. focus_assessment: evaluación de concentración (alto/medio/bajo) y por qué
6. risk_flags: alertas si las hay (inactividad, sobrecarga, fragmentación)`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Eres un analista de productividad senior. Devuelves SIEMPRE en JSON válido siguiendo el schema requerido." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "report_activity_analysis",
            description: "Reporta análisis de productividad",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string" },
                patterns: { type: "array", items: { type: "string" } },
                recommendations: { type: "array", items: { type: "string" } },
                productivity_score: { type: "number" },
                focus_assessment: {
                  type: "object",
                  properties: { level: { type: "string", enum: ["alto", "medio", "bajo"] }, reason: { type: "string" } },
                  required: ["level", "reason"],
                },
                risk_flags: { type: "array", items: { type: "string" } },
              },
              required: ["summary", "patterns", "recommendations", "productivity_score", "focus_assessment", "risk_flags"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_activity_analysis" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de uso de IA excedido. Intenta en unos minutos." }), {
          status: 429, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Sin créditos de IA. Recarga en Settings > Workspace > Usage." }), {
          status: 402, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResp.status} ${await aiResp.text()}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    const aiResult = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    // Log
    await sb.from("ai_usage_logs").insert({
      function_name: "analyze-team-activity",
      model: "google/gemini-2.5-flash",
      prompt_tokens: aiData?.usage?.prompt_tokens || 0,
      completion_tokens: aiData?.usage?.completion_tokens || 0,
      total_tokens: aiData?.usage?.total_tokens || 0,
      metadata: { user_id, user_name, days },
      status: "success",
    });

    return new Response(JSON.stringify({
      ...aiResult,
      working_hours: { start: `${String(p10Hour).padStart(2, "0")}:00`, end: `${String(p90Hour).padStart(2, "0")}:00` },
      total_events: acts.length,
      total_session_hours: Math.round(totalSessionMinutes / 60 * 10) / 10,
      active_days: Object.keys(dailyActivity).length,
      hourly_distribution: hourlyDistribution,
      top_actions: topActions,
      top_clients: topClients,
      daily_activity: dailyActivity,
    }), { headers: { ...cors, "Content-Type": "application/json" } });

  } catch (e: any) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error("analyze-team-activity error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
