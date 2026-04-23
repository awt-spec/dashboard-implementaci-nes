import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, requireAuth, requireRole } from "../_shared/auth.ts";

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  try {
    const ctx = await requireAuth(req);
    await requireRole(ctx, ["admin", "pm", "gerente"]);

    const { client_id, project_brief, required_skills = [], team_size = 3 } = await req.json();
    if (!client_id && !project_brief) {
      return new Response(JSON.stringify({ error: "client_id or project_brief required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = ctx.adminClient;

    // Load active members + skills + capacity
    const { data: members } = await supabase
      .from("sysde_team_members")
      .select("id,name,role,department,cv_seniority,cv_years_experience,cv_skills,cv_analysis")
      .eq("is_active", true);

    const { data: skills } = await supabase.from("team_member_skills").select("*");
    const { data: capacity } = await supabase.from("team_member_capacity").select("*");

    let clientCtx: any = null;
    if (client_id) {
      const { data: client } = await supabase.from("clients").select("*").eq("id", client_id).maybeSingle();
      clientCtx = client;
    }

    const memberSummary = (members || []).map((m: any) => {
      const ms = (skills || []).filter((s: any) => s.member_id === m.id);
      const cap = (capacity || []).find((c: any) => c.member_id === m.id);
      return {
        id: m.id, name: m.name, role: m.role, department: m.department,
        seniority: m.cv_seniority, years: m.cv_years_experience,
        cv_skills: m.cv_skills || [],
        rated_skills: ms.map((s: any) => ({ name: s.skill_name, level: s.level, certified: s.is_certified })),
        weekly_capacity: cap?.weekly_hours ?? 40,
      };
    });

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

    const prompt = `Eres un PM senior. Recomienda los mejores ${team_size} candidatos del equipo SYSDE para este proyecto.

CLIENTE: ${clientCtx ? JSON.stringify({ name: clientCtx.name, industry: clientCtx.industry, modules: clientCtx.modules, type: clientCtx.client_type }) : "N/A"}

BRIEF: ${project_brief || "Implementación estándar"}

SKILLS REQUERIDAS: ${required_skills.join(", ") || "ninguna específica"}

EQUIPO DISPONIBLE (${memberSummary.length} miembros):
${JSON.stringify(memberSummary, null, 2)}

Devuelve SOLO JSON con candidatos rankeados, justificación y skill gaps.`;

    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: "gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Eres un experto en asignación de equipos. Responde SOLO con la herramienta provista." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "recommend_team",
            description: "Devuelve recomendación de equipo",
            parameters: {
              type: "object",
              properties: {
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      member_id: { type: "string" },
                      member_name: { type: "string" },
                      match_score: { type: "number", minimum: 0, maximum: 100 },
                      strengths: { type: "array", items: { type: "string" } },
                      gaps: { type: "array", items: { type: "string" } },
                      role_in_project: { type: "string" },
                      justification: { type: "string" },
                    },
                    required: ["member_id", "member_name", "match_score", "strengths", "gaps", "role_in_project", "justification"],
                  },
                },
                team_summary: { type: "string" },
                missing_skills: { type: "array", items: { type: "string" } },
                hiring_recommendations: { type: "array", items: { type: "string" } },
              },
              required: ["recommendations", "team_summary", "missing_skills", "hiring_recommendations"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "recommend_team" } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Sin créditos" }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
      throw new Error(`AI error ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const result = toolCall ? JSON.parse(toolCall.function.arguments) : {};

    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
