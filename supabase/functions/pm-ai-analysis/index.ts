import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, requireAuth, requireRole } from "../_shared/auth.ts";
import { isTicketClosed, isTaskClosed } from "../_shared/ticketStatus.ts";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  try {
    const ctx = await requireAuth(req);
    await requireRole(ctx, ["admin", "pm", "gerente"]);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
    const supabase = ctx.adminClient;

    // Gather full context
    const [clientsR, contractsR, slasR, financialsR, ticketsR, tasksR, teamR] = await Promise.all([
      supabase.from("clients").select("*"),
      supabase.from("client_contracts").select("*").eq("is_active", true),
      supabase.from("client_slas").select("*").eq("is_active", true),
      supabase.from("client_financials").select("*"),
      supabase.from("support_tickets").select("id, client_id, asunto, prioridad, estado, dias_antiguedad, story_points, business_value, effort, sprint_id, scrum_status, fecha_entrega"),
      supabase.from("tasks").select("id, client_id, title, status, priority, story_points, business_value, effort, due_date, sprint_id, scrum_status"),
      supabase.from("sysde_team_members").select("id, name, role, department, cv_seniority, cv_years_experience, cv_skills, is_active").eq("is_active", true)
    ]);

    const clients = clientsR.data || [];
    const contracts = contractsR.data || [];
    const slas = slasR.data || [];
    const financials = financialsR.data || [];
    const tickets = ticketsR.data || [];
    const tasks = tasksR.data || [];
    const team = teamR.data || [];

    // Build per-client snapshot
    const clientSnapshots = clients.map((c: any) => {
      const contract = contracts.find((x: any) => x.client_id === c.id);
      const fin = financials.find((x: any) => x.client_id === c.id);
      const clientSlas = slas.filter((x: any) => x.client_id === c.id);
      const clientTickets = tickets.filter((x: any) => x.client_id === c.id);
      const clientTasks = tasks.filter((x: any) => x.client_id === c.id);
      const monthlyValue = contract?.monthly_value || 0;
      const hourlyRate = contract?.hourly_rate || 0;
      const openItems = clientTickets.filter((t: any) => !isTicketClosed(t.estado)).length + clientTasks.filter((t: any) => !isTaskClosed(t.status)).length;
      const totalEffort = [...clientTickets, ...clientTasks].reduce((s: number, x: any) => s + (x.effort || 0), 0);
      return {
        id: c.id,
        name: c.name,
        type: c.client_type,
        status: c.status,
        progress: c.progress,
        monthly_value: monthlyValue,
        hourly_rate: hourlyRate,
        currency: contract?.currency || "USD",
        contract_type: contract?.contract_type,
        sla_count: clientSlas.length,
        critical_sla_response_h: clientSlas.find((s: any) => s.priority_level === "Crítica")?.response_time_hours || null,
        open_items: openItems,
        total_effort_points: totalEffort,
        contract_value: fin?.contract_value || 0,
        hours_used: fin?.hours_used || 0,
        hours_estimated: fin?.hours_estimated || 0
      };
    });

    const totalMonthlyRevenue = clientSnapshots.reduce((s, c) => s + Number(c.monthly_value || 0), 0);
    const totalActiveItems = tickets.filter((t: any) => !isTicketClosed(t.estado)).length + tasks.filter((t: any) => !isTaskClosed(t.status)).length;

    const context = JSON.stringify({
      clients: clientSnapshots,
      team_members: team.length,
      team_seniority_dist: team.reduce((acc: any, m: any) => { const k = m.cv_seniority || "Sin clasificar"; acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
      total_active_items: totalActiveItems,
      total_monthly_revenue: totalMonthlyRevenue,
      currency: "USD"
    }, null, 2);

    const systemPrompt = `Eres un PM con 40+ años de experiencia gestionando equipos de consultoría técnica en SYSDE (SAF+, banca, vehículos, pensiones). Analizas TODO el portafolio y das recomendaciones accionables. Tu prioridad: maximizar revenue, cumplir SLA, evitar penalidades. Casos sin valor económico van al fondo. WSJF financiero = (valor_mensual_cliente × urgencia_SLA × business_value) / effort.`;

    const userPrompt = `Analiza el estado global del portafolio y genera tu informe ejecutivo:\n\n${context}`;

    const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: "gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "pm_analysis",
            description: "Análisis ejecutivo del PM IA",
            parameters: {
              type: "object",
              properties: {
                executive_summary: { type: "string", description: "Resumen ejecutivo en 3-4 frases" },
                duration_estimate_weeks: { type: "number", description: "Semanas estimadas para limpiar el backlog actual con el equipo disponible" },
                team_health_score: { type: "number", description: "0-100" },
                team_capacity_analysis: { type: "string" },
                client_priorities: {
                  type: "array",
                  description: "Clientes ordenados por prioridad financiera/SLA",
                  items: {
                    type: "object",
                    properties: {
                      client_id: { type: "string" },
                      client_name: { type: "string" },
                      priority_score: { type: "number", description: "0-100" },
                      monthly_value: { type: "number" },
                      reasoning: { type: "string" },
                      action: { type: "string", description: "Qué hacer ahora" }
                    },
                    required: ["client_id", "client_name", "priority_score", "reasoning", "action"]
                  }
                },
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["reasignar", "contratar", "escalar", "renegociar", "priorizar", "desescalar"] },
                      title: { type: "string" },
                      detail: { type: "string" },
                      impact: { type: "string", enum: ["alto", "medio", "bajo"] },
                      urgency: { type: "string", enum: ["inmediata", "esta_semana", "este_mes"] }
                    },
                    required: ["type", "title", "detail", "impact", "urgency"]
                  }
                },
                risks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      client_name: { type: "string" },
                      severity: { type: "string", enum: ["crítico", "alto", "medio"] },
                      financial_impact: { type: "string" },
                      mitigation: { type: "string" }
                    },
                    required: ["title", "severity", "mitigation"]
                  }
                }
              },
              required: ["executive_summary", "duration_estimate_weeks", "team_health_score", "client_priorities", "recommendations", "risks"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "pm_analysis" } }
      })
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido, intenta en unos minutos" }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA agotados" }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
      const t = await aiResp.text();
      throw new Error(`AI error: ${aiResp.status} ${t}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No analysis returned");
    const analysis = JSON.parse(toolCall.function.arguments);

    // Save analysis
    const { data: saved } = await supabase.from("pm_ai_analysis").insert({
      analysis_type: "global",
      scope: "portfolio",
      executive_summary: analysis.executive_summary,
      duration_estimate_weeks: analysis.duration_estimate_weeks,
      team_health_score: analysis.team_health_score,
      recommendations: analysis.recommendations,
      client_priorities: analysis.client_priorities,
      risks: analysis.risks,
      metrics: { total_monthly_revenue: totalMonthlyRevenue, total_active_items: totalActiveItems, team_size: team.length },
      full_analysis: analysis,
      model: "gemini-2.5-flash-lite"
    }).select().single();

    const usage = aiData.usage || {};
    await supabase.from("ai_usage_logs").insert({
      function_name: "pm-ai-analysis",
      model: "gemini-2.5-flash-lite",
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
      status: "success"
    });

    return new Response(JSON.stringify({ success: true, analysis, id: saved?.id }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  } catch (e: any) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error("pm-ai-analysis error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
