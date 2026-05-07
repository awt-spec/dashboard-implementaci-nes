import { corsHeaders, corsPreflight, lovableCompatFetch } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, requireAuth, requireRole } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  try {
    const ctx = await requireAuth(req);
    await requireRole(ctx, ["admin", "pm", "gerente"]);

    const supabase = ctx.adminClient;

    // 1) Pull team, skills, scrum stats in parallel
    const [membersRes, skillsRes, itemsRes, supportRes] = await Promise.all([
      supabase.from("sysde_team_members").select(
        "id, name, role, department, employment_type, hire_date, cv_seniority, cv_years_experience, cv_skills, cv_analysis, is_active"
      ).eq("is_active", true),
      supabase.from("team_member_skills").select("member_id, skill_name, category, level, is_certified, years_experience"),
      supabase.from("scrum_work_items" as any).select("owner, scrum_status, story_points, client_id, source").limit(2000),
      supabase.from("support_tickets" as any).select("assignee, status, priority").limit(2000),
    ]);

    const members = membersRes.data || [];
    const skillsAll = skillsRes.data || [];
    const items = (itemsRes.data as any[]) || [];
    const tickets = (supportRes.data as any[]) || [];

    // Aggregate per-member productivity stats
    const statsByName: Record<string, any> = {};
    for (const m of members) {
      statsByName[m.name?.toLowerCase() || ""] = {
        items_total: 0, items_done: 0, points_total: 0, points_done: 0,
        tickets_total: 0, tickets_open: 0,
      };
    }
    for (const it of items) {
      const key = (it.owner || "").toLowerCase();
      if (!statsByName[key]) continue;
      statsByName[key].items_total += 1;
      statsByName[key].points_total += it.story_points || 0;
      if (it.scrum_status === "done") {
        statsByName[key].items_done += 1;
        statsByName[key].points_done += it.story_points || 0;
      }
    }
    for (const t of tickets) {
      const key = (t.assignee || "").toLowerCase();
      if (!statsByName[key]) continue;
      statsByName[key].tickets_total += 1;
      if (t.status !== "resuelto" && t.status !== "cerrado") statsByName[key].tickets_open += 1;
    }

    // Build compact roster for the model
    const roster = members.map((m: any) => {
      const stats = statsByName[(m.name || "").toLowerCase()] || {};
      const skills = skillsAll.filter((s: any) => s.member_id === m.id);
      const skillSummary = skills.map((s: any) =>
        `${s.skill_name}(L${s.level}${s.is_certified ? "✓" : ""})`
      ).slice(0, 12).join(", ");
      return {
        id: m.id,
        name: m.name,
        role: m.role,
        seniority: m.cv_seniority || "—",
        years: m.cv_years_experience || null,
        cv_skills: (m.cv_skills || []).slice(0, 10),
        catalog_skills: skillSummary,
        items_done: stats.items_done || 0,
        items_total: stats.items_total || 0,
        points_done: stats.points_done || 0,
        tickets_open: stats.tickets_open || 0,
        tickets_total: stats.tickets_total || 0,
        cv_summary: m.cv_analysis?.summary || null,
        cv_strengths: m.cv_analysis?.strengths || [],
        cv_gaps: m.cv_analysis?.gaps || [],
      };
    });

    const systemPrompt = `Eres Director Técnico de SYSDE (consultoría SAF+, banca, pensiones). Evaluá el NIVEL GLOBAL del equipo combinando: CVs (skills, seniority, fortalezas, gaps), catálogo de skills auto-reportadas con nivel/certificación, y productividad real (items completados, story points, tickets resueltos). Devolvé un análisis estructurado vía tool calling, en español, conciso y accionable.`;

    const userPrompt = `Equipo SYSDE actual (${roster.length} miembros activos):\n\n${JSON.stringify(roster, null, 2)}`;

    const aiResp = await lovableCompatFetch({
      model: "gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "team_level_assessment",
          description: "Evaluación global del nivel técnico del equipo SYSDE",
          parameters: {
            type: "object",
            properties: {
              overall_score: { type: "number", description: "0-100 nivel global del equipo" },
              seniority_distribution: {
                type: "object",
                properties: {
                  junior: { type: "number" },
                  semi_senior: { type: "number" },
                  senior: { type: "number" },
                  lead: { type: "number" },
                  architect: { type: "number" },
                },
              },
              executive_summary: { type: "string", description: "2-4 párrafos. Diagnóstico ejecutivo del nivel del equipo." },
              strengths: {
                type: "array",
                items: { type: "string" },
                description: "3-6 fortalezas del equipo en su conjunto",
              },
              gaps: {
                type: "array",
                items: { type: "string" },
                description: "3-6 brechas críticas a cerrar",
              },
              top_performers: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    member_id: { type: "string" },
                    name: { type: "string" },
                    reason: { type: "string" },
                    score: { type: "number", description: "0-100" },
                  },
                  required: ["name", "reason", "score"],
                },
                description: "Top 5 miembros mejor evaluados combinando CV + stats",
              },
              at_risk: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    member_id: { type: "string" },
                    name: { type: "string" },
                    reason: { type: "string" },
                    action: { type: "string", description: "Acción concreta sugerida" },
                  },
                  required: ["name", "reason", "action"],
                },
                description: "Miembros con bajo rendimiento o gaps importantes",
              },
              hiring_recommendations: {
                type: "array",
                items: { type: "string" },
                description: "Roles/perfiles que faltan o están subdimensionados",
              },
              training_plan: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    area: { type: "string" },
                    priority: { type: "string", enum: ["alta", "media", "baja"] },
                    members: { type: "array", items: { type: "string" } },
                  },
                  required: ["area", "priority"],
                },
                description: "Plan de capacitación priorizado",
              },
              metrics: {
                type: "object",
                properties: {
                  avg_seniority_score: { type: "number" },
                  productivity_score: { type: "number" },
                  skill_coverage_score: { type: "number" },
                  bus_factor: { type: "number", description: "Cuántos miembros pueden faltar antes de impactar entregas" },
                },
              },
            },
            required: ["overall_score", "executive_summary", "strengths", "gaps", "top_performers", "at_risk", "metrics"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "team_level_assessment" } },
    }, { timeoutMs: 30000 });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido. Intenta en un momento." }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA agotados." }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
      const t = await aiResp.text();
      throw new Error(`AI error: ${aiResp.status} ${t}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI no devolvió análisis estructurado");
    const analysis = JSON.parse(toolCall.function.arguments);

    // Persist into pm_ai_analysis with a distinctive analysis_type
    await supabase.from("pm_ai_analysis").insert({
      analysis_type: "team_level",
      scope: `${roster.length} miembros`,
      executive_summary: analysis.executive_summary,
      team_health_score: Math.round(analysis.overall_score || 0),
      recommendations: analysis.training_plan || [],
      risks: analysis.at_risk || [],
      metrics: { ...analysis.metrics, seniority_distribution: analysis.seniority_distribution },
      full_analysis: analysis,
      model: "gemini-2.5-flash-lite",
    });

    // Log usage
    const usage = aiData.usage || {};
    await supabase.from("ai_usage_logs").insert({
      function_name: "analyze-team-level",
      model: "gemini-2.5-flash-lite",
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
      status: "success",
      metadata: { members_count: roster.length },
    });

    return new Response(JSON.stringify({ success: true, analysis, roster_count: roster.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error("analyze-team-level error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
