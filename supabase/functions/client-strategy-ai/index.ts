import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, requireAuth, requireRole } from "../_shared/auth.ts";
import { isTicketClosed } from "../_shared/ticketStatus.ts";

/**
 * client-strategy-ai
 * Genera una estrategia IA para UN cliente completo.
 * Input:  { client_id: string }
 * Output: { success, analysis, id }
 *
 * Persiste en pm_ai_analysis con analysis_type='client_strategy'
 * y scope=<client_id>.
 */

const MODEL = "google/gemini-2.5-pro";
const FUNCTION_NAME = "client-strategy-ai";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  try {
    const ctx = await requireAuth(req);
    await requireRole(ctx, ["admin", "pm", "gerente"]);

    const { client_id } = await req.json().catch(() => ({}));
    if (!client_id || typeof client_id !== "string") {
      return new Response(JSON.stringify({ error: "client_id requerido" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY no configurada");

    const db = ctx.adminClient;

    // ─── 1. Cliente ──────────────────────────────────────────────────────
    const { data: client, error: clientErr } = await db
      .from("clients")
      .select("*")
      .eq("id", client_id)
      .single();
    if (clientErr || !client) {
      return new Response(JSON.stringify({ error: "Cliente no encontrado" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ─── 2. Contratos + SLAs + financials ────────────────────────────────
    const [contractsR, slasR, financialsR] = await Promise.all([
      db.from("client_contracts").select("*").eq("client_id", client_id).eq("is_active", true),
      db.from("client_slas").select("*").eq("client_id", client_id).eq("is_active", true),
      db.from("client_financials").select("*").eq("client_id", client_id).maybeSingle(),
    ]);
    const contracts = contractsR.data ?? [];
    const slas = slasR.data ?? [];
    const financials = financialsR.data ?? null;

    // ─── 3. Todos los tickets del cliente (histórico completo) ───────────
    const { data: tickets = [] } = await db
      .from("support_tickets")
      .select("id, ticket_id, asunto, estado, prioridad, tipo, producto, responsable, descripcion, created_at, fecha_entrega, dias_antiguedad, effort, business_value, is_confidential, ai_classification, ai_risk_level")
      .eq("client_id", client_id)
      .order("created_at", { ascending: false });

    // ─── 4. Notas "externas" recientes (indicadores de tono cliente) ─────
    const ticketIds = (tickets || []).map((t: any) => t.id);
    let recentNotes: any[] = [];
    if (ticketIds.length > 0) {
      const { data: notesData } = await db
        .from("support_ticket_notes")
        .select("ticket_id, author_name, visibility, content, created_at")
        .in("ticket_id", ticketIds.slice(0, 50))  // cap para no blow up el context
        .eq("visibility", "externa")
        .order("created_at", { ascending: false })
        .limit(30);
      recentNotes = notesData ?? [];
    }

    // ─── 5. Agreements con el cliente ────────────────────────────────────
    const { data: agreements = [] } = await db
      .from("client_agreements" as any)
      .select("*")
      .eq("client_id", client_id)
      .order("created_at", { ascending: false })
      .limit(30);

    // ─── 6. Métricas derivadas ──────────────────────────────────────────
    const total = tickets.length;
    const open = tickets.filter((t: any) => !isTicketClosed(t.estado));
    const closed = tickets.filter((t: any) => isTicketClosed(t.estado));
    const critical = tickets.filter((t: any) => /critica/i.test(t.prioridad || ""));
    const openCritical = open.filter((t: any) => /critica/i.test(t.prioridad || ""));
    const avgAge = open.length ? Math.round(open.reduce((s: number, t: any) => s + (t.dias_antiguedad || 0), 0) / open.length) : 0;
    const oldOpen = open.filter((t: any) => (t.dias_antiguedad || 0) > 30).length;

    // Distribución por producto / tipo (top dolores)
    const byProduct: Record<string, number> = {};
    const byTipo: Record<string, number> = {};
    const byAiCategory: Record<string, number> = {};
    for (const t of tickets) {
      if (t.producto) byProduct[t.producto] = (byProduct[t.producto] || 0) + 1;
      if (t.tipo) byTipo[t.tipo] = (byTipo[t.tipo] || 0) + 1;
      if (t.ai_classification) byAiCategory[t.ai_classification] = (byAiCategory[t.ai_classification] || 0) + 1;
    }

    // Tendencia mensual (últimos 6 meses) — velocidad de creación / cierre
    const now = new Date();
    const monthly: Array<{ month: string; created: number; closed: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthCreated = tickets.filter((t: any) => {
        const ca = new Date(t.created_at);
        return ca >= d && ca < nextD;
      }).length;
      const monthClosed = tickets.filter((t: any) => {
        if (!t.fecha_entrega) return false;
        const fc = new Date(t.fecha_entrega);
        return fc >= d && fc < nextD;
      }).length;
      monthly.push({ month: key, created: monthCreated, closed: monthClosed });
    }

    // ─── 7. Contexto compacto para el LLM ───────────────────────────────
    const contract = contracts[0] ?? null;
    const mainSla = slas.find((s: any) => /critica/i.test(s.priority_level || "")) ?? slas[0] ?? null;

    const context = {
      client: {
        id: client.id,
        name: client.name,
        type: client.client_type,
        status: client.status,
        progress: client.progress,
      },
      contract: contract ? {
        type: contract.contract_type,
        monthly_value: contract.monthly_value,
        hourly_rate: contract.hourly_rate,
        currency: contract.currency,
        included_hours: contract.included_hours,
        start_date: contract.start_date,
        end_date: contract.end_date,
        auto_renewal: contract.auto_renewal,
      } : null,
      financials: financials ? {
        contract_value: financials.contract_value,
        billed: financials.billed,
        paid: financials.paid,
        pending: financials.pending,
        hours_estimated: financials.hours_estimated,
        hours_used: financials.hours_used,
      } : null,
      slas: slas.map((s: any) => ({
        priority_level: s.priority_level,
        case_type: s.case_type,
        response_time_hours: s.response_time_hours,
        resolution_time_hours: s.resolution_time_hours,
        penalty_amount: s.penalty_amount,
      })),
      main_sla: mainSla,
      ticket_metrics: {
        total,
        open: open.length,
        closed: closed.length,
        critical_total: critical.length,
        critical_open: openCritical.length,
        avg_age_open_days: avgAge,
        old_open_over_30d: oldOpen,
        by_product: byProduct,
        by_tipo: byTipo,
        by_ai_category: byAiCategory,
      },
      monthly_trend: monthly,
      open_cases_sample: open.slice(0, 20).map((t: any) => ({
        id: t.ticket_id,
        asunto: t.asunto,
        estado: t.estado,
        prioridad: t.prioridad,
        producto: t.producto,
        dias: t.dias_antiguedad,
        riesgo_ia: t.ai_risk_level,
      })),
      recent_client_notes: recentNotes.slice(0, 15).map((n: any) => ({
        message: (n.content ?? "").slice(0, 400),
        author: n.author_name,
        created_at: n.created_at,
      })),
      agreements_count: agreements.length,
      agreements_recent: (agreements as any[]).slice(0, 10).map((a) => ({
        type: a.type ?? a.agreement_type ?? null,
        status: a.status,
        title: a.title ?? a.subject ?? null,
        due_date: a.due_date,
      })),
    };

    // ─── 8. Prompt + tool calling ───────────────────────────────────────
    const systemPrompt = `Eres un Director de Customer Success senior en SYSDE Internacional con 20+ años gestionando cuentas de instituciones financieras en LATAM. Tu trabajo: diagnóstico 360° de la cuenta, anticipar churn, identificar upsell realista, y armar el plan del próximo mes. Eres directo, basado en datos, sin fluff. Hablas en español neutro. Priorizas retención sobre crecimiento cuando hay señales de churn. Si la cuenta está sana, enfocás en upsell; si está en riesgo, en retención.`;

    const userPrompt = `Analiza el estado integral del cliente y devolvé una estrategia accionable para los próximos 30 días:\n\n${JSON.stringify(context, null, 2)}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(50000),
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "client_strategy",
            description: "Análisis estratégico integral del cliente",
            parameters: {
              type: "object",
              properties: {
                salud_relacion: {
                  type: "object",
                  properties: {
                    score: { type: "number", description: "0-100, salud global de la relación" },
                    tendencia: { type: "string", enum: ["mejorando", "estable", "deteriorando"] },
                    resumen: { type: "string", description: "2-3 frases: cómo está la cuenta y por qué" },
                  },
                  required: ["score", "tendencia", "resumen"],
                },
                top_3_dolores: {
                  type: "array",
                  description: "Los 3 problemas más recurrentes o impactantes para este cliente",
                  minItems: 0,
                  maxItems: 3,
                  items: {
                    type: "object",
                    properties: {
                      titulo: { type: "string" },
                      categoria: { type: "string", description: "producto / tipo / proceso / comunicación" },
                      ocurrencias: { type: "number", description: "Aproximado de veces que apareció" },
                      impacto: { type: "string", description: "Qué impacto concreto tiene para el negocio del cliente" },
                      solucion_sugerida: { type: "string" },
                    },
                    required: ["titulo", "categoria", "impacto", "solucion_sugerida"],
                  },
                },
                oportunidades_upsell: {
                  type: "array",
                  description: "Oportunidades realistas de ampliar el contrato. Vacío si no hay señal clara.",
                  items: {
                    type: "object",
                    properties: {
                      titulo: { type: "string" },
                      detalle: { type: "string" },
                      estimado_usd_mes: { type: "number", description: "Ticket mensual estimado adicional en USD" },
                      probabilidad: { type: "string", enum: ["alta", "media", "baja"] },
                      momento_recomendado: { type: "string", description: "Cuándo proponerlo (ej: 'después de cerrar los críticos')" },
                    },
                    required: ["titulo", "detalle", "probabilidad"],
                  },
                },
                riesgos_churn: {
                  type: "array",
                  description: "Señales de que el cliente podría irse o reducir. Vacío si no hay señales.",
                  items: {
                    type: "object",
                    properties: {
                      titulo: { type: "string" },
                      severidad: { type: "string", enum: ["critico", "alto", "medio", "bajo"] },
                      senales: { type: "array", items: { type: "string" }, description: "Señales concretas observadas en los datos" },
                      mitigacion: { type: "string" },
                    },
                    required: ["titulo", "severidad", "senales", "mitigacion"],
                  },
                },
                plan_proximo_mes: {
                  type: "array",
                  description: "Plan semana-a-semana para los próximos 30 días (4 items: sem 1-4)",
                  minItems: 3,
                  maxItems: 5,
                  items: {
                    type: "object",
                    properties: {
                      semana: { type: "number", description: "1 a 4" },
                      objetivo: { type: "string" },
                      acciones: { type: "array", items: { type: "string" } },
                      responsable: { type: "string", description: "Rol o persona sugerida" },
                    },
                    required: ["semana", "objetivo", "acciones"],
                  },
                },
                confianza: {
                  type: "number",
                  description: "0-100 según calidad y volumen de datos",
                },
              },
              required: ["salud_relacion", "top_3_dolores", "oportunidades_upsell", "riesgos_churn", "plan_proximo_mes", "confianza"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "client_strategy" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido, intenta en unos minutos" }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA agotados" }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
      const t = await aiResp.text();
      throw new Error(`AI error: ${aiResp.status} ${t}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("La IA no devolvió un tool_call válido");
    const analysis = JSON.parse(toolCall.function.arguments);

    // ─── 9. Persistir + loggear uso ─────────────────────────────────────
    const { data: saved } = await db.from("pm_ai_analysis").insert({
      analysis_type: "client_strategy",
      scope: client_id,
      executive_summary: analysis.salud_relacion?.resumen ?? null,
      team_health_score: analysis.salud_relacion?.score ?? null,
      recommendations: analysis.plan_proximo_mes ?? [],
      risks: analysis.riesgos_churn ?? [],
      metrics: {
        ticket_metrics: context.ticket_metrics,
        monthly_trend: context.monthly_trend,
        salud_relacion: analysis.salud_relacion,
        confianza: analysis.confianza,
      },
      full_analysis: analysis,
      model: MODEL,
    }).select().single();

    const usage = aiData.usage ?? {};
    await db.from("ai_usage_logs").insert({
      function_name: FUNCTION_NAME,
      model: MODEL,
      prompt_tokens: usage.prompt_tokens ?? 0,
      completion_tokens: usage.completion_tokens ?? 0,
      total_tokens: usage.total_tokens ?? 0,
      status: "success",
      client_id,
      metadata: { client_name: client.name, tickets_total: total, tickets_open: open.length },
    });

    return new Response(JSON.stringify({ success: true, analysis, id: saved?.id }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error("client-strategy-ai error:", e);
    try {
      const ctx = await requireAuth(req).catch(() => null);
      if (ctx) {
        await ctx.adminClient.from("ai_usage_logs").insert({
          function_name: FUNCTION_NAME,
          model: MODEL,
          status: "error",
          error_message: String(e?.message ?? e).slice(0, 500),
        });
      }
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: e?.message ?? "Error desconocido" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
