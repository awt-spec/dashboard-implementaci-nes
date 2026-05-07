import { corsHeaders, corsPreflight, lovableCompatFetch } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, canAccessMember, requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);
  try {
    const ctx = await requireAuth(req);

    const { memberId, targetRole } = await req.json();
    if (!memberId) {
      return new Response(JSON.stringify({ error: "memberId required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!(await canAccessMember(ctx, memberId))) {
      return new Response(JSON.stringify({ error: "No autorizado a analizar la carrera de este miembro" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = ctx.adminClient;

    const { data: member } = await supabase.from("sysde_team_members").select("*").eq("id", memberId).maybeSingle();
    if (!member) {
      return new Response(JSON.stringify({ error: "Member not found" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: certs } = await supabase.from("team_member_certifications").select("*").eq("member_id", memberId);

    const cvAnalysis = (member.cv_analysis as any) || {};
    const skills = member.cv_skills || [];
    const seniority = member.cv_seniority || "Semi-Senior";
    const yearsExp = member.cv_years_experience || 0;
    const role = member.role || "—";
    const target = targetRole || (seniority === "Junior" ? "Semi-Senior" : seniority === "Semi-Senior" ? "Senior" : seniority === "Senior" ? "Tech Lead" : "Architect");

    const userPrompt = `Analiza el plan de carrera de este colaborador SYSDE y genera un roadmap personalizado.

PERFIL ACTUAL:
- Nombre: ${member.name}
- Rol: ${role}
- Seniority: ${seniority} (${yearsExp} años exp)
- Skills: ${skills.join(", ") || "no registrado"}
- Dominios: ${(cvAnalysis.domains || []).join(", ") || "no registrado"}
- Fortalezas: ${(cvAnalysis.strengths || []).join(", ") || "no registrado"}
- Gaps actuales: ${(cvAnalysis.gaps || []).join(", ") || "ninguno"}
- Certificaciones: ${(certs || []).map((c: any) => c.name).join(", ") || "ninguna"}

ROL OBJETIVO: ${target}

Contexto SYSDE: consultoría SAF+ (banca, pensiones, vehículos). Roles típicos: Junior Dev → Semi-Senior Dev → Senior Dev → Tech Lead → Architect. Especializaciones: Backend Java, Frontend React, DevOps, QA, BA, PM, Soporte.`;

    const aiResp = await lovableCompatFetch({
      model: "gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: "Eres un mentor senior y career coach técnico con 20+ años en consultoría de software. Generas planes de carrera realistas, con pasos concretos y timeline." },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "career_plan",
          description: "Plan de carrera estructurado",
          parameters: {
            type: "object",
            properties: {
              ai_summary: { type: "string", description: "Resumen ejecutivo del plan en 2-3 frases" },
              skills_gap: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    skill: { type: "string" },
                    priority: { type: "string", enum: ["alta", "media", "baja"] },
                    reason: { type: "string" },
                  },
                  required: ["skill", "priority", "reason"],
                },
                description: "Skills que faltan para llegar al rol objetivo",
              },
              recommended_certifications: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    issuer: { type: "string" },
                    timeline_months: { type: "number" },
                  },
                  required: ["name", "issuer"],
                },
              },
              roadmap: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    milestone: { type: "string" },
                    timeframe: { type: "string", description: "Ej: '0-3 meses', '6-12 meses'" },
                    actions: { type: "array", items: { type: "string" } },
                  },
                  required: ["milestone", "timeframe", "actions"],
                },
                description: "3-5 hitos de carrera con acciones",
              },
              mentoring_suggestions: {
                type: "array",
                items: { type: "string" },
                description: "Sugerencias de mentoring, comunidades, tipo de mentor que necesita",
              },
            },
            required: ["ai_summary", "skills_gap", "recommended_certifications", "roadmap", "mentoring_suggestions"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "career_plan" } },
    }, { timeoutMs: 30000 });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido" }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Créditos agotados" }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
      const t = await aiResp.text();
      throw new Error(`AI error: ${aiResp.status} ${t}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call returned");
    const plan = JSON.parse(toolCall.function.arguments);

    // Upsert career path
    const { data: existing } = await supabase.from("team_career_paths").select("id").eq("member_id", memberId).maybeSingle();
    const payload = {
      member_id: memberId,
      current_role_name: role,
      target_role_name: target,
      skills_gap: plan.skills_gap || [],
      recommended_certifications: plan.recommended_certifications || [],
      roadmap: plan.roadmap || [],
      mentoring_suggestions: plan.mentoring_suggestions || [],
      ai_summary: plan.ai_summary || "",
      generated_at: new Date().toISOString(),
      model: "gemini-2.5-flash-lite",
    };
    if (existing) await supabase.from("team_career_paths").update(payload).eq("id", existing.id);
    else await supabase.from("team_career_paths").insert(payload);

    const usage = aiData.usage || {};
    await supabase.from("ai_usage_logs").insert({
      function_name: "analyze-career-path",
      model: "gemini-2.5-flash-lite",
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
      status: "success",
      metadata: { member_id: memberId, target_role: target },
    });

    return new Response(JSON.stringify({ success: true, plan }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error("analyze-career-path error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
