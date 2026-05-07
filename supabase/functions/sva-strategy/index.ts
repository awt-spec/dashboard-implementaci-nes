// Genera un plan estratégico semanal para el equipo SVA (soporte SYSDE).
// Cruza: clientes (valor, SLA), equipo (capacidad, skills), backlog (WSJF, SLA urgency),
// horas trabajadas últimas 2 semanas → plan accionable con foco, asignaciones y clientes prioritarios.

import { corsHeaders, corsPreflight, lovableCompatFetch } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, requireAuth, requireRole } from "../_shared/auth.ts";
import { isTicketClosed, isTaskClosed } from "../_shared/ticketStatus.ts";

const MODEL = "gemini-2.5-flash-lite";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  try {
    const ctx = await requireAuth(req);
    await requireRole(ctx, ["admin", "pm", "gerente"]);

    const sb = ctx.adminClient;

    // ── Recolectar contexto ──────────────────────────────────────────────
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();

    const [
      { data: tickets },
      { data: tasks },
      { data: clients },
      { data: contracts },
      { data: slas },
      { data: members },
      { data: hours },
      { data: activeSprints },
    ] = await Promise.all([
      sb.from("support_tickets").select("id, ticket_id, asunto, tipo, prioridad, estado, dias_antiguedad, responsable, client_id, story_points, business_value, effort, sprint_id, scrum_status, fecha_entrega, created_at"),
      sb.from("tasks").select("id, title, status, priority, owner, client_id, story_points, business_value, effort, sprint_id, scrum_status, due_date"),
      sb.from("clients").select("id, name, client_type, status, industry"),
      sb.from("client_contracts").select("client_id, monthly_value, currency, contract_type").eq("is_active", true),
      sb.from("client_slas").select("client_id, priority_level, response_time_hours").eq("is_active", true),
      sb.from("sysde_team_members").select("id, name, role, cv_seniority, cv_years_experience, is_active, user_id").eq("is_active", true),
      sb.from("work_time_entries" as any).select("user_id, client_id, duration_seconds, is_billable, category, started_at").gte("started_at", twoWeeksAgo),
      sb.from("support_sprints").select("id, name, goal, start_date, end_date, status").eq("status", "activo"),
    ]);

    // ── Comprimir para el modelo ─────────────────────────────────────────
    const clientMap = new Map<string, any>();
    (clients || []).forEach((c: any) => clientMap.set(c.id, c));
    const contractMap = new Map<string, any>();
    (contracts || []).forEach((c: any) => contractMap.set(c.client_id, c));
    const slaByClient = new Map<string, any[]>();
    (slas || []).forEach((s: any) => {
      if (!slaByClient.has(s.client_id)) slaByClient.set(s.client_id, []);
      slaByClient.get(s.client_id)!.push(s);
    });
    const memberByUserId = new Map<string, any>();
    (members || []).forEach((m: any) => m.user_id && memberByUserId.set(m.user_id, m));

    // Horas por persona × cliente (últimas 2 semanas)
    const hoursAgg: Record<string, Record<string, { total: number; billable: number }>> = {};
    (hours || []).forEach((h: any) => {
      const member = memberByUserId.get(h.user_id);
      const name = member?.name || "Desconocido";
      const cliName = h.client_id ? clientMap.get(h.client_id)?.name || h.client_id : "Sin cliente";
      const hoursNum = (h.duration_seconds || 0) / 3600;
      if (!hoursAgg[name]) hoursAgg[name] = {};
      if (!hoursAgg[name][cliName]) hoursAgg[name][cliName] = { total: 0, billable: 0 };
      hoursAgg[name][cliName].total += hoursNum;
      if (h.is_billable) hoursAgg[name][cliName].billable += hoursNum;
    });

    const openTickets = (tickets || []).filter((t: any) => !isTicketClosed(t.estado));
    const openTasks = (tasks || []).filter((t: any) => !isTaskClosed(t.status));

    const clientSnapshots = (clients || []).map((c: any) => {
      const contract = contractMap.get(c.id);
      const clientSlas = slaByClient.get(c.id) || [];
      const clientOpen = [
        ...openTickets.filter((t: any) => t.client_id === c.id),
        ...openTasks.filter((t: any) => t.client_id === c.id),
      ];
      const overdue = clientOpen.filter((x: any) => {
        const due = x.fecha_entrega || x.due_date;
        return due && new Date(due) < new Date();
      }).length;
      return {
        id: c.id,
        name: c.name,
        type: c.client_type,
        status: c.status,
        monthly_value: contract?.monthly_value ?? 0,
        currency: contract?.currency || "USD",
        contract_type: contract?.contract_type,
        critical_sla_h: clientSlas.find((s: any) => s.priority_level === "Crítica")?.response_time_hours ?? null,
        open_items: clientOpen.length,
        overdue_items: overdue,
        active_sprint: (activeSprints || []).some((s: any) => s.client_id === c.id),
      };
    }).filter(c => c.open_items > 0 || c.monthly_value > 0);

    const teamSnapshot = (members || []).map((m: any) => {
      const mh = hoursAgg[m.name] || {};
      const totalH = Object.values(mh).reduce((s: number, x: any) => s + x.total, 0);
      const billableH = Object.values(mh).reduce((s: number, x: any) => s + x.billable, 0);
      const myOpen = [
        ...openTickets.filter((t: any) => t.responsable === m.name),
        ...openTasks.filter((t: any) => t.owner === m.name),
      ];
      return {
        id: m.id,
        name: m.name,
        role: m.role,
        seniority: m.cv_seniority,
        years: m.cv_years_experience,
        open_items: myOpen.length,
        overdue_items: myOpen.filter((x: any) => {
          const due = x.fecha_entrega || x.due_date;
          return due && new Date(due) < new Date();
        }).length,
        hours_2w: Math.round(totalH * 10) / 10,
        billable_2w: Math.round(billableH * 10) / 10,
        billable_pct: totalH > 0 ? Math.round((billableH / totalH) * 100) : 0,
        top_clients: Object.entries(mh).sort((a, b) => (b[1] as any).total - (a[1] as any).total).slice(0, 3).map(([name, h]: any) => `${name} (${Math.round(h.total)}h)`),
      };
    });

    const topBacklog = [...openTickets, ...openTasks]
      .map((x: any) => ({
        id: x.id,
        type: x.asunto ? "ticket" : "task",
        title: x.asunto || x.title,
        client: clientMap.get(x.client_id)?.name || "—",
        owner: x.responsable || x.owner || "—",
        priority: x.prioridad || x.priority,
        wsjf: (x.business_value && x.effort) ? Math.round((x.business_value / x.effort) * 100) / 100 : 0,
        in_sprint: !!x.sprint_id,
        overdue: (() => {
          const due = x.fecha_entrega || x.due_date;
          return due && new Date(due) < new Date();
        })(),
      }))
      .sort((a, b) => b.wsjf - a.wsjf)
      .slice(0, 40);

    // ── Prompt ──────────────────────────────────────────────────────────
    const systemPrompt = `Eres el PMO del equipo SVA (Servicios de Valor Agregado / Soporte) de SYSDE Internacional con 25 años de experiencia en operaciones de soporte a banca, pensiones y vehículos. Generas planes semanales operativos, concretos y accionables, optimizando: cumplimiento SLA, ingreso mensual, balance de carga del equipo y calidad de datos.

Al asignar personas a clientes, considera: seniority vs complejidad del cliente, continuidad (la persona que ya trabajó ese cliente las últimas 2 semanas tiene contexto), y carga actual (evita sobrecargar a los que ya tienen >7 items abiertos).

Prioriza clientes por: (valor_mensual × urgencia_SLA × overdue_count) / capacidad_restante. Items sin valor económico y sin SLA crítico van al final.

Para "items_to_defer", solo sugiere ítems con WSJF < 1 o con baja prioridad Y sin cliente pagante. NO sugieras diferir items críticos ni con SLA vencido.

Responde SIEMPRE invocando la función generate_weekly_plan con JSON estructurado en español.`;

    const userPrompt = `Estado del SVA hoy:

CLIENTES (${clientSnapshots.length} con actividad o valor):
${JSON.stringify(clientSnapshots, null, 1)}

EQUIPO (${teamSnapshot.length} activos):
${JSON.stringify(teamSnapshot, null, 1)}

BACKLOG TOP 40 (por WSJF):
${JSON.stringify(topBacklog, null, 1)}

SPRINTS ACTIVOS:
${JSON.stringify(activeSprints || [], null, 1)}

Genera el plan de la semana.`;

    // ── Llamada al modelo ───────────────────────────────────────────────
    const aiResp = await lovableCompatFetch({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "generate_weekly_plan",
          description: "Plan semanal del SVA",
          parameters: {
            type: "object",
            properties: {
              executive_summary: { type: "string", description: "2-3 frases con la lectura de la semana" },
              weekly_focus: {
                type: "array",
                description: "3-5 objetivos concretos de la semana",
                items: { type: "string" },
              },
              client_priorities: {
                type: "array",
                description: "Clientes ordenados por prioridad estratégica",
                items: {
                  type: "object",
                  properties: {
                    client_id: { type: "string" },
                    client_name: { type: "string" },
                    tier: { type: "string", enum: ["critico", "alto", "medio", "bajo"] },
                    reason: { type: "string" },
                    action: { type: "string", description: "Acción concreta esta semana" },
                  },
                  required: ["client_id", "client_name", "tier", "reason", "action"],
                },
              },
              assignments: {
                type: "array",
                description: "Asignación por persona para la semana",
                items: {
                  type: "object",
                  properties: {
                    member_name: { type: "string" },
                    primary_client: { type: "string" },
                    target_hours: { type: "number", description: "Horas planeadas 35-45" },
                    focus_items: {
                      type: "array",
                      description: "2-4 items (IDs o títulos) en los que debe enfocarse",
                      items: { type: "string" },
                    },
                    note: { type: "string", description: "Razón de la asignación y context-switching sugerido" },
                  },
                  required: ["member_name", "primary_client", "target_hours", "focus_items", "note"],
                },
              },
              items_to_defer: {
                type: "array",
                description: "Items a aplazar, dividir o cerrar sin trabajo",
                items: {
                  type: "object",
                  properties: {
                    item_id: { type: "string" },
                    title: { type: "string" },
                    action: { type: "string", enum: ["aplazar", "dividir", "cerrar", "reasignar"] },
                    reason: { type: "string" },
                  },
                  required: ["item_id", "title", "action", "reason"],
                },
              },
              risks_this_week: {
                type: "array",
                description: "Riesgos principales esta semana",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    severity: { type: "string", enum: ["critico", "alto", "medio"] },
                    mitigation: { type: "string" },
                  },
                  required: ["title", "severity", "mitigation"],
                },
              },
            },
            required: ["executive_summary", "weekly_focus", "client_priorities", "assignments", "items_to_defer", "risks_this_week"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "generate_weekly_plan" } },
    }, { timeoutMs: 45000 });

    if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido" }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
    if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA agotados" }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
    if (!aiResp.ok) throw new Error(`AI gateway ${aiResp.status}`);

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call en respuesta");
    const plan = JSON.parse(toolCall.function.arguments);

    // ── Persistir plan ──────────────────────────────────────────────────
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - (weekStart.getDay() || 7) + 1);

    const { data: saved } = await sb.from("pm_ai_analysis").insert({
      analysis_type: "sva_weekly_plan",
      scope: `Semana ${weekStart.toISOString().slice(0, 10)}`,
      executive_summary: plan.executive_summary,
      recommendations: plan.weekly_focus?.map((f: string) => ({ title: f, type: "foco", impact: "alto", urgency: "esta_semana" })) || [],
      client_priorities: plan.client_priorities || [],
      risks: plan.risks_this_week || [],
      full_analysis: plan,
      metrics: {
        clients_evaluated: clientSnapshots.length,
        team_size: teamSnapshot.length,
        backlog_items: topBacklog.length,
        week_start: weekStart.toISOString().slice(0, 10),
      },
      model: MODEL,
    }).select().single();

    // ── Log AI usage ────────────────────────────────────────────────────
    const usage = aiData.usage || {};
    await sb.from("ai_usage_logs").insert({
      function_name: "sva-strategy",
      model: MODEL,
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
      status: "success",
      metadata: { clients: clientSnapshots.length, team: teamSnapshot.length, backlog: topBacklog.length },
    });

    return new Response(JSON.stringify({ plan, id: saved?.id, generated_at: new Date().toISOString() }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error("sva-strategy error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
