import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, canAccessMember, requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  try {
    const ctx = await requireAuth(req);

    const { memberId, cvText } = await req.json();
    if (!memberId || !cvText) {
      return new Response(JSON.stringify({ error: "memberId and cvText required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" }
      });
    }
    if (typeof cvText !== "string" || cvText.length > 50000) {
      return new Response(JSON.stringify({ error: "cvText must be a string up to 50000 chars" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    if (!(await canAccessMember(ctx, memberId))) {
      return new Response(JSON.stringify({ error: "No autorizado a analizar el CV de este miembro" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
    const supabase = ctx.adminClient;

    // Get clients for matching context
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name, industry, client_type, country");

    const clientsContext = (clients || []).map((c: any) =>
      `- ${c.name} (${c.industry}, ${c.country}, ${c.client_type})`
    ).join("\n");

    const systemPrompt = `Eres un PM senior con 40+ años de experiencia analizando perfiles técnicos en SYSDE (consultoría SAF+, banca, pensiones, vehículos). Analiza el CV y devuelve análisis estructurado vía tool calling.`;

    const userPrompt = `CV a analizar:\n\n${cvText.slice(0, 12000)}\n\nClientes activos SYSDE:\n${clientsContext}`;

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
            name: "analyze_cv",
            description: "Análisis estructurado del CV",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "Resumen ejecutivo en 2-3 frases" },
                years_experience: { type: "number" },
                seniority: { type: "string", enum: ["Junior", "Semi-Senior", "Senior", "Lead", "Architect"] },
                skills: { type: "array", items: { type: "string" }, description: "Habilidades técnicas principales" },
                domains: { type: "array", items: { type: "string" }, description: "Áreas de dominio (SAF+, banca, pensiones, etc.)" },
                certifications: { type: "array", items: { type: "string" } },
                strengths: { type: "array", items: { type: "string" }, description: "3-5 fortalezas clave" },
                gaps: { type: "array", items: { type: "string" }, description: "Áreas a desarrollar" },
                recommended_clients: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      client_id: { type: "string" },
                      client_name: { type: "string" },
                      fit_score: { type: "number", description: "0-100" },
                      reason: { type: "string" }
                    },
                    required: ["client_id", "client_name", "fit_score", "reason"]
                  }
                },
                ideal_role: { type: "string" }
              },
              required: ["summary", "years_experience", "seniority", "skills", "domains", "strengths", "recommended_clients", "ideal_role"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "analyze_cv" } }
      })
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido" }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Créditos agotados" }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
      const t = await aiResp.text();
      throw new Error(`AI error: ${aiResp.status} ${t}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call returned");
    const analysis = JSON.parse(toolCall.function.arguments);

    // Update member
    await supabase.from("sysde_team_members").update({
      cv_analysis: analysis,
      cv_skills: analysis.skills || [],
      cv_years_experience: analysis.years_experience,
      cv_seniority: analysis.seniority,
      cv_recommended_clients: analysis.recommended_clients || []
    }).eq("id", memberId);

    // Log usage
    const usage = aiData.usage || {};
    await supabase.from("ai_usage_logs").insert({
      function_name: "analyze-cv",
      model: "gemini-2.5-flash-lite",
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
      status: "success",
      metadata: { member_id: memberId }
    });

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  } catch (e: any) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error("analyze-cv error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
